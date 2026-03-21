from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, Dict, Any
from datetime import datetime  # Add this import

from app.database import get_db
from app.auth.models import User
from app.security import get_current_user, pwd_context, verify_password, get_password_hash
from app.ai_chat.service_stream import StreamingChatService
import jwt
from app.config import settings

router = APIRouter(prefix="/chat", tags=["chat-websocket"])

# Conexiones WebSocket activas
active_connections: Dict[str, WebSocket] = {}

async def get_user_from_token(token: str, db: Session) -> Optional[User]:
    """
    Obtiene usuario desde JWT token para WebSocket.
    
    Args:
        token: Token JWT de autenticación
        db: Sesión de base de datos
        
    Returns:
        Usuario autenticado o None si el token no es válido
    """
    try:
        # Decodificar token
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        
        if not user_id:
            return None
            
        # Buscar usuario en DB
        user = db.query(User).filter(User.id == int(user_id)).first()
        return user
    except Exception:
        return None

@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket, 
    token: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """
    Endpoint WebSocket para streaming de respuestas del chat.
    
    Args:
        websocket: Conexión WebSocket
        token: Token JWT de autenticación (query param)
        db: Sesión de base de datos
    """
    # Autenticación
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
        
    user = await get_user_from_token(token, db)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return
    
    # Aceptar conexión
    await websocket.accept()
    
    # Guardar conexión activa
    connection_id = f"user_{user.id}_{id(websocket)}"
    active_connections[connection_id] = websocket
    
    try:
        # Bucle de recepción de mensajes
        while True:
            # Recibir mensaje como JSON
            try:
                data = await websocket.receive_json()
            except Exception as e:
                # Error al recibir/parsear JSON
                print(f"Error al recibir JSON: {str(e)}")
                await websocket.send_json({
                    "event": "error",
                    "message": "Formato de mensaje inválido"
                })
                continue
            
            # Procesar tipos de mensaje
            if data.get("type") == "chat_message":
                # Validar datos necesarios
                if "message" not in data:
                    await websocket.send_json({
                        "event": "error",
                        "message": "El campo 'message' es obligatorio"
                    })
                    continue
                
                # Procesar y enviar respuesta en streaming
                await StreamingChatService.stream_chat_response(
                    websocket=websocket,
                    db=db,
                    user=user,
                    conversation_id=data.get("conversation_id"),
                    message=data.get("message", ""),
                    tool_context=data.get("tool_context")
                )
            elif data.get("type") == "ping":
                # Manejar pings para mantener conexión viva
                await websocket.send_json({"type": "pong", "timestamp": str(datetime.now())})
            else:
                # Tipo de mensaje desconocido
                await websocket.send_json({
                    "event": "error",
                    "message": f"Tipo de mensaje desconocido: {data.get('type')}"
                })
            
    except WebSocketDisconnect:
        # Eliminar conexión cuando el cliente se desconecta
        if connection_id in active_connections:
            del active_connections[connection_id]
    except Exception as e:
        # Manejar otros errores
        print(f"Error en WebSocket: {str(e)}")
        try:
            await websocket.send_json({"event": "error", "message": str(e)})
        except:
            pass
        
        # Limpiar conexión en caso de error
        if connection_id in active_connections:
            del active_connections[connection_id]