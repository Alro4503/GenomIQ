import os
import re
import uuid
import json
import asyncio
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from datetime import datetime
import logging
from typing import List, Dict, Any, Optional

from app.tools.blast.models import BlastJob
from app.tools.blast.schemas import BlastCreate, BlastStatusUpdate, BlastResponse
from app.tools.blast.queue_manager import blast_queue

logger = logging.getLogger(__name__)

# Ruta para resultados
RESULTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")
os.makedirs(RESULTS_DIR, exist_ok=True)

def validate_blast_params(program: str, database: str, sequence: str) -> Optional[str]:
    """
    Valida la compatibilidad de los parámetros BLAST.
    """
    # Limpiar secuencia primero
    clean_sequence = re.sub(r'\s+', '', sequence.upper())
    
    # Validar longitud mínima de secuencia
    if len(clean_sequence) < 10:
        return "La secuencia es demasiado corta. Debe tener al menos 10 caracteres válidos."
    
    # Validar que la secuencia no tenga caracteres extraños
    valid_nucleotides = set("ACGTUNRYSWKMBDHV-")  # Incluye códigos ambiguos IUPAC
    valid_amino_acids = set("ACDEFGHIKLMNPQRSTVWYUBZXJ*-")  # Incluye códigos ambiguos
    
    sequence_chars = set(clean_sequence)
    
    # Verificar si es principalmente nucleótidos o aminoácidos
    is_nucleotide = sequence_chars.issubset(valid_nucleotides)
    is_amino_acid = sequence_chars.issubset(valid_amino_acids)
    
    if not (is_nucleotide or is_amino_acid):
        return "La secuencia contiene caracteres no válidos. Use códigos IUPAC estándar para nucleótidos (A,C,G,T,U,N) o aminoácidos."
    
    # Validar compatibilidad de programa y tipo de secuencia
    nucleotide_programs = ["blastn", "tblastx"]
    protein_programs = ["blastp", "tblastn"]
    mixed_programs = ["blastx"]  # nucleótidos traducidos contra proteínas
    
    if program in nucleotide_programs and not is_nucleotide:
        return f"El programa {program} espera una secuencia de nucleótidos, pero la secuencia proporcionada parece ser de aminoácidos."
    
    if program in protein_programs and not is_amino_acid:
        return f"El programa {program} espera una secuencia de aminoácidos, pero la secuencia proporcionada parece ser de nucleótidos."
    
    # Validar compatibilidad de programa y base de datos
    nucleotide_dbs = ["nt", "refseq_rna"]
    protein_dbs = ["nr", "refseq_protein", "swissprot", "pdbaa"]
    
    if program == "blastn" and database not in nucleotide_dbs:
        return f"El programa 'blastn' solo es compatible con bases de datos de nucleótidos: {', '.join(nucleotide_dbs)}"
    
    if program == "blastp" and database not in protein_dbs:
        return f"El programa 'blastp' solo es compatible con bases de datos de proteínas: {', '.join(protein_dbs)}"
    
    if program == "blastx" and database not in protein_dbs:
        return f"El programa 'blastx' solo es compatible con bases de datos de proteínas: {', '.join(protein_dbs)}"
    
    if program == "tblastn" and database not in nucleotide_dbs:
        return f"El programa 'tblastn' solo es compatible con bases de datos de nucleótidos: {', '.join(nucleotide_dbs)}"
    
    if program == "tblastx" and database not in nucleotide_dbs:
        return f"El programa 'tblastx' solo es compatible con bases de datos de nucleótidos: {', '.join(nucleotide_dbs)}"
    
    return None  # Sin errores de validación

