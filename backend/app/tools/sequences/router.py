from fastapi import APIRouter, HTTPException, Query, Depends, Path
from typing import List, Optional
import httpx
import logging
import asyncio
import time
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import traceback

from ...database import get_db
from ...security import get_current_user
from ...auth.models import User
from ...config import settings  # Import settings to access NCBI API key

# Configurar logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/sequences",
    tags=["sequences"],
)

# Models
from pydantic import BaseModel

class SearchResult(BaseModel):
    id: str
    name: str
    organism: str
    length: int
    type: str  # 'dna', 'rna', or 'protein'
    preview: str
    sequence: Optional[str] = None

class SearchResponse(BaseModel):
    results: List[SearchResult]

class SequenceResponse(BaseModel):
    sequence: str

# Simple rate limiter (memory-based)
from datetime import datetime, timedelta

# Store for rate limiting: {user_id: {endpoint: [timestamps]}}
request_logs = {}

# NCBI rate limiting
last_ncbi_request_time = 0
ncbi_request_timestamps = []

def check_rate_limit(user_id: int, endpoint: str, limit: int, period: int) -> bool:
    """
    Check if the user has exceeded the rate limit
    
    Args:
        user_id: User ID
        endpoint: API endpoint
        limit: Maximum requests allowed
        period: Time period in seconds
        
    Returns:
        True if request is allowed, False otherwise
    """
    now = datetime.now()
    time_limit = now - timedelta(seconds=period)
    
    # Initialize user data if needed
    if user_id not in request_logs:
        request_logs[user_id] = {}
    
    if endpoint not in request_logs[user_id]:
        request_logs[user_id][endpoint] = []
    
    # Clean up old timestamps
    request_logs[user_id][endpoint] = [
        ts for ts in request_logs[user_id][endpoint] if ts > time_limit
    ]
    
    # Check if limit exceeded
    if len(request_logs[user_id][endpoint]) >= limit:
        return False
    
    # Add current timestamp
    request_logs[user_id][endpoint].append(now)
    return True

def enforce_ncbi_rate_limit():
    """
    Enforce NCBI rate limit by adding delay if necessary
    """
    global last_ncbi_request_time, ncbi_request_timestamps
    
    current_time = time.time()
    
    # Clean up old timestamps (older than 1 second)
    ncbi_request_timestamps = [
        ts for ts in ncbi_request_timestamps if current_time - ts < 1.0
    ]
    
    # Check if we're exceeding the rate limit
    if len(ncbi_request_timestamps) >= settings.NCBI_RATE_LIMIT:
        # Calculate how long to wait
        oldest_timestamp = min(ncbi_request_timestamps) if ncbi_request_timestamps else current_time
        sleep_time = 1.0 - (current_time - oldest_timestamp)
        
        if sleep_time > 0:
            time.sleep(sleep_time)
            current_time = time.time()  # Update current time after sleep
    
    # Record this request
    ncbi_request_timestamps.append(current_time)
    last_ncbi_request_time = current_time

def add_ncbi_params(params):
    """
    Add NCBI API parameters to the request parameters
    
    Args:
        params: Dictionary of request parameters
        
    Returns:
        Updated parameters dictionary
    """
    # Add API key if available
    if settings.NCBI_API_KEY:
        params["api_key"] = settings.NCBI_API_KEY
    
    # Add tool name and email for proper attribution
    params["tool"] = settings.NCBI_TOOL_NAME
    params["email"] = settings.NCBI_EMAIL
    
    return params

