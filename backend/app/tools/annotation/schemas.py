from pydantic import BaseModel, Field
from typing import Dict

class AnnotationSettings(BaseModel):
    sequenceType: str = Field(..., pattern="^(protein|dna)$")
    database: str = Field(..., pattern="^(uniprot|pfam|prosite|genbank)$")
    showFeatures: Dict[str, bool] = Field(
        default_factory=lambda: {
            "domains": True,
            "motifs": True,
            "modifications": True,
            "variants": True
        }
    )

class SequenceData(BaseModel):
    sequence_data: str | None = None
    sequence_id: str | None = None

class AnnotationRequest(BaseModel):
    settings: AnnotationSettings
    sequence: SequenceData