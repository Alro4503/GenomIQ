from sqlalchemy import Boolean, Column, DateTime, Integer, String, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=True)  # Puede ser nulo para usuarios OAuth
    full_name = Column(String(255))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    language_preference = Column(String(10), default="en")
    dark_mode = Column(Boolean, default=False)
    
    # Indicador de si la cuenta se creó con OAuth
    is_oauth_account = Column(Boolean, default=False)
    
    # Relaciones
    conversations = relationship("ChatConversation", back_populates="user", cascade="all, delete-orphan")
    oauth_accounts = relationship("OAuthAccount", back_populates="user", cascade="all, delete-orphan")
    blast_jobs = relationship("BlastJob", back_populates="user")

class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(50), nullable=False)  # "google", "facebook", etc.
    provider_user_id = Column(String(255), nullable=False)  # ID del usuario en el proveedor
    access_token = Column(String(1024), nullable=False)
    refresh_token = Column(String(1024), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Índice único para evitar cuentas duplicadas del mismo proveedor
    __table_args__ = (
        {"mysql_charset": "utf8mb4", "mysql_collate": "utf8mb4_unicode_ci"},
    )
    
    # Relación
    user = relationship("User", back_populates="oauth_accounts")