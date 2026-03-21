from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
import logging

from app.database import get_db
from app.auth.models import User
from app.security import get_current_user
from app.tools.annotation import service
from app.tools.annotation.schemas import AnnotationRequest

# Configurar logger
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/annotation", tags=["annotation"])

@router.post("/annotate", response_model=List[dict])
async def annotate_directly(
    request_data: AnnotationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Direct annotation without saving job (for frontend immediate use)"""
    if not request_data.sequence.sequence_data and not request_data.sequence.sequence_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either sequence_data or sequence_id must be provided"
        )
    
    logger.info(f"Received annotation request: {request_data.settings.database}")
    
    try:
        # Procesar según la base de datos seleccionada
        if request_data.settings.database == "uniprot":
            features = await service.process_uniprot_annotation_direct(
                sequence_data=request_data.sequence.sequence_data,
                sequence_id=request_data.sequence.sequence_id,
                sequence_type=request_data.settings.sequenceType
            )
        elif request_data.settings.database == "pfam":
            features = await service.process_pfam_annotation_direct(
                sequence_data=request_data.sequence.sequence_data,
                sequence_id=request_data.sequence.sequence_id,
                sequence_type=request_data.settings.sequenceType
            )
        elif request_data.settings.database == "prosite":
            features = await service.process_prosite_annotation_direct(
                sequence_data=request_data.sequence.sequence_data,
                sequence_type=request_data.settings.sequenceType
            )
        elif request_data.settings.database == "genbank":
            features = await service.process_genbank_annotation_direct(
                sequence_data=request_data.sequence.sequence_data,
                sequence_id=request_data.sequence.sequence_id,
                sequence_type=request_data.settings.sequenceType
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported database: {request_data.settings.database}"
            )
        
        # Filtrar resultados según preferencias del usuario
        filtered_features = []
        for feature in features:
            feature_type = feature.get("type")
            if (feature_type == "domain" and request_data.settings.showFeatures.get("domains", True)) or \
               (feature_type == "motif" and request_data.settings.showFeatures.get("motifs", True)) or \
               (feature_type == "modification" and request_data.settings.showFeatures.get("modifications", True)) or \
               (feature_type == "variant" and request_data.settings.showFeatures.get("variants", True)):
                filtered_features.append(feature)
        
        logger.info(f"Returning {len(filtered_features)} features")
        return filtered_features
    
    except Exception as e:
        logger.error(f"Error processing annotation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )