from fastapi import FastAPI, Depends, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import logging
import asyncio

from app.auth import router as auth_router
from app.ai_chat import router as chat_router
from app.ai_chat import websocket_router
from app.tools import router as tools_router
from app.config import settings
from app.database import init_db
from app.tools.blast.queue_manager import start_queue_system, stop_queue_system  # Importamos las funciones

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    description=settings.PROJECT_DESCRIPTION,
    version=settings.PROJECT_VERSION
)

# Add CORS middleware - MUST BE FIRST
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global exception handler for better error responses
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error. Please try again later."}
    )

# Root endpoint
@app.get("/")
def read_root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API",
        "version": settings.PROJECT_VERSION
    }

# Health check endpoint
@app.get("/health")
def health_check():
    return {"status": "healthy"}

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    try:
        logger.info("Initializing database...")
        init_db()
        logger.info("Database initialized successfully.")
        
        # Iniciar el sistema de colas BLAST
        logger.info("Starting BLAST queue system...")
        await start_queue_system()
        logger.info("BLAST queue system started successfully.")
        # 
    except Exception as e:
        logger.error(f"Failed to initialize services: {str(e)}", exc_info=True)

# Cleanup on shutdown
@app.on_event("shutdown")
async def shutdown_event():
    try:
        # Detener el sistema de colas BLAST
        logger.info("Stopping BLAST queue system...")
        await stop_queue_system()
        logger.info("BLAST queue system stopped successfully.")
    except Exception as e:
        logger.error(f"Error during shutdown: {str(e)}", exc_info=True)

# Include routers
app.include_router(auth_router.router, prefix="/api")
app.include_router(chat_router.router, prefix="/api")
app.include_router(tools_router.router, prefix="/api")
app.include_router(websocket_router.router, prefix="/api")