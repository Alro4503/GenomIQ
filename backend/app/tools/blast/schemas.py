from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict, Any
from datetime import datetime
import re

class BlastBase(BaseModel):
    sequence: str = Field(..., description="Secuencia de consulta para la búsqueda BLAST")
    database: str = Field(..., description="Nombre de la base de datos BLAST para buscar")
    program: str = Field("blastn", description="Programa BLAST a utilizar (blastn, blastp, blastx, tblastn, tblastx)")
    evalue: float = Field(0.01, description="Valor E (expectation value) para filtrar resultados")
    max_hits: int = Field(10, description="Número máximo de hits a devolver")
    output_format: str = Field("xml", description="Formato de salida (json, tabular, xml)")
    use_remote_api: bool = Field(True, description="Si es True, usa la API remota de NCBI; si es False, usa BLAST local")

    @validator('sequence')
    def validate_sequence(cls, v):
        if not v or not v.strip():
            raise ValueError("La secuencia no puede estar vacía")
        
        # Limpiar espacios y saltos de línea usando re.sub (Python)
        clean_sequence = re.sub(r'\s+', '', v.upper())
        
        if len(clean_sequence) < 10:
            raise ValueError("La secuencia debe tener al menos 10 caracteres válidos")
        
        # Validar caracteres válidos según el contexto
        # Permitir tanto nucleótidos como aminoácidos para flexibilidad
        valid_nucleotides = set("ACGTUNRYSWKMBDHV-")  # Incluye códigos ambiguos IUPAC
        valid_amino_acids = set("ACDEFGHIKLMNPQRSTVWYUBZXJ*-")  # Incluye códigos ambiguos
        
        sequence_chars = set(clean_sequence)
        
        # Si contiene principalmente nucleótidos válidos o aminoácidos válidos
        if not (sequence_chars.issubset(valid_nucleotides) or sequence_chars.issubset(valid_amino_acids)):
            raise ValueError("La secuencia contiene caracteres no válidos. Use códigos IUPAC estándar.")
        
        return clean_sequence  # Retornar la secuencia limpia

    @validator('program')
    def validate_program(cls, v):
        valid_programs = ["blastn", "blastp", "blastx", "tblastn", "tblastx"]
        if v not in valid_programs:
            raise ValueError(f"Programa inválido. Debe ser uno de: {', '.join(valid_programs)}")
        return v

    @validator('database')
    def validate_database(cls, v):
        valid_databases = ["nt", "nr", "refseq_rna", "refseq_protein", "swissprot", "pdbaa", "ref_euk_rep_genomes"]
        if v not in valid_databases:
            raise ValueError(f"Base de datos inválida. Debe ser una de: {', '.join(valid_databases)}")
        return v

    @validator('output_format')
    def validate_output_format(cls, v):
        valid_formats = ["xml", "json", "tabular"]
        if v not in valid_formats:
            raise ValueError(f"Formato de salida inválido. Debe ser uno de: {', '.join(valid_formats)}")
        return v

    @validator('evalue')
    def validate_evalue(cls, v):
        if v <= 0:
            raise ValueError("El valor E debe ser mayor que 0")
        if v > 1000:
            raise ValueError("El valor E no puede ser mayor que 1000")
        return v

    @validator('max_hits')
    def validate_max_hits(cls, v):
        if v < 1:
            raise ValueError("El número máximo de hits debe ser al menos 1")
        if v > 5000:
            raise ValueError("El número máximo de hits no puede exceder 5000")
        return v

class BlastCreate(BlastBase):
    """Schema para crear una nueva búsqueda BLAST"""
    pass

class BlastResponse(BlastBase):
    """Schema para la respuesta de un trabajo BLAST"""
    id: int
    user_id: int
    status: str
    task_id: Optional[str] = None
    result_file: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class BlastStatusUpdate(BaseModel):
    """Schema para actualizar el estado de un trabajo BLAST"""
    status: str
    completion_percent: Optional[int] = None
    message: Optional[str] = None
    result_file: Optional[str] = None

    @validator('completion_percent')
    def validate_completion_percent(cls, v):
        if v is not None:
            if v < 0 or v > 100:
                raise ValueError("El porcentaje de completitud debe estar entre 0 y 100")
        return v

    @validator('status')
    def validate_status(cls, v):
        valid_statuses = ["pending", "running", "completed", "failed", "error", "timeout", "queued", "starting", "submitting", "downloading"]
        if v.lower() not in valid_statuses:
            raise ValueError(f"Estado inválido. Debe ser uno de: {', '.join(valid_statuses)}")
        return v.lower()

class BlastStatusResponse(BaseModel):
    """Schema para la respuesta del estado de un trabajo BLAST"""
    id: int
    task_id: Optional[str]
    status: str
    message: Optional[str] = None
    completion_percent: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    sequence_preview: Optional[str] = None
    results: Optional[Dict[str, Any]] = None
    
    class Config:
        from_attributes = True

class BlastHit(BaseModel):
    """Schema para un hit individual de BLAST"""
    id: str
    title: str
    length: Optional[str] = None
    bit_score: Optional[str] = None
    evalue: Optional[str] = None
    identity: Optional[str] = None
    query_coverage: Optional[str] = None

class BlastSummary(BaseModel):
    """Schema para el resumen de resultados BLAST"""
    hit_count: int
    hits: List[BlastHit]
    program: Optional[str] = None
    database: Optional[str] = None
    query_length: Optional[int] = None

