from fastapi import APIRouter

# Import all tool routers
from app.tools.annotation.router import router as annotation_router
from app.tools.blast.router import router as blast_router
from app.tools.sequences.router import router as sequences_router  # Importar el router de secuencias

router = APIRouter(prefix="/tools", tags=["tools"])

# Include routers
router.include_router(annotation_router)
router.include_router(blast_router)
router.include_router(sequences_router)  # Incluir el router de secuencias

# Comment out the routers that don't exist yet
# router.include_router(alignment_router)
# router.include_router(translation_router)