async def create_blast_job(db: Session, blast_data: BlastCreate, user_id: int) -> BlastJob:
    """
    Crea un nuevo trabajo BLAST y lo añade a la cola de procesamiento
    """
    try:
        # Limpiar secuencia antes de validar
        clean_sequence = re.sub(r'\s+', '', blast_data.sequence.upper())
        
        # Validar parámetros con secuencia limpia
        validation_error = validate_blast_params(
            blast_data.program,
            blast_data.database,
            clean_sequence
        )
        
        if validation_error:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=validation_error)
        
        # Crear trabajo en la base de datos con secuencia limpia
        db_job = BlastJob(
            user_id=user_id,
            sequence=clean_sequence,  # Guardar secuencia limpia
            database=blast_data.database,
            program=blast_data.program,
            evalue=blast_data.evalue,
            max_hits=blast_data.max_hits,
            output_format=blast_data.output_format,
            use_remote_api=blast_data.use_remote_api,
            status="pending"
        )
        
        db.add(db_job)
        db.commit()
        db.refresh(db_job)
        
        # Añadir a la cola de tareas con secuencia limpia
        params = {
            "sequence": clean_sequence,  # Usar secuencia limpia
            "database": blast_data.database,
            "program": blast_data.program,
            "evalue": blast_data.evalue,
            "max_hits": blast_data.max_hits,
            "output_format": blast_data.output_format,
            "use_remote_api": blast_data.use_remote_api,
            "job_id": db_job.id
        }
        
        # Añadir a la cola asíncronamente
        task_id = await blast_queue.add_task("blast_search", params)
        
        # Actualizar el trabajo con el ID de tarea
        db_job.task_id = task_id
        db_job.status = "running"
        db.commit()
        
        return db_job
        
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))
    except Exception as e:
        logger.error(f"Error al crear trabajo BLAST: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al crear trabajo BLAST: {str(e)}"
        )

async def get_blast_job_status(db: Session, job_id: int, user_id: int) -> Dict[str, Any]:
    """
    Obtiene el estado actual de un trabajo BLAST
    
    Args:
        db: Sesión de base de datos
        job_id: ID del trabajo
        user_id: ID del usuario
        
    Returns:
        Dict[str, Any]: Estado del trabajo
    """
    # Obtener trabajo de la base de datos
    job = db.query(BlastJob).filter(
        BlastJob.id == job_id,
        BlastJob.user_id == user_id
    ).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trabajo BLAST con ID {job_id} no encontrado"
        )
    
    # Obtener estado de la cola si está en proceso
    task_status = {}
    if job.task_id and job.status in ["pending", "running"]:
        task_status = await blast_queue.get_task_status(job.task_id) or {}
    
    # Preparar respuesta
    result = {
        "id": job.id,
        "task_id": job.task_id,
        "status": task_status.get("status", job.status),
        "message": task_status.get("message", ""),
        "completion_percent": task_status.get("completion_percent", 0),
        "created_at": job.created_at,
        "updated_at": job.updated_at,
        "sequence_preview": job.sequence[:50] + "..." if len(job.sequence) > 50 else job.sequence
    }
    
    # Si está completado, incluir resultados
    if job.status == "completed" and job.result_file:
        try:
            with open(job.result_file, "r") as f:
                xml_content = f.read()
                
            # Extraer resumen de resultados
            summary = extract_summary_from_xml(xml_content)
            result["results"] = {
                "summary": summary,
                "format": job.output_format
            }
        except Exception as e:
            logger.error(f"Error al leer archivo de resultados: {str(e)}")
    
    # Si hay resultados en task_status, incluirlos
    if task_status and "results" in task_status:
        result["results"] = task_status["results"]
        
        # Si el trabajo está completo, actualizar en la base de datos
        if task_status["status"] == "COMPLETED" and "file_path" in task_status["results"]:
            job.status = "completed"
            job.result_file = task_status["results"]["file_path"]
            db.commit()
    
    return result

def get_user_blast_jobs(db: Session, user_id: int, skip: int = 0, limit: int = 100) -> List[BlastJob]:
    """
    Obtiene todos los trabajos BLAST de un usuario
    
    Args:
        db: Sesión de base de datos
        user_id: ID del usuario
        skip: Número de registros a omitir (paginación)
        limit: Número máximo de registros a devolver
        
    Returns:
        List[BlastJob]: Lista de trabajos BLAST
    """
    return db.query(BlastJob).filter(
        BlastJob.user_id == user_id
    ).order_by(BlastJob.created_at.desc()).offset(skip).limit(limit).all()