class BlastResults(BaseModel):
    """Schema para los resultados completos de BLAST"""
    summary: BlastSummary
    content: Optional[str] = None  # Contenido XML/JSON original
    format: str = "xml"

class BlastResultsResponse(BaseModel):
    """Schema para la respuesta de resultados BLAST"""
    job_id: int
    task_id: str
    status: str
    results: BlastResults
    
    class Config:
        from_attributes = True

class BlastExportRequest(BaseModel):
    """Schema para solicitudes de exportación"""
    format: str
    include_alignments: bool = False
    
    @validator('format')
    def validate_export_format(cls, v):
        valid_formats = ["xml", "json", "csv", "fasta"]
        if v.lower() not in valid_formats:
            raise ValueError(f"Formato de exportación inválido. Debe ser uno de: {', '.join(valid_formats)}")
        return v.lower()

class BlastWebSocketMessage(BaseModel):
    """Schema para mensajes WebSocket de BLAST"""
    type: str  # 'status', 'results', 'error'
    status: Optional[str] = None
    message: Optional[str] = None
    job_id: Optional[int] = None
    task_id: Optional[str] = None
    completion_percent: Optional[int] = None
    results: Optional[Dict[str, Any]] = None

    @validator('type')
    def validate_message_type(cls, v):
        valid_types = ["status", "results", "error", "info"]
        if v.lower() not in valid_types:
            raise ValueError(f"Tipo de mensaje inválido. Debe ser uno de: {', '.join(valid_types)}")
        return v.lower()

class BlastWebSocketRequest(BaseModel):
    """Schema para solicitudes WebSocket de BLAST"""
    user_id: int
    job_id: Optional[int] = None
    client_id: Optional[str] = None
    token: Optional[str] = None
    sequence: Optional[str] = None
    database: Optional[str] = None
    program: Optional[str] = None
    evalue: Optional[float] = None
    max_hits: Optional[int] = None
    output_format: Optional[str] = None
    use_remote_api: Optional[bool] = None

    @validator('user_id')
    def validate_user_id(cls, v):
        if v <= 0:
            raise ValueError("El ID de usuario debe ser un número positivo")
        return v

class BlastJobFilter(BaseModel):
    """Schema para filtrar trabajos BLAST"""
    status: Optional[str] = None
    program: Optional[str] = None
    database: Optional[str] = None
    date_from: Optional[datetime] = None
    date_to: Optional[datetime] = None
    
    @validator('status')
    def validate_filter_status(cls, v):
        if v is not None:
            valid_statuses = ["pending", "running", "completed", "failed", "error", "timeout"]
            if v.lower() not in valid_statuses:
                raise ValueError(f"Estado de filtro inválido. Debe ser uno de: {', '.join(valid_statuses)}")
        return v.lower() if v else v

class BlastPaginationParams(BaseModel):
    """Schema para parámetros de paginación"""
    skip: int = Field(0, ge=0, description="Número de registros a omitir")
    limit: int = Field(100, ge=1, le=1000, description="Número máximo de registros a devolver")

class BlastErrorResponse(BaseModel):
    """Schema para respuestas de error"""
    error: str
    detail: Optional[str] = None
    error_code: Optional[str] = None
    timestamp: datetime = Field(default_factory=datetime.now)

class BlastValidationError(BaseModel):
    """Schema para errores de validación específicos"""
    field: str
    message: str
    received_value: Optional[str] = None

class BlastBatchRequest(BaseModel):
    """Schema para solicitudes por lotes"""
    sequences: List[str]
    database: str
    program: str = "blastn"
    evalue: float = 0.01
    max_hits: int = 10
    output_format: str = "xml"
    use_remote_api: bool = True
    
    @validator('sequences')
    def validate_sequences(cls, v):
        if not v:
            raise ValueError("La lista de secuencias no puede estar vacía")
        if len(v) > 50:
            raise ValueError("No se pueden procesar más de 50 secuencias a la vez")
        
        # Validar cada secuencia
        for i, seq in enumerate(v):
            clean_seq = re.sub(r'\s+', '', seq.upper())
            if len(clean_seq) < 10:
                raise ValueError(f"La secuencia {i+1} debe tener al menos 10 caracteres válidos")
        
        return v

class BlastStatistics(BaseModel):
    """Schema para estadísticas de BLAST"""
    total_jobs: int
    completed_jobs: int
    failed_jobs: int
    pending_jobs: int
    average_completion_time: Optional[float] = None
    most_used_program: Optional[str] = None
    most_used_database: Optional[str] = None

# Schemas adicionales para análisis y reportes
class BlastPerformanceMetrics(BaseModel):
    """Schema para métricas de rendimiento"""
    job_id: int
    submission_time: datetime
    start_time: Optional[datetime] = None
    completion_time: Optional[datetime] = None
    execution_duration: Optional[float] = None  # en segundos
    queue_wait_time: Optional[float] = None  # en segundos
    sequence_length: int
    hits_found: int

class BlastSystemStatus(BaseModel):
    """Schema para el estado del sistema BLAST"""
    queue_size: int
    active_jobs: int
    system_load: float
    available_databases: List[str]
    service_status: str  # 'online', 'maintenance', 'offline'
    last_updated: datetime

# Configuración adicional para todos los modelos
class BlastConfigBase(BaseModel):
    """Configuración base para todos los modelos BLAST"""
    
    class Config:
        # Permitir campos extra para compatibilidad futura
        extra = "forbid"
        # Validar asignaciones
        validate_assignment = True
        # Usar enum por valor
        use_enum_values = True
        # Configuración de JSON
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }