from pydantic_settings import BaseSettings
from typing import Optional, List

class Settings(BaseSettings):
    PROJECT_NAME: str = "GenomIQ"
    PROJECT_VERSION: str = "0.1.0"
    PROJECT_DESCRIPTION: str = "Plataforma bioinformática con asistencia de IA"
    PROJECT_WEBSITE_URL: str = "https://genomiq.cat"
    
    # Environment
    ENVIRONMENT: str = "development"
    
    # Base URLs
    FRONTEND_BASE_URL: str = "http://localhost:3000"
    BACKEND_BASE_URL: str = "http://localhost:8000"
    
    # Database settings
    DATABASE_URL: str = "postgresql://genomiq:1234@db:5432/genomiq"
    
    # JWT settings
    SECRET_KEY: str = "supersecretkey"  # Replace with env variable in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # CORS settings
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "https://genomiq.cat"]
    
    # Google OAuth settings
    GOOGLE_CLIENT_ID: str = "yourgoogleclientid"
    GOOGLE_CLIENT_SECRET: str = "yourgoogleclientsecret"
    
    @property
    def GOOGLE_REDIRECT_URI(self) -> str:
        """Determine the redirect URI based on environment"""
        if self.ENVIRONMENT == "production":
            return f"{self.PROJECT_WEBSITE_URL}/auth/google/callback"
        return f"{self.FRONTEND_BASE_URL}/auth/google/callback"
    
    OPENROUTER_API_KEY: str = "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"
    
    # NCBI API settings
    NCBI_API_KEY: str = "1e551885b073dc1eefab4e406ddd59a2a609"  # Add your NCBI API key here
    NCBI_TOOL_NAME: str = "GenomIQ"
    NCBI_EMAIL: str = "vmadarnasinfo@gmail.com"  # Use your contact email
    NCBI_MAX_REQUESTS_PER_SECOND: int = 3  # Default without API key
    
    @property
    def NCBI_RATE_LIMIT(self) -> int:
        """Determine the rate limit based on whether an API key is provided"""
        if self.NCBI_API_KEY:
            return 10  # With API key
        return 3  # Without API key
    
    # AI Provider settings
    DEFAULT_AI_PROVIDER: str = "openrouter"
    AI_PROVIDERS_CONFIG: dict = {
        "openrouter": {
            "active": True,
            "priority": 1,
            "daily_limit": 100000
        },
        "huggingface": {
            "active": True,
            "priority": 2,
            "daily_limit": 10000
        },
        "deepinfra": {
            "active": True,
            "priority": 3,
            "daily_limit": 10000
        },
        "cohere": {
            "active": True,
            "priority": 4,
            "daily_limit": 5000
        }
    }
    
    # Sistema de chat IA
    AI_SYSTEM_PROMPT: str = """
    Eres GenomIQ AI, un asistente especializado en bioinformática dentro de la plataforma GenomIQ.

    ### Sobre GenomIQ:
    GenomIQ es una plataforma integral de análisis genómico diseñada para investigadores, profesionales de la salud y bioinformáticos. Ofrece herramientas avanzadas y visuales para el procesamiento y la interpretación de datos genómicos.

    ### Funcionalidades principales disponibles:
    - Búsqueda BLAST.
    - Alineamiento de Secuencias Múltiples (MSA).
    - Traducción de Secuencias Nucleotídicas a Proteicas.
    - Visualización Molecular 3D.
    - Anotación Funcional y Estructural de Secuencias.

    ### Tu rol como asistente IA:
    Debes asistir a los usuarios en:
    - La comprensión de conceptos clave de genómica y bioinformática.
    - La navegación y uso eficiente de las herramientas disponibles en la plataforma.
    - La interpretación precisa y contextualizada de los resultados obtenidos.
    - La provisión de información científica clara, verificada y relevante.

    ### Reglas y restricciones:
    - No debes inventar información ni asumir hechos no verificados.
    - Todas las respuestas deben ser de alta calidad, científicamente sólidas.
    - Sé siempre útil, claro, profesional y amable en tus respuestas.
    - Debes responder siempre en el idioma que el usuario te hable.
    - Ten en cuenta que las recomendaciones de herramientas siempre se pondrán al final así que no las intercales con el texto.
    """
    
    # Configuración de generación IA
    AI_TEMPERATURE: float = 0.7
    AI_MAX_TOKENS: int = 1000
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