def get_blast_job(db: Session, job_id: int, user_id: int) -> BlastJob:
    """
    Obtiene un trabajo BLAST específico
    
    Args:
        db: Sesión de base de datos
        job_id: ID del trabajo
        user_id: ID del usuario
        
    Returns:
        BlastJob: Trabajo BLAST
    """
    job = db.query(BlastJob).filter(
        BlastJob.id == job_id,
        BlastJob.user_id == user_id
    ).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trabajo BLAST con ID {job_id} no encontrado"
        )
        
    return job

def delete_blast_job(db: Session, job_id: int, user_id: int) -> Dict[str, str]:
    """
    Elimina un trabajo BLAST
    
    Args:
        db: Sesión de base de datos
        job_id: ID del trabajo
        user_id: ID del usuario
        
    Returns:
        Dict[str, str]: Mensaje de confirmación
    """
    job = db.query(BlastJob).filter(
        BlastJob.id == job_id,
        BlastJob.user_id == user_id
    ).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trabajo BLAST con ID {job_id} no encontrado"
        )
    
    # Eliminar archivo de resultados si existe
    if job.result_file and os.path.exists(job.result_file):
        try:
            os.remove(job.result_file)
        except Exception as e:
            logger.error(f"Error al eliminar archivo de resultados: {str(e)}")
    
    # Eliminar trabajo de la base de datos
    db.delete(job)
    db.commit()
    
    return {"message": "Trabajo BLAST eliminado correctamente"}

def extract_summary_from_xml(xml_content: str) -> Dict[str, Any]:
    """
    Extrae información resumida de los resultados XML de BLAST
    
    Args:
        xml_content: Contenido XML
        
    Returns:
        Dict[str, Any]: Resumen de resultados
    """
    summary = {
        "hits": []
    }
    
    try:
        # Buscar número de hits
        hit_count_match = re.search(r'<Iteration_hits>(.*?)</Iteration_hits>', xml_content, re.DOTALL)
        
        if hit_count_match:
            hits_section = hit_count_match.group(1)
            hits = re.findall(r'<Hit>(.*?)</Hit>', hits_section, re.DOTALL)
            
            # Procesar cada hit
            for i, hit in enumerate(hits[:5]):  # Limitar a los primeros 5 hits
                hit_info = {}
                
                # Extraer ID
                id_match = re.search(r'<Hit_id>(.*?)</Hit_id>', hit)
                if id_match:
                    hit_info['id'] = id_match.group(1)
                
                # Extraer título/descripción
                def_match = re.search(r'<Hit_def>(.*?)</Hit_def>', hit)
                if def_match:
                    hit_info['title'] = def_match.group(1)
                
                # Extraer longitud
                len_match = re.search(r'<Hit_len>(.*?)</Hit_len>', hit)
                if len_match:
                    hit_info['length'] = len_match.group(1)
                
                # Extraer HSP (high-scoring segment pair)
                hsp_match = re.search(r'<Hsp>(.*?)</Hsp>', hit, re.DOTALL)
                if hsp_match:
                    hsp = hsp_match.group(1)
                    
                    # Bit score
                    bit_match = re.search(r'<Hsp_bit-score>(.*?)</Hsp_bit-score>', hsp)
                    if bit_match:
                        hit_info['bit_score'] = bit_match.group(1)
                    
                    # E-value
                    evalue_match = re.search(r'<Hsp_evalue>(.*?)</Hsp_evalue>', hsp)
                    if evalue_match:
                        hit_info['evalue'] = evalue_match.group(1)
                    
                    # Identity
                    identity_match = re.search(r'<Hsp_identity>(.*?)</Hsp_identity>', hsp)
                    if identity_match:
                        hit_info['identity'] = identity_match.group(1)
                
                summary["hits"].append(hit_info)
            
            summary["hit_count"] = len(hits)
        else:
            summary["hit_count"] = 0
        
        return summary
    except Exception as e:
        logger.error(f"Error al analizar XML: {str(e)}")
        return {"error": f"Error al analizar XML: {str(e)}"}

async def update_blast_job_status(db: Session, job_id: int, status_update: BlastStatusUpdate) -> BlastJob:
    """
    Actualiza el estado de un trabajo BLAST
    
    Args:
        db: Sesión de base de datos
        job_id: ID del trabajo
        status_update: Datos de actualización
        
    Returns:
        BlastJob: Trabajo BLAST actualizado
    """
    job = db.query(BlastJob).filter(BlastJob.id == job_id).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trabajo BLAST con ID {job_id} no encontrado"
        )
    
    # Actualizar campos
    job.status = status_update.status
    if status_update.result_file:
        job.result_file = status_update.result_file
    
    # Commit cambios
    db.commit()
    db.refresh(job)
    
    return job

