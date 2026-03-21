from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Float
from sqlalchemy.orm import relationship
from datetime import datetime

from app.database import Base
from app.auth.models import User

class BlastJob(Base):
    __tablename__ = "blast_jobs"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    sequence = Column(Text, nullable=False)
    database = Column(String(100), nullable=False)
    program = Column(String(50), nullable=False)
    evalue = Column(Float, default=0.01)
    max_hits = Column(Integer, default=10)
    output_format = Column(String(20), default="xml")
    use_remote_api = Column(Boolean, default=True)
    task_id = Column(String(100), nullable=True)
    status = Column(String(50), default="pending")  # pending, running, completed, failed
    result_file = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="blast_jobs")