@router.get("/search", response_model=SearchResponse)
async def search_sequences(
    query: str = Query(..., min_length=3, description="Search query (keyword, ID, etc.)"),
    type: str = Query("all", description="Type of sequence to search for"),
    tool_context: Optional[str] = Query(None, description="Tool context (alignment, blast, etc.)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search for biological sequences in multiple databases
    """
    try:
        # Apply rate limiting (10 requests per minute)
        if not check_rate_limit(current_user.id, "search_sequences", 10, 60):
            raise HTTPException(
                status_code=429, 
                detail="Rate limit exceeded. Try again later."
            )
        
        logger.info(f"Sequence search requested: query='{query}', type='{type}', tool_context='{tool_context}'")
        
        # Validate type parameter
        if type not in ["nucleotide", "protein", "all"]:
            raise HTTPException(status_code=400, detail="Invalid type parameter. Must be 'nucleotide', 'protein', or 'all'")
        
        # Initialize results list
        results = []
        
        # Determine which databases to search based on type
        databases_to_search = []
        if type == "all" or type == "nucleotide":
            databases_to_search.append("nucleotide")
        if type == "all" or type == "protein":
            databases_to_search.append("protein")
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Realizar búsquedas en paralelo para mejorar rendimiento
            search_tasks = []
            
            # Nucleotide search (NCBI)
            if "nucleotide" in databases_to_search:
                search_tasks.append(search_ncbi_nucleotide(client, query))
            
            # Protein search (UniProt)
            if "protein" in databases_to_search:
                search_tasks.append(search_uniprot(client, query))
            
            # Esperar a que todas las búsquedas se completen
            all_results = await asyncio.gather(*search_tasks, return_exceptions=True)
            
            # Procesar resultados
            for result_set in all_results:
                if isinstance(result_set, Exception):
                    logger.warning(f"Error during search: {str(result_set)}")
                    continue
                    
                results.extend(result_set)
        
        logger.info(f"Search completed: found {len(results)} results")
        return {"results": results}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error searching sequences: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error searching sequences: {str(e)}")

async def search_ncbi_nucleotide(client, query):
    """Buscar secuencias de nucleótidos en NCBI con secuencias completas"""
    results = []
    try:
        # Apply NCBI rate limiting before making requests
        enforce_ncbi_rate_limit()
        
        # Use NCBI E-utilities to search
        search_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
        search_params = {
            "db": "nucleotide",
            "term": query,
            "retmax": "5",
            "retmode": "json",
            "sort": "relevance"
        }
        
        # Add NCBI parameters (API key, tool, email)
        search_params = add_ncbi_params(search_params)
        
        # Log the search request for debugging
        debug_url = search_url + "?" + "&".join([f"{k}={v}" for k, v in search_params.items() if k != "api_key"])
        logger.info(f"Requesting NCBI nucleotide search: {debug_url}")
        
        search_response = await client.get(search_url, params=search_params)
        search_response.raise_for_status()
        
        # Log response details for debugging
        logger.info(f"NCBI search response status: {search_response.status_code}, content length: {len(search_response.content)}")
        
        # Save response content to debug in case of issues
        response_content = search_response.text
        try:
            search_data = search_response.json()
            ids = search_data.get("esearchresult", {}).get("idlist", [])
            
            # Log the IDs found
            logger.info(f"NCBI search returned {len(ids)} result IDs: {ids[:3]}...")
            
            if not ids:
                logger.warning(f"NCBI search returned no IDs for query: {query}")
                return results
                
        except Exception as e:
            logger.error(f"Error parsing NCBI search response: {str(e)}")
            logger.error(f"Response content: {response_content[:500]}...")
            return results
        
        if ids:
            # Get summaries for these IDs
            enforce_ncbi_rate_limit()  # Apply rate limiting before next request
            
            summary_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
            summary_params = {
                "db": "nucleotide",
                "id": ",".join(ids),
                "retmode": "json"
            }
            
            # Add NCBI parameters
            summary_params = add_ncbi_params(summary_params)
            
            # Log the summary request
            debug_url = summary_url + "?" + "&".join([f"{k}={v}" for k, v in summary_params.items() if k != "api_key"])
            logger.info(f"Requesting NCBI summary: {debug_url}")
            
            summary_response = await client.get(summary_url, params=summary_params)
            summary_response.raise_for_status()
            
            # Log response details
            logger.info(f"NCBI summary response status: {summary_response.status_code}, content length: {len(summary_response.content)}")
            
            # Save response content to debug
            summary_content = summary_response.text
            try:
                summaries = summary_response.json()
                
                # Debug the structure of the summaries response
                logger.info(f"Summary response keys: {list(summaries.keys())}")
                
                # NCBI changed their API response format, handle both old and new
                if "result" in summaries:
                    result_data = summaries.get("result", {})
                    
                    # Further debug the result structure
                    if isinstance(result_data, dict):
                        logger.info(f"Result data keys: {list(result_data.keys())}")
                        
                        # Handle v2 format where 'uids' is a separate key
                        if "uids" in result_data:
                            process_ids = result_data.get("uids", [])
                            logger.info(f"Processing {len(process_ids)} IDs from 'uids' key")
                        else:
                            # Handle v1 format
                            process_ids = ids
                            logger.info(f"Processing {len(process_ids)} IDs from search results")
                    else:
                        logger.error(f"Unexpected result_data type: {type(result_data)}")
                        # Try to handle array-based response
                        if isinstance(result_data, list) and len(result_data) > 0:
                            process_ids = [item.get("uid", "") for item in result_data if "uid" in item]
                            logger.info(f"Processing {len(process_ids)} IDs from list-based result")
                        else:
                            process_ids = ids
                            logger.warning("Falling back to IDs from search result")
                else:
                    # Handle completely different format
                    logger.warning("Response doesn't contain 'result' key. Inspecting structure...")
                    logger.info(f"Summary response structure: {str(summaries)[:500]}...")
                    
                    # Try to extract a list of results if it's a direct array
                    if isinstance(summaries, list):
                        result_data = {str(item.get("uid", i)): item for i, item in enumerate(summaries) if "uid" in item}
                        process_ids = list(result_data.keys())
                        logger.info(f"Extracted {len(process_ids)} IDs from list-based response")
                    else:
                        # Last resort: use the original search IDs
                        result_data = {}
                        process_ids = ids
                        logger.warning("Could not parse summary response. Using search IDs as fallback.")
                
                # If we still don't have a valid result_data, log and return
                if not result_data:
                    logger.warning("No result data obtained from summary response.")
                    # Save the full response for debugging
                    logger.debug(f"Full summary response: {summary_content}")
                    return results
                    
            except Exception as e:
                logger.error(f"Error parsing NCBI summary response: {str(e)}")
                logger.error(f"Summary content: {summary_content[:500]}...")
                return results
            
            # Process each result
            for id in process_ids:
                str_id = str(id)
                if str_id in result_data:
                    summary = result_data[str_id]
                elif id in result_data:
                    summary = result_data[id]
                else:
                    logger.warning(f"ID {id} not found in summary data.")
                    continue
                
                # Verify we have a valid summary object
                if not isinstance(summary, dict):
                    logger.warning(f"Summary for ID {id} is not a dictionary: {type(summary)}")
                    continue
                
                try:
                    # MODIFICACIÓN PRINCIPAL: Get FULL sequence instead of just preview
                    enforce_ncbi_rate_limit()  # Apply rate limiting before next request
                    
                    efetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
                    efetch_params = {
                        "db": "nucleotide",
                        "id": id,
                        "rettype": "fasta",
                        "retmode": "text"
                        # REMOVED: "seq_start": "1", "seq_stop": "20" to get full sequence
                    }
                    
                    # Add NCBI parameters
                    efetch_params = add_ncbi_params(efetch_params)
                    
                    # Log the fetch request
                    debug_url = efetch_url + "?" + "&".join([f"{k}={v}" for k, v in efetch_params.items() if k != "api_key"])
                    logger.info(f"Requesting NCBI full sequence: {debug_url}")
                    
                    efetch_response = await client.get(efetch_url, params=efetch_params)
                    efetch_response.raise_for_status()
                    
                    # Get response data
                    fasta_content = efetch_response.text
                    logger.info(f"Fetched full sequence for ID {id}, content length: {len(fasta_content)}")
                    
                    # Extract full sequence and create preview
                    lines = fasta_content.split("\n")
                    full_sequence = ""
                    sequence_preview = ""
                    
                    if len(lines) > 1:
                        # Skip the header line and get full sequence
                        full_sequence = "".join(lines[1:]).replace(" ", "").replace("\n", "")
                        # Create preview from first 20 characters of full sequence
                        sequence_preview = full_sequence[:20] if full_sequence else ""
                    
                    # Get sequence title - handle different summary formats
                    title = None
                    if "title" in summary:
                        title = summary.get("title")
                    elif "caption" in summary:
                        title = summary.get("caption")
                    elif "title" in summary.get("subtype", {}):
                        title = summary.get("subtype", {}).get("title")
                    else:
                        # Try to find any field that might be a title
                        title_fields = ["name", "description", "accession", "taxname"]
                        for field in title_fields:
                            if field in summary:
                                title = summary.get(field)
                                break
                    
                    if not title:
                        title = f"Sequence {id}"
                    
                    # Get organism - handle different summary formats
                    organism = None
                    if "organism" in summary:
                        organism = summary.get("organism")
                    elif "taxonomy" in summary:
                        organism = summary.get("taxonomy")
                    elif "organism" in summary.get("subdata", {}):
                        organism = summary.get("subdata", {}).get("organism")
                    else:
                        # Try to find any field that might be an organism
                        organism_fields = ["taxname", "organism_name", "species", "strain"]
                        for field in organism_fields:
                            if field in summary:
                                organism = summary.get(field)
                                break
                    
                    if not organism:
                        organism = "Unknown"
                    
                    # Get sequence length - use actual sequence length if available
                    length = len(full_sequence) if full_sequence else 0
                    
                    # Fallback to summary length if sequence length is 0
                    if length == 0:
                        if "length" in summary:
                            length = summary.get("length")
                        elif "slen" in summary:
                            length = summary.get("slen")
                        elif "sequence_length" in summary:
                            length = summary.get("sequence_length")
                        else:
                            # Try to parse length from other fields
                            for key, value in summary.items():
                                if isinstance(value, (int, float)) and "len" in key.lower():
                                    length = value
                                    break
                    
                    # Determine if it's DNA or RNA
                    is_rna = False
                    if isinstance(title, str) and title.lower().find("rna") >= 0:
                        is_rna = True
                    elif full_sequence and "u" in full_sequence.lower() and "t" not in full_sequence.lower():
                        is_rna = True
                    
                    # MODIFICACIÓN: Include full sequence in result
                    results.append(SearchResult(
                        id=id,
                        name=title,
                        organism=organism,
                        length=length,
                        type="rna" if is_rna else "dna",
                        preview=sequence_preview,
                        sequence=full_sequence if full_sequence else None  # NUEVO: secuencia completa
                    ))
                    
                    logger.info(f"Added sequence result with full sequence: {id} ({title[:30]}...) - {len(full_sequence)} characters")
                    
                except Exception as e:
                    logger.error(f"Error processing sequence ID {id}: {str(e)}")
                    
                    # Si falla obtener la secuencia completa, al menos agregar el resultado sin ella
                    try:
                        # Get basic info from summary for fallback result
                        title = summary.get("title", f"Sequence {id}")
                        organism = summary.get("organism", "Unknown")
                        length = summary.get("length", 0)
                        
                        results.append(SearchResult(
                            id=id,
                            name=title,
                            organism=organism,
                            length=length,
                            type="dna",  # Default to DNA
                            preview="",  # Empty preview if sequence fetch failed
                            sequence=None  # No sequence available
                        ))
                        
                        logger.warning(f"Added result without sequence for ID {id}")
                        
                    except Exception as fallback_error:
                        logger.error(f"Could not add even basic result for ID {id}: {str(fallback_error)}")
                        
    except Exception as e:
        logger.error(f"Error searching NCBI nucleotide: {str(e)}", exc_info=True)
    
    logger.info(f"NCBI nucleotide search completed, found {len(results)} results")
    return results

async def search_uniprot(client, query):
    """Buscar secuencias de proteínas en UniProt con secuencias completas"""
    results = []
    try:
        uniprot_url = f"https://rest.uniprot.org/uniprotkb/search"
        uniprot_params = {
            "query": query,
            "format": "json",
            "size": "5"
        }
        
        logger.info(f"Requesting UniProt search: {uniprot_url}?{uniprot_params}")
        
        uniprot_response = await client.get(uniprot_url, params=uniprot_params)
        uniprot_response.raise_for_status()
        
        uniprot_data = uniprot_response.json()
        uniprot_results = uniprot_data.get("results", [])
        
        logger.info(f"UniProt search returned {len(uniprot_results)} results")
        
        for item in uniprot_results:
            try:
                # Get sequence accession
                accession = item.get("primaryAccession")
                if not accession:
                    logger.warning("No primaryAccession found in UniProt result")
                    continue
                
                # MODIFICACIÓN: Get full sequence directly from UniProt
                sequence_url = f"https://rest.uniprot.org/uniprotkb/{accession}.fasta"
                logger.info(f"Requesting UniProt sequence: {sequence_url}")
                
                sequence_response = await client.get(sequence_url)
                sequence_response.raise_for_status()
                
                fasta_content = sequence_response.text
                
                # Extract full sequence and create preview
                lines = fasta_content.split("\n")
                full_sequence = ""
                sequence_preview = ""
                
                if len(lines) > 1:
                    # Skip the header line and get full sequence
                    full_sequence = "".join(lines[1:]).replace(" ", "").replace("\n", "")
                    # Create preview from first 20 characters
                    sequence_preview = full_sequence[:20] if full_sequence else ""
                
                # Get name
                name = "Unknown protein"
                protein_desc = item.get("proteinDescription", {})
                if protein_desc:
                    if protein_desc.get("recommendedName", {}).get("fullName", {}).get("value"):
                        name = protein_desc["recommendedName"]["fullName"]["value"]
                    elif protein_desc.get("submissionNames") and len(protein_desc["submissionNames"]) > 0:
                        if protein_desc["submissionNames"][0].get("fullName", {}).get("value"):
                            name = protein_desc["submissionNames"][0]["fullName"]["value"]
                
                # Get organism
                organism = "Unknown"
                if item.get("organism", {}).get("scientificName"):
                    organism = item["organism"]["scientificName"]
                
                # Get sequence length - use actual sequence length if available
                length = len(full_sequence) if full_sequence else 0
                
                # Fallback to summary length if sequence length is 0
                if length == 0 and item.get("sequence", {}).get("length"):
                    length = item["sequence"]["length"]
                
                # MODIFICACIÓN: Include full sequence in result
                results.append(SearchResult(
                    id=accession,
                    name=name,
                    organism=organism,
                    length=length,
                    type="protein",
                    preview=sequence_preview,
                    sequence=full_sequence if full_sequence else None  # NUEVO: secuencia completa
                ))
                
                logger.info(f"Added protein result with full sequence: {accession} ({name[:30]}...) - {len(full_sequence)} characters")
                
            except Exception as e:
                logger.warning(f"Error processing UniProt result: {str(e)}")
                
                # Si falla obtener la secuencia completa, al menos agregar el resultado básico
                try:
                    accession = item.get("primaryAccession", "unknown")
                    name = "Unknown protein"
                    organism = "Unknown"
                    length = 0
                    
                    # Try to get basic info even if sequence fetch failed
                    protein_desc = item.get("proteinDescription", {})
                    if protein_desc and protein_desc.get("recommendedName", {}).get("fullName", {}).get("value"):
                        name = protein_desc["recommendedName"]["fullName"]["value"]
                    
                    if item.get("organism", {}).get("scientificName"):
                        organism = item["organism"]["scientificName"]
                    
                    if item.get("sequence", {}).get("length"):
                        length = item["sequence"]["length"]
                    
                    results.append(SearchResult(
                        id=accession,
                        name=name,
                        organism=organism,
                        length=length,
                        type="protein",
                        preview="",  # Empty preview if sequence fetch failed
                        sequence=None  # No sequence available
                    ))
                    
                    logger.warning(f"Added basic result without sequence for UniProt entry {accession}")
                    
                except Exception as fallback_error:
                    logger.error(f"Could not add even basic result for UniProt entry: {str(fallback_error)}")
                    
    except Exception as e:
        logger.error(f"Error searching UniProt: {str(e)}")
    
    logger.info(f"UniProt search completed, found {len(results)} results")
    return results

@router.get("/fetch", response_model=SequenceResponse)
async def fetch_sequence(
    id: str = Query(..., description="Sequence identifier"),
    database: str = Query(..., description="Database type ('dna', 'rna', or 'protein')"),
    tool_context: Optional[str] = Query(None, description="Tool context (alignment, blast, etc.)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch a complete sequence by ID
    """
    try:
        # Apply rate limiting (5 requests per minute)
        if not check_rate_limit(current_user.id, "fetch_sequence", 5, 60):
            raise HTTPException(
                status_code=429, 
                detail="Rate limit exceeded. Try again later."
            )
        
        logger.info(f"Sequence fetch requested: id='{id}', database='{database}', tool_context='{tool_context}'")
        
        # Validate database parameter
        if database not in ["dna", "rna", "protein"]:
            raise HTTPException(status_code=400, detail="Invalid database parameter. Must be 'dna', 'rna', or 'protein'")
        
        sequence = ""
        is_nucleotide = database in ["dna", "rna"]
        
        # Check if it's a UniProt ID (format usually like P12345)
        is_uniprot_id = False
        if database == "protein" and (
            id.startswith(("P", "Q", "O")) and 
            len(id) >= 6 and
            id[1].isdigit()
        ):
            is_uniprot_id = True
        
        async with httpx.AsyncClient(timeout=15.0) as client:
            if database == "protein" and is_uniprot_id:
                # Fetch from UniProt
                url = f"https://rest.uniprot.org/uniprotkb/{id}.fasta"
                response = await client.get(url)
                response.raise_for_status()
                
                fasta_content = response.text
                
                # Parse FASTA to extract sequence (skip header line)
                lines = fasta_content.split("\n")
                if len(lines) > 1:
                    sequence = "".join(lines[1:]).replace(" ", "")
            else:
                # Fetch from NCBI
                enforce_ncbi_rate_limit()  # Apply rate limiting before NCBI request
                
                efetch_url = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
                efetch_params = {
                    "db": "nucleotide" if is_nucleotide else "protein",
                    "id": id,
                    "rettype": "fasta",
                    "retmode": "text"
                }
                
                # Add NCBI parameters
                efetch_params = add_ncbi_params(efetch_params)
                
                response = await client.get(efetch_url, params=efetch_params)
                response.raise_for_status()
                
                fasta_content = response.text
                
                # Parse FASTA to extract sequence (skip header line)
                lines = fasta_content.split("\n")
                if len(lines) > 1:
                    sequence = "".join(lines[1:]).replace(" ", "")
        
        if not sequence:
            raise HTTPException(status_code=404, detail="Sequence not found")
        
        logger.info(f"Sequence fetched successfully: id='{id}', length={len(sequence)}")
        return {"sequence": sequence}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching sequence: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching sequence: {str(e)}")

async def make_ncbi_request(client, url, params, operation_name="NCBI request", max_retries=3, timeout=30.0):
    """
    Función centralizada para realizar peticiones a NCBI con reintentos
    y manejo de errores mejorado
    
    Args:
        client: Cliente httpx
        url: URL de la petición
        params: Parámetros de la petición
        operation_name: Nombre de la operación para logs
        max_retries: Número máximo de reintentos
        timeout: Tiempo máximo de espera para la petición
        
    Returns:
        Respuesta de la petición si es exitosa, None en caso de error
    """
    # Asegurar que tenemos los parámetros de NCBI
    params = add_ncbi_params(params)
    
    # Aplicar límite de velocidad
    enforce_ncbi_rate_limit()
    
    # Log para depuración
    debug_url = url + "?" + "&".join([f"{k}={v}" for k, v in params.items() if k != "api_key"])
    logger.info(f"Iniciando {operation_name}: {debug_url}")
    
    # Intentar la petición con reintentos
    for attempt in range(1, max_retries + 1):
        try:
            response = await client.get(
                url, 
                params=params, 
                timeout=timeout,
                follow_redirects=True  # Seguir redirecciones automáticamente
            )
            
            # Verificar si tenemos una respuesta exitosa
            response.raise_for_status()
            
            # Log de éxito
            logger.info(f"{operation_name} exitoso en intento {attempt}, estado: {response.status_code}")
            
            return response
            
        except httpx.HTTPStatusError as e:
            # Error HTTP (4xx o 5xx)
            logger.error(
                f"{operation_name} error HTTP ({attempt}/{max_retries}): "
                f"{e.response.status_code} - {e.response.text[:200]}"
            )
            
            if e.response.status_code == 429:  # Too Many Requests
                # Esperar más tiempo antes del siguiente intento
                wait_time = 2 ** attempt  # Backoff exponencial: 2, 4, 8 segundos
                logger.info(f"Rate limit alcanzado, esperando {wait_time}s antes de reintentar...")
                await asyncio.sleep(wait_time)
            elif e.response.status_code >= 500:  # Error del servidor
                # Podemos reintentar para errores del servidor
                wait_time = 2 ** attempt
                logger.info(f"Error del servidor, esperando {wait_time}s antes de reintentar...")
                await asyncio.sleep(wait_time)
            else:
                # Para otros errores (400, 403, etc.), no tiene sentido reintentar
                logger.error(f"Error client-side, no se reintentará: {e}")
                return None
                
        except httpx.TimeoutException:
            # Error de timeout
            logger.error(f"{operation_name} timeout en intento {attempt}/{max_retries}")
            # Incrementar el timeout en cada intento
            timeout = timeout * 1.5
            
        except Exception as e:
            # Otro tipo de error
            logger.error(f"{operation_name} error en intento {attempt}/{max_retries}: {str(e)}")
            
        # Si llegamos aquí, hubo un error. Esperar antes de reintentar
        if attempt < max_retries:
            wait_time = 1 * attempt  # Esperar más tiempo en cada intento
            logger.info(f"Esperando {wait_time}s antes del reintento {attempt+1}...")
            await asyncio.sleep(wait_time)
    
    # Si llegamos aquí, se agotaron los reintentos
    logger.error(f"{operation_name} falló después de {max_retries} intentos")
    return None