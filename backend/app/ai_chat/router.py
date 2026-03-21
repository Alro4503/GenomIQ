from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.ai_chat.schemas import (
    ChatRequest,
    ChatResponse,
    ChatConversationResponse,
    ChatConversationDetail,
    ChatMessageResponse
)
from app.ai_chat.service import ChatService
from app.auth.models import User
from app.database import get_db
from app.security import get_current_user


router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/conversations", response_model=List[ChatConversationResponse])
async def get_conversations(
    tool_context: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtiene las conversaciones del usuario actual, opcionalmente filtradas por herramienta."""
    if tool_context:
        conversations = await ChatService.get_conversations_by_tool(db, current_user.id, tool_context)
    else:
        conversations = await ChatService.get_conversations(db, current_user.id)
    return conversations


@router.get("/conversations/{conversation_id}", response_model=ChatConversationDetail)
async def get_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtiene una conversación específica con sus mensajes."""
    conversation = await ChatService.get_conversation(db, conversation_id, current_user.id)
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada"
        )
    
    # Obtener los mensajes de la conversación
    messages = await ChatService.get_conversation_messages(db, conversation_id, current_user.id)
    
    # Construir respuesta detallada
    response = ChatConversationDetail.model_validate(conversation)
    response.messages = messages
    
    return response


@router.delete("/conversations/{conversation_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_conversation(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Elimina (desactiva) una conversación."""
    success = await ChatService.delete_conversation(db, conversation_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada"
        )
    
    return None


@router.put("/conversations/{conversation_id}", response_model=ChatConversationResponse)
async def update_conversation(
    conversation_id: int,
    title: str = Query(..., description="Nuevo título para la conversación"),
    tool_context: Optional[str] = Query(None, description="Contexto de herramienta opcional"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Actualiza el título y/o el contexto de herramienta de una conversación."""
    conversation = await ChatService.update_conversation(db, conversation_id, current_user.id, title, tool_context)
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada"
        )
    
    return conversation


@router.post("/message", response_model=ChatResponse)
async def send_message(
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Envía un mensaje y obtiene respuesta de la IA."""
    assistant_message, error = await ChatService.process_message(db, chat_request, current_user)
    
    if error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error
        )
    
    return ChatResponse(
        message=assistant_message.content,
        conversation_id=assistant_message.conversation_id,
        message_id=assistant_message.id,
        ai_provider=assistant_message.ai_provider or "unknown",
        recommended_tools=assistant_message.recommended_tools
    )


@router.get("/conversations/{conversation_id}/messages", response_model=List[ChatMessageResponse])
async def get_conversation_messages(
    conversation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Obtiene todos los mensajes de una conversación."""
    # Verificar que la conversación existe y pertenece al usuario
    conversation = await ChatService.get_conversation(db, conversation_id, current_user.id)
    
    if not conversation:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Conversación no encontrada"
        )
    
    messages = await ChatService.get_conversation_messages(db, conversation_id, current_user.id)
    return messages

@router.post("/ephemeral", response_model=ChatResponse)
async def send_ephemeral_message(
    chat_request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Envía un mensaje y obtiene respuesta de la IA sin guardar la conversación en la base de datos.
    Útil para consultas específicas como búsqueda de secuencias que no necesitan persistencia.
    """
    # Obtener respuesta sin guardar en base de datos
    ai_response, error = await ChatService.process_ephemeral_message(db, chat_request, current_user)
    
    if error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=error
        )
    
    return ChatResponse(
        message=ai_response.get("content", ""),
        conversation_id=0,  # ID ficticio ya que no hay conversación real
        message_id=0,       # ID ficticio ya que no hay mensaje real
        ai_provider=ai_response.get("ai_provider", "unknown"),
        recommended_tools=ai_response.get("recommended_tools")
    )