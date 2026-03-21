from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime
import asyncio
import logging

from app.database import get_db
from app.auth.models import User
from app.security import get_current_user
from app.tools.blast import service
from app.tools.blast.schemas import (
    BlastCreate,
    BlastResponse,
    BlastStatusResponse,
    BlastResultsResponse,
    BlastStatusUpdate
)

router = APIRouter(prefix="/blast", tags=["blast"])

logger = logging.getLogger(__name__)

@router.post("/search", response_model=BlastResponse)
async def create_blast_search(
    blast_data: BlastCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Crea una nueva búsqueda BLAST
    
    Args:
        blast_data: Datos de la búsqueda
        db: Sesión de base de datos
        current_user: Usuario actual
        
    Returns:
        BlastResponse: Información del trabajo creado
    """
    return await service.create_blast_job(db, blast_data, current_user.id)

@router.get("/jobs", response_model=List[BlastResponse])
def get_blast_jobs(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene todos los trabajos BLAST del usuario actual
    
    Args:
        skip: Registros a omitir (paginación)
        limit: Límite de registros
        db: Sesión de base de datos
        current_user: Usuario actual
        
    Returns:
        List[BlastResponse]: Lista de trabajos BLAST
    """
    return service.get_user_blast_jobs(db, current_user.id, skip, limit)

@router.get("/jobs/{job_id}", response_model=BlastResponse)
def get_blast_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene información de un trabajo BLAST específico
    
    Args:
        job_id: ID del trabajo
        db: Sesión de base de datos
        current_user: Usuario actual
        
    Returns:
        BlastResponse: Información del trabajo
    """
    return service.get_blast_job(db, job_id, current_user.id)

@router.get("/jobs/{job_id}/status", response_model=BlastStatusResponse)
async def get_blast_job_status(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene el estado actual de un trabajo BLAST
    
    Args:
        job_id: ID del trabajo
        db: Sesión de base de datos
        current_user: Usuario actual
        
    Returns:
        BlastStatusResponse: Estado actual del trabajo
    """
    return await service.get_blast_job_status(db, job_id, current_user.id)

@router.get("/jobs/{job_id}/results", response_model=BlastResultsResponse)
def get_blast_results(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Obtiene los resultados completos de un trabajo BLAST
    
    Args:
        job_id: ID del trabajo
        db: Sesión de base de datos
        current_user: Usuario actual
        
    Returns:
        BlastResultsResponse: Resultados completos
    """
    return service.get_blast_results(db, job_id, current_user.id)
@router.get("/jobs/{job_id}/export/{format}")
def export_blast_results(
    job_id: int,
    format: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Exporta los resultados BLAST en diferentes formatos
    """
    if format not in ['xml', 'json', 'csv', 'fasta']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato no válido. Use: xml, json, csv, fasta"
        )
    
    # Obtener trabajo
    job = service.get_blast_job(db, job_id, current_user.id)
    
    if job.status != "completed":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Los resultados no están disponibles todavía"
        )
    
    # Obtener resultados
    results = service.get_blast_results(db, job_id, current_user.id)
    
    # Generar contenido según formato
    content = service.export_results_format(results, format, job)
    
    # Configurar headers para descarga
    from fastapi.responses import Response
    
    filename = f"blast-results-{job_id}-{datetime.now().strftime('%Y%m%d')}.{format}"
    
    mime_types = {
        'xml': 'text/xml',
        'json': 'application/json', 
        'csv': 'text/csv',
        'fasta': 'text/plain'
    }
    
    return Response(
        content=content,
        media_type=mime_types[format],
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
    
@router.delete("/jobs/{job_id}")
def delete_blast_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Elimina un trabajo BLAST
    
    Args:
        job_id: ID del trabajo
        db: Sesión de base de datos
        current_user: Usuario actual
        
    Returns:
        Dict[str, str]: Mensaje de confirmación
    """
    return service.delete_blast_job(db, job_id, current_user.id)

# Gestor de conexiones WebSocket
class WebSocketManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"Cliente WebSocket conectado: {client_id}")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"Cliente WebSocket desconectado: {client_id}")
    
    async def send_json(self, client_id: str, message: Dict[str, Any]):
        if client_id in self.active_connections:
            await self.active_connections[client_id].send_json(message)

# Instancia del gestor WebSocket
websocket_manager = WebSocketManager()

@router.websocket("/ws/{client_id}")
async def websocket_blast_endpoint(websocket: WebSocket, client_id: str, db: Session = Depends(get_db)):
    """
    Endpoint WebSocket para búsquedas BLAST con actualizaciones en tiempo real
    """
    await websocket_manager.connect(websocket, client_id)
    
    try:
        # Esperar los parámetros de búsqueda
        search_params = await websocket.receive_json()
        
        try:
            # Validar autenticación
            user_id = search_params.get("user_id")
            token = search_params.get("token")
            
            if not user_id or not token:
                await websocket_manager.send_json(client_id, {
                    "type": "error",
                    "message": "Usuario no autenticado - faltan credenciales"
                })
                return
            
            # Verificar token (simplificado - en producción usar verificación completa)
            try:
                # Aquí deberías verificar el token JWT
                user_id = int(user_id)
            except (ValueError, TypeError):
                await websocket_manager.send_json(client_id, {
                    "type": "error",
                    "message": "ID de usuario inválido"
                })
                return
            
            # Limpiar y validar secuencia
            sequence = search_params.get("sequence", "").strip()
            if not sequence:
                await websocket_manager.send_json(client_id, {
                    "type": "error",
                    "message": "La secuencia no puede estar vacía"
                })
                return
            
            # Limpiar secuencia
            clean_sequence = re.sub(r'\s+', '', sequence.upper())
            if len(clean_sequence) < 10:
                await websocket_manager.send_json(client_id, {
                    "type": "error", 
                    "message": "La secuencia debe tener al menos 10 caracteres válidos"
                })
                return
            
            # Convertir a modelo BlastCreate con secuencia limpia
            blast_data = BlastCreate(
                sequence=clean_sequence,  # Usar secuencia limpia
                database=search_params.get("database", "nt"),
                program=search_params.get("program", "blastn"),
                evalue=float(search_params.get("evalue", 0.01)),
                max_hits=int(search_params.get("max_hits", 10)),
                output_format=search_params.get("output_format", "xml"),
                use_remote_api=bool(search_params.get("use_remote_api", True))
            )
            
            # Notificar inicio
            await websocket_manager.send_json(client_id, {
                "type": "status",
                "status": "STARTING",
                "message": "Iniciando búsqueda BLAST...",
                "completion_percent": 0
            })
            
            # Crear trabajo
            job = await service.create_blast_job(db, blast_data, user_id)
            
            # Notificar que se ha creado el trabajo
            await websocket_manager.send_json(client_id, {
                "type": "status",
                "status": "QUEUED",
                "message": "Búsqueda añadida a la cola",
                "job_id": job.id,
                "task_id": job.task_id,
                "completion_percent": 5
            })
            
            # Monitorear estado y enviar actualizaciones
            last_status = None
            last_percent = 0
            max_iterations = 300  # Máximo 10 minutos (300 * 2 segundos)
            iteration = 0
            
            while iteration < max_iterations:
                try:
                    # Obtener estado actual
                    status_data = await service.get_blast_job_status(db, job.id, user_id)
                    
                    current_status = status_data.get("status", "")
                    current_percent = status_data.get("completion_percent", 0)
                    
                    # Solo enviar actualización si hay cambios significativos
                    if current_status != last_status or current_percent > last_percent + 5:
                        await websocket_manager.send_json(client_id, {
                            "type": "status",
                            "status": current_status,
                            "message": status_data.get("message", ""),
                            "job_id": job.id,
                            "task_id": job.task_id,
                            "completion_percent": current_percent
                        })
                        
                        last_status = current_status
                        last_percent = current_percent
                    
                    # Si terminó (con éxito o error), enviar resultados y salir
                    if current_status == "COMPLETED":
                        # Obtener resultados completos
                        results = service.get_blast_results(db, job.id, user_id)
                        
                        await websocket_manager.send_json(client_id, {
                            "type": "results",
                            "status": "COMPLETED",
                            "message": "Búsqueda completada con éxito",
                            "job_id": job.id,
                            "task_id": job.task_id,
                            "results": results.get("results", {}),
                            "completion_percent": 100
                        })
                        break
                    elif current_status in ["ERROR", "FAILED", "TIMEOUT"]:
                        await websocket_manager.send_json(client_id, {
                            "type": "error",
                            "message": status_data.get("message", "Error desconocido"),
                            "job_id": job.id,
                            "task_id": job.task_id
                        })
                        break
                    
                    # Pausa antes de la siguiente verificación
                    await asyncio.sleep(2)
                    iteration += 1
                    
                except Exception as status_error:
                    logger.error(f"Error al obtener estado: {str(status_error)}")
                    await asyncio.sleep(2)
                    iteration += 1
                    continue
            
            # Si se agotó el tiempo máximo
            if iteration >= max_iterations:
                await websocket_manager.send_json(client_id, {
                    "type": "error",
                    "message": "Tiempo de espera agotado para la búsqueda",
                    "job_id": job.id,
                    "task_id": job.task_id
                })
                
        except ValueError as ve:
            logger.error(f"Error de validación en WebSocket: {str(ve)}")
            await websocket_manager.send_json(client_id, {
                "type": "error",
                "message": f"Error de validación: {str(ve)}"
            })
        except Exception as e:
            logger.error(f"Error en WebSocket: {str(e)}")
            await websocket_manager.send_json(client_id, {
                "type": "error",
                "message": f"Error: {str(e)}"
            })
    except WebSocketDisconnect:
        websocket_manager.disconnect(client_id)
    except Exception as e:
        logger.error(f"Error crítico en WebSocket: {str(e)}")
        try:
            await websocket_manager.send_json(client_id, {
                "type": "error",
                "message": "Error de conexión"
            })
        except:
            pass
    finally:
        websocket_manager.disconnect(client_id)