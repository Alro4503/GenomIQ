from sqlalchemy import Boolean, Column, DateTime, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.database import Base


class AIProvider(Base):
    __tablename__ = "ai_providers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    api_key = Column(String(255))
    base_url = Column(String(255))
    description = Column(Text)
    model_name = Column(String(100))
    is_active = Column(Boolean, default=True)
    priority = Column(Integer, default=0)  # Prioridad para rotación
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relaciones
    usage_stats = relationship("AIProviderUsage", back_populates="provider")


class AIProviderUsage(Base):
    __tablename__ = "ai_provider_usage"

    id = Column(Integer, primary_key=True, index=True)
    provider_id = Column(Integer, ForeignKey("ai_providers.id", ondelete="CASCADE"))
    current_usage = Column(Integer, nullable=False, default=0)
    daily_limit = Column(Integer, nullable=False)
    last_reset = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

    # Relaciones
    provider = relationship("AIProvider", back_populates="usage_stats")


class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    title = Column(String(255), default="Nueva conversación")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    is_active = Column(Boolean, default=True)
    tool_context = Column(String(50), nullable=True)  # Nueva columna para identificar la herramienta
    
    # Relaciones
    user = relationship("User", back_populates="conversations")
    messages = relationship("ChatMessage", back_populates="conversation", cascade="all, delete-orphan")


class ChatMessage(Base):
    __tablename__ = "chat_messages"
    
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("chat_conversations.id", ondelete="CASCADE"))
    role = Column(String(50), nullable=False)  # 'user' o 'assistant'
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    ai_provider = Column(String(100))  # Proveedor utilizado (solo para mensajes del asistente)
    tokens_used = Column(Integer)  # Tokens consumidos (solo para mensajes del asistente)
    recommended_tools = Column(String(255), nullable=True)  # Lista de herramientas recomendadas como cadena separada por comas
    
    # Relaciones
    conversation = relationship("ChatConversation", back_populates="messages")