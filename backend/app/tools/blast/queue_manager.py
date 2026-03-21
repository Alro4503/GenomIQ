"""
Módulo de gestión de colas para BLAST API.
Gestiona solicitudes BLAST de manera eficiente.
"""

import asyncio
import time
import uuid
import json
import logging
import aiohttp
from typing import Dict, Any, List, Optional, Tuple
import threading
from datetime import datetime
import os
import re

# Configurar logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("blast_queue")

# Constantes
MAX_QUEUE_SIZE = 100  # Número máximo de tareas en cola
MAX_CONCURRENT_TASKS = 5  # Número máximo de tareas ejecutándose simultáneamente
TASK_TIMEOUT = 1800  # 30 minutos para completar una tarea
POLL_INTERVAL = 10  # 10 segundos entre verificaciones de estado
HTTP_TIMEOUT = 60  # 60 segundos para peticiones HTTP individuales
RESULTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results")

# Asegurar que el directorio de resultados existe
os.makedirs(RESULTS_DIR, exist_ok=True)

# Estado global
task_status: Dict[str, Dict[str, Any]] = {}
task_lock = threading.Lock()

# Clase de gestión de cola
class BlastQueue:
    def __init__(self):
        self.queue = asyncio.Queue(maxsize=MAX_QUEUE_SIZE)
        self.active_tasks: Dict[str, asyncio.Task] = {}
        self.task_details: Dict[str, Dict[str, Any]] = {}
        self._running = False
        self._worker_task = None
        self.lock = asyncio.Lock()
    
    async def start(self):
        """Inicia el procesador de cola"""
        if self._running:
            return
        
        self._running = True
        self._worker_task = asyncio.create_task(self._process_queue())
        logger.info("Sistema de cola iniciado")
    
    async def stop(self):
        """Detiene el procesador de cola"""
        if not self._running:
            return
        
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        logger.info("Sistema de cola detenido")
    
    async def add_task(self, task_type: str, params: Dict[str, Any]) -> str:
        """
        Añade una nueva tarea a la cola
        
        Args:
            task_type: Tipo de tarea ('blast_search', 'database_download', etc.)
            params: Parámetros específicos de la tarea
            
        Returns:
            str: ID único de la tarea
        """
        # Generar ID único
        task_id = str(uuid.uuid4())
        
        # Preparar información de la tarea
        task_info = {
            "id": task_id,
            "type": task_type,
            "params": params,
            "status": "QUEUED",
            "message": "En cola de espera",
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat(),
            "completion_percent": 0
        }
        
        # Almacenar detalles de la tarea
        async with self.lock:
            self.task_details[task_id] = task_info
        
        # Actualizar estado global para acceso desde endpoints
        with task_lock:
            task_status[task_id] = task_info.copy()
        
        # Añadir a la cola
        try:
            await self.queue.put((task_id, task_type, params))
            logger.info(f"Tarea {task_id} añadida a la cola")
            return task_id
        except asyncio.QueueFull:
            # Si la cola está llena, eliminar la información de la tarea
            async with self.lock:
                if task_id in self.task_details:
                    del self.task_details[task_id]
            
            with task_lock:
                if task_id in task_status:
                    del task_status[task_id]
            
            logger.error("Cola llena, no se puede añadir más tareas")
            raise ValueError("Cola de tareas llena")
    
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Obtiene el estado actual de una tarea
        
        Args:
            task_id: ID de la tarea
            
        Returns:
            Optional[Dict[str, Any]]: Información de estado de la tarea o None si no existe
        """
        with task_lock:
            return task_status.get(task_id)
    
    async def _process_queue(self):
        """Procesa las tareas en la cola de manera continua"""
        logger.info("Iniciando procesador de cola")
        
        while self._running:
            # Verificar si podemos procesar más tareas
            if len(self.active_tasks) >= MAX_CONCURRENT_TASKS:
                # Esperar a que alguna tarea termine
                await asyncio.sleep(1)
                continue
            
            try:
                # Obtener la siguiente tarea (con timeout para poder cancelar)
                task_id, task_type, params = await asyncio.wait_for(
                    self.queue.get(), timeout=1
                )
                
                # Actualizar estado
                self._update_task_status(task_id, "STARTING", "Iniciando tarea...", 5)
                
                # Iniciar procesamiento según tipo de tarea
                if task_type == "blast_search":
                    task = asyncio.create_task(self._process_blast_search(task_id, params))
                elif task_type == "database_download":
                    task = asyncio.create_task(self._process_database_download(task_id, params))
                else:
                    self._update_task_status(task_id, "ERROR", f"Tipo de tarea desconocido: {task_type}", 0)
                    self.queue.task_done()
                    continue
                
                # Registrar tarea activa
                async with self.lock:
                    self.active_tasks[task_id] = task
                
                # Configurar callback para cuando termine
                task.add_done_callback(lambda t, tid=task_id: asyncio.create_task(self._task_done(tid, t)))
                
            except asyncio.TimeoutError:
                # Timeout del get() - solo para permitir cancelación
                pass
            except asyncio.CancelledError:
                # El procesador ha sido cancelado
                logger.info("Procesador de cola cancelado")
                break
            except Exception as e:
                logger.error(f"Error en procesador de cola: {str(e)}")
                await asyncio.sleep(1)  # Pausa para evitar bucle de errores rápidos
    
    async def _task_done(self, task_id: str, task: asyncio.Task):
        """Callback para cuando una tarea termina"""
        # Quitar de las tareas activas
        async with self.lock:
            if task_id in self.active_tasks:
                del self.active_tasks[task_id]
        
        # Marcar como completada en la cola
        self.queue.task_done()
        
        # Registrar excepciones no manejadas
        if not task.cancelled():
            try:
                exc = task.exception()
                if exc:
                    logger.error(f"Tarea {task_id} falló con excepción: {str(exc)}")
                    self._update_task_status(task_id, "ERROR", f"Error no controlado: {str(exc)}", 0)
            except asyncio.InvalidStateError:
                # La tarea aún no ha terminado, lo cual no debería ocurrir
                pass
    
    def _update_task_status(self, task_id: str, status: str, message: str, completion_percent: int, 
                           results: Optional[Dict[str, Any]] = None):
        """Actualiza el estado de una tarea"""
        with task_lock:
            if task_id in task_status:
                task_status[task_id].update({
                    "status": status,
                    "message": message,
                    "completion_percent": completion_percent,
                    "updated_at": datetime.now().isoformat()
                })
                
                if results:
                    task_status[task_id]["results"] = results
    
    # Implementaciones específicas de procesamiento de tareas
    async def _process_blast_search(self, task_id: str, params: Dict[str, Any]):
        """
        Procesa una búsqueda BLAST
        
        Esta versión usa la API remota de NCBI, pero se puede expandir para manejar
        búsquedas locales también.
        """
        try:
            # Extraer parámetros
            sequence = params.get("sequence", "")
            database = params.get("database", "nt")
            program = params.get("program", "blastn")
            evalue = params.get("evalue", 0.01)
            max_hits = params.get("max_hits", 10)
            use_remote_api = params.get("use_remote_api", True)
            job_id = params.get("job_id")
            
            # Si es API remota, usar la implementación existente
            if use_remote_api:
                await self._run_remote_blast_search(
                    task_id, sequence, database, program, evalue, max_hits, job_id
                )
            else:
                # Para búsquedas locales, se podría implementar otra función
                self._update_task_status(
                    task_id, "ERROR", "Búsquedas BLAST locales no implementadas en este sistema de colas", 0
                )
        except Exception as e:
            logger.error(f"Error en búsqueda BLAST {task_id}: {str(e)}")
            self._update_task_status(task_id, "ERROR", f"Error: {str(e)}", 0)
    
    async def _run_remote_blast_search(self, task_id: str, sequence: str, database: str, 
                                  program: str, evalue: float, max_hits: int, job_id: int = None):
        """Ejecuta una búsqueda BLAST usando la API remota de NCBI"""
        NCBI_BLAST_URL = "https://blast.ncbi.nlm.nih.gov/Blast.cgi"
        
        # Limpiar secuencia antes de enviar
        clean_sequence = re.sub(r'\s+', '', sequence.upper())
        
        # Validar longitud mínima
        if len(clean_sequence) < 10:
            self._update_task_status(
                task_id, "ERROR", "La secuencia debe tener al menos 10 caracteres válidos", 0
            )
            return
        
        # Mapeos de programa y base de datos
        ncbi_program_map = {
            "blastn": "blastn",
            "blastp": "blastp", 
            "blastx": "blastx",
            "tblastn": "tblastn",
            "tblastx": "tblastx"
        }
        
        ncbi_database_map = {
            "ref_euk_rep_genomes": "ref_euk_rep_genomes",
            "nt": "nt",
            "nr": "nr", 
            "refseq_rna": "refseq_rna",
            "refseq_protein": "refseq_protein",
            "swissprot": "swissprot",
            "pdbaa": "pdbaa"
        }
        
        # Actualizar estado: Enviando solicitud
        self._update_task_status(
            task_id, "SUBMITTING", "Enviando solicitud a NCBI BLAST...", 10
        )
        
        try:
            # Configurar timeout para la sesión HTTP
            timeout_obj = aiohttp.ClientTimeout(total=HTTP_TIMEOUT)
            
            # Paso 1: Enviar la búsqueda
            async with aiohttp.ClientSession(timeout=timeout_obj) as session:
                # Parámetros para poner en cola la búsqueda
                params = {
                    "CMD": "Put",
                    "PROGRAM": ncbi_program_map.get(program, "blastn"),
                    "DATABASE": ncbi_database_map.get(database, "nt"),
                    "QUERY": clean_sequence,  # Usar secuencia limpia
                    "EXPECT": evalue,
                    "HITLIST_SIZE": max_hits,
                    "FILTER": "T",
                    "FORMAT_TYPE": "XML"  # XML es más confiable que JSON para parsear
                }
                
                logger.info(f"Enviando búsqueda BLAST: programa={program}, database={database}, secuencia_longitud={len(clean_sequence)}")
                
                async with session.post(NCBI_BLAST_URL, data=params) as response:
                    if response.status != 200:
                        self._update_task_status(
                            task_id, "ERROR", f"Error al enviar solicitud: código {response.status}", 0
                        )
                        return
                    
                    text = await response.text()
                    
                    # Extraer RID y RTOE de la respuesta
                    rid = None
                    rtoe = None
                    for line in text.split("\n"):
                        if "RID =" in line:
                            rid = line.split("=")[1].strip()
                        elif "RTOE =" in line:
                            rtoe = line.split("=")[1].strip()
                    
                    if not rid:
                        self._update_task_status(
                            task_id, "ERROR", "No se pudo obtener el RID de la solicitud NCBI", 0
                        )
                        return
                    
                    # Almacenar tiempo estimado como entero
                    try:
                        rtoe_int = int(rtoe) if rtoe else 60
                    except ValueError:
                        rtoe_int = 60  # Valor predeterminado si no se puede convertir
            
            # Actualizar estado: Búsqueda en progreso
            self._update_task_status(
                task_id, "RUNNING", f"Búsqueda en progreso (RID: {rid})...", 15,
                {"rid": rid, "estimated_time": rtoe_int}
            )
            
            # Paso 2: Monitorear el estado de la búsqueda
            status = "WAITING"
            error_msg = None
            start_time = time.time()
            max_wait_time = TASK_TIMEOUT
            
            while status == "WAITING" and (time.time() - start_time) < max_wait_time:
                # Dormir antes de volver a verificar
                await asyncio.sleep(POLL_INTERVAL)
                
                # Verificar estado
                async with aiohttp.ClientSession(timeout=timeout_obj) as session:
                    check_params = {
                        "CMD": "Get",
                        "FORMAT_OBJECT": "SearchInfo",
                        "RID": rid
                    }
                    
                    async with session.get(NCBI_BLAST_URL, params=check_params) as response:
                        if response.status != 200:
                            self._update_task_status(
                                task_id, "ERROR", f"Error al verificar estado: código {response.status}", 0
                            )
                            return
                        
                        text = await response.text()
                        
                        # Analizar el estado de la respuesta
                        for line in text.split("\n"):
                            if "Status=" in line:
                                if "WAITING" in line:
                                    status = "WAITING"
                                    break
                                elif "FAILED" in line:
                                    status = "FAILED"
                                    error_msg = "La búsqueda falló en NCBI"
                                    break
                                elif "UNKNOWN" in line:
                                    status = "UNKNOWN"
                                    error_msg = "RID no reconocido por NCBI"
                                    break
                                elif "READY" in line:
                                    status = "READY"
                                    break
                
                # Calcular progreso basado en tiempo transcurrido vs tiempo estimado
                elapsed_time = time.time() - start_time
                completion_percent = min(90, 15 + int((elapsed_time / rtoe_int) * 75)) if rtoe_int > 0 else 50
                
                # Actualizar estado
                self._update_task_status(
                    task_id, "RUNNING", f"Búsqueda en progreso ({int(elapsed_time)}s)...", 
                    completion_percent
                )
                
                # Si hay error, detener
                if status in ["FAILED", "UNKNOWN"]:
                    self._update_task_status(
                        task_id, "ERROR", error_msg or f"Error: {status}", 0
                    )
                    return
            
            # Verificar si se agotó el tiempo
            if (time.time() - start_time) >= max_wait_time and status == "WAITING":
                self._update_task_status(
                    task_id, "TIMEOUT", "Tiempo de espera agotado para la búsqueda NCBI", 0
                )
                return
            
            # Paso 3: Si la búsqueda está lista, obtener resultados
            if status == "READY":
                self._update_task_status(
                    task_id, "DOWNLOADING", "Descargando resultados...", 95
                )
                
                # Obtener resultados
                async with aiohttp.ClientSession(timeout=timeout_obj) as session:
                    result_params = {
                        "CMD": "Get",
                        "FORMAT_TYPE": "XML",
                        "RID": rid
                    }
                    
                    async with session.get(NCBI_BLAST_URL, params=result_params) as response:
                        if response.status != 200:
                            self._update_task_status(
                                task_id, "ERROR", f"Error al obtener resultados: código {response.status}", 0
                            )
                            return
                        
                        # Obtener contenido como texto (XML)
                        content_text = await response.text()
                        
                        if not content_text.strip():
                            self._update_task_status(
                                task_id, "ERROR", "Respuesta vacía del servidor NCBI", 0
                            )
                            return
                        
                        # Verificar si el XML contiene errores
                        if "ERROR" in content_text.upper() or "FAILED" in content_text.upper():
                            self._update_task_status(
                                task_id, "ERROR", "Error en los resultados de NCBI BLAST", 0
                            )
                            return
                        
                        # Guardar resultados en archivo
                        result_file = os.path.join(RESULTS_DIR, f"{task_id}.xml")
                        try:
                            with open(result_file, "w", encoding='utf-8') as f:
                                f.write(content_text)
                        except Exception as e:
                            logger.error(f"Error al guardar archivo de resultados: {str(e)}")
                            self._update_task_status(
                                task_id, "ERROR", f"Error al guardar resultados: {str(e)}", 0
                            )
                            return
                        
                        # Extraer información básica del XML para mostrar
                        summary = self._extract_summary_from_xml(content_text)
                        
                        # Preparar resultados
                        results = {
                            "format": "xml",
                            "file_path": result_file,
                            "summary": summary,
                            "job_id": job_id,
                            "rid": rid,
                            "content": content_text  # Incluir contenido para acceso directo
                        }
                        
                        # Actualizar estado final
                        self._update_task_status(
                            task_id, "COMPLETED", "Búsqueda completada con éxito", 100, results
                        )
                        
                        logger.info(f"Búsqueda BLAST completada exitosamente: task_id={task_id}, hits={summary.get('hit_count', 0)}")
        
        except asyncio.TimeoutError:
            self._update_task_status(
                task_id, "TIMEOUT", "Tiempo de espera agotado durante la comunicación con NCBI", 0
            )
        except Exception as e:
            logger.error(f"Error en búsqueda BLAST remota: {str(e)}")
            self._update_task_status(
                task_id, "ERROR", f"Error: {str(e)}", 0
            )

    
    async def _process_database_download(self, task_id: str, params: Dict[str, Any]):
        """Procesa la descarga de una base de datos BLAST"""
        # Implementación futura
        self._update_task_status(
            task_id, "ERROR", "Descarga de bases de datos no implementada en el sistema de colas", 0
        )
    
    def _extract_summary_from_xml(self, xml_content: str) -> Dict[str, Any]:
        """Extrae información básica de los resultados XML de BLAST"""
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
            return {"error": f"Error al analizar XML: {str(e)}"}


# Instancia global del gestor de colas
blast_queue = BlastQueue()

# Función para iniciar el sistema de colas
async def start_queue_system():
    await blast_queue.start()

# Función para detener el sistema de colas
async def stop_queue_system():
    await blast_queue.stop()