def get_blast_results(db: Session, job_id: int, user_id: int) -> Dict[str, Any]:
    """
    Obtiene los resultados completos de un trabajo BLAST
    
    Args:
        db: Sesión de base de datos
        job_id: ID del trabajo
        user_id: ID del usuario
        
    Returns:
        Dict[str, Any]: Resultados completos
    """
    job = db.query(BlastJob).filter(
        BlastJob.id == job_id,
        BlastJob.user_id == user_id
    ).first()
    
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trabajo BLAST con ID {job_id} no encontrado"
        )
    
    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los resultados no están disponibles todavía"
        )
    
    if not job.result_file or not os.path.exists(job.result_file):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Archivo de resultados no encontrado"
        )
    
    try:
        with open(job.result_file, "r") as f:
            xml_content = f.read()
        
        # Extraer resumen
        summary = extract_summary_from_xml(xml_content)
        
        # Devolver resultados
        return {
            "job_id": job.id,
            "task_id": job.task_id,
            "status": job.status,
            "results": {
                "summary": summary,
                "content": xml_content,
                "format": job.output_format
            }
        }
    except Exception as e:
        logger.error(f"Error al leer resultados: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al leer resultados: {str(e)}"
        )
def export_results_format(results_data: Dict[str, Any], format: str, job: BlastJob) -> str:
    """
    Exporta los resultados en el formato especificado
    """
    results = results_data.get("results", {})
    summary = results.get("summary", {})
    hits = summary.get("hits", [])
    
    if format == 'xml':
        # Retornar XML original
        return results.get("content", "")
    
    elif format == 'json':
        # Crear JSON estructurado
        export_data = {
            "job_info": {
                "job_id": job.id,
                "program": job.program,
                "database": job.database,
                "evalue": job.evalue,
                "max_hits": job.max_hits,
                "created_at": job.created_at.isoformat(),
                "sequence_length": len(job.sequence)
            },
            "summary": summary,
            "export_timestamp": datetime.now().isoformat()
        }
        return json.dumps(export_data, indent=2)
    
    elif format == 'csv':
        # Crear CSV con hits
        csv_lines = []
        csv_lines.append("Hit_ID,Title,Length,Bit_Score,E_Value,Identity,Query_Coverage")
        
        for hit in hits:
            # Escapar comillas en el título
            title = str(hit.get('title', '')).replace('"', '""')
            line = f'"{hit.get("id", "")}","{title}","{hit.get("length", "")}","{hit.get("bit_score", "")}","{hit.get("evalue", "")}","{hit.get("identity", "")}","{hit.get("query_coverage", "")}"'
            csv_lines.append(line)
        
        return '\n'.join(csv_lines)
    
    elif format == 'fasta':
        # Crear FASTA con hits (nota: las secuencias reales necesitarían extraerse del XML completo)
        fasta_lines = []
        fasta_lines.append(f">Query_Sequence job_id:{job.id} program:{job.program} database:{job.database}")
        
        # Dividir secuencia en líneas de 80 caracteres
        sequence = job.sequence
        for i in range(0, len(sequence), 80):
            fasta_lines.append(sequence[i:i+80])
        
        fasta_lines.append("")  # Línea vacía
        fasta_lines.append(f"# BLAST Results Summary: {len(hits)} hits found")
        fasta_lines.append(f"# Search performed on: {job.created_at.isoformat()}")
        
        for i, hit in enumerate(hits[:10]):  # Limitar a top 10
            fasta_lines.append(f">{hit.get('id', f'hit_{i+1}')} {hit.get('title', 'No description')} | E-value: {hit.get('evalue', 'N/A')} | Bit score: {hit.get('bit_score', 'N/A')}")
            fasta_lines.append("# Sequence data not available in summary - use XML export for full alignment data")
            fasta_lines.append("")
        
        return '\n'.join(fasta_lines)
    
    else:
        raise ValueError(f"Formato no soportado: {format}")
