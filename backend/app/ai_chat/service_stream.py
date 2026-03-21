import json
import re
import asyncio
from typing import AsyncGenerator, List, Dict, Optional, Tuple, Any
from datetime import datetime

import httpx
from sqlalchemy.orm import Session
from fastapi import WebSocket

from app.ai_chat.models import AIProvider, ChatConversation, ChatMessage
from app.auth.models import User
from app.config import settings
from app.ai_chat.service import AIProviderSelection, ChatService

class StreamingChatService:
    """Servicio de chat que permite streaming de respuestas."""
    
    @staticmethod
    async def _call_openrouter_stream(
        provider: AIProvider,
        messages: List[Dict[str, str]]
    ) -> AsyncGenerator[Tuple[str, bool, Optional[str]], None]:
        """
        Realiza llamada a la API de OpenRouter con soporte para streaming.
        Retorna un generador que produce fragmentos de texto.
        
        Args:
            provider: Proveedor de IA a utilizar
            messages: Lista de mensajes para enviar al proveedor
            
        Yields:
            Tupla con el fragmento de texto, bandera que indica si es el final del streaming,
            y un mensaje de error opcional.
        """
        # Detectar si es un prompt de análisis bioinformático
        first_user_message = next((msg["content"] for msg in messages if msg["role"] == "user"), "")
        is_analysis_prompt = StreamingChatService.is_bioinformatic_analysis_prompt(first_user_message)
        
        # Seleccionar modelo basado en el tipo de mensaje
        model = AIProviderSelection.select_openrouter_model(is_analysis_prompt)
            
        # Configurar headers y parámetros
        headers = {
            "Authorization": f"Bearer {provider.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": settings.PROJECT_WEBSITE_URL or "https://genomiq.cat",
            "X-Title": settings.PROJECT_NAME
        }
        
        data = {
            "model": model,
            "messages": messages,
            "temperature": settings.AI_TEMPERATURE,
            "max_tokens": settings.AI_MAX_TOKENS,
            "stream": True  # Habilitar streaming
        }
        
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                async with client.stream(
                    "POST",
                    provider.base_url or "https://openrouter.ai/api/v1/chat/completions",
                    headers=headers,
                    json=data,
                    timeout=300.0
                ) as response:
                    if response.status_code != 200:
                        error_text = await response.aread()
                        yield "", True, f"Error en API de OpenRouter: {error_text.decode()}"
                        return
                    
                    # Procesar el stream
                    buffer = ""
                    async for raw_chunk in response.aiter_raw():
                        chunk_text = raw_chunk.decode('utf-8')
                        buffer += chunk_text
                        
                        # Procesar líneas completas
                        while '\n\n' in buffer:
                            line, buffer = buffer.split('\n\n', 1)
                            if line.startswith('data: '):
                                line = line[6:]  # Quitar 'data: '
                                
                                if line == "[DONE]":
                                    continue
                                
                                try:
                                    chunk_data = json.loads(line)
                                    if 'choices' in chunk_data and len(chunk_data['choices']) > 0:
                                        delta = chunk_data['choices'][0].get('delta', {})
                                        if 'content' in delta and delta['content']:
                                            # Enviar el fragmento de texto
                                            yield delta['content'], False, None
                                except json.JSONDecodeError:
                                    # Ignorar líneas que no son JSON válido
                                    continue
                    
                    # Enviar el último fragmento si queda algo en el buffer
                    if buffer and not buffer.isspace():
                        yield buffer, False, None
                        
                    # Señalar que el streaming ha terminado
                    yield "", True, None
                    
        except Exception as e:
            yield "", True, f"Error durante streaming: {str(e)}"

    @staticmethod
    async def stream_chat_response(
        websocket: WebSocket,
        db: Session,
        user: User,
        conversation_id: Optional[int],
        message: str,
        tool_context: Optional[str] = None
    ) -> None:
        """
        Procesa un mensaje del usuario y envía la respuesta de la IA en streaming a través de WebSocket.
        
        Args:
            websocket: Conexión WebSocket activa
            db: Sesión de base de datos
            user: Usuario autenticado
            conversation_id: ID de la conversación (opcional)
            message: Mensaje del usuario
            tool_context: Contexto de herramienta (opcional)
        """
        try:
            # Verificar si es un mensaje de análisis bioinformático
            is_analysis_prompt = StreamingChatService.is_bioinformatic_analysis_prompt(message)
            
            # Obtener o crear conversación
            if conversation_id:
                conversation = await ChatService.get_conversation(db, conversation_id, user.id)
                if not conversation:
                    await websocket.send_json({"event": "error", "message": "Conversación no encontrada"})
                    return
            else:
                # Crear una nueva conversación, posiblemente con un contexto de herramienta
                conversation = await ChatService.create_conversation(
                    db, 
                    user.id, 
                    "Nueva conversación", 
                    tool_context
                )
            
            # Guardar mensaje del usuario SOLO si no es un prompt de análisis bioinformático
            user_message = None
            if not is_analysis_prompt:
                user_message = ChatMessage(
                    conversation_id=conversation.id,
                    role="user",
                    content=message
                )
                db.add(user_message)
                db.commit()
                db.refresh(user_message)
                
                # Notificar al cliente que el mensaje del usuario fue guardado
                await websocket.send_json({
                    "event": "user_message_saved",
                    "conversation_id": conversation.id,
                    "message_id": user_message.id
                })
            
            # Actualizar timestamp de la conversación
            conversation.updated_at = datetime.now()
            db.commit()
            
            # Seleccionar proveedor de IA
            provider = await AIProviderSelection.select_provider(db)
            if not provider:
                await websocket.send_json({
                    "event": "error",
                    "message": "No hay proveedores de IA disponibles en este momento"
                })
                return
            
            # Obtener contexto de la conversación (mensajes anteriores)
            conversation_messages = await ChatService.get_conversation_messages(db, conversation.id, user.id)
            
            # Añadir información de contexto de herramienta si está disponible
            tool_info = ""
            if conversation.tool_context:
                tool_info = f"[Contexto: La conversación está relacionada con la herramienta {conversation.tool_context}]"
            
            # Preparar mensajes para la API de IA
            formatted_messages = [
                {"role": "system", "content": settings.AI_SYSTEM_PROMPT},
                {"role": "system", "content": "Por favor, responde en el mismo idioma que utilice el usuario en su mensaje."}
            ]
            
            # Añadir contexto de herramienta si está disponible
            if conversation.tool_context:
                tool_context_prompt = f"""
                Esta conversación está ocurriendo en el contexto de la herramienta '{conversation.tool_context}' de GenomIQ.
                Enfoca tus respuestas para ayudar al usuario específicamente con esta herramienta.
                """
                formatted_messages.append({"role": "system", "content": tool_context_prompt})
            
            # Añadir mensaje de sistema para herramientas
            tool_instructions = """
            Cuando consideres apropiado recomendar una herramienta específica al usuario, inserta una etiqueta 
            con el formato [TOOL:nombre_herramienta] directamente donde mencionas la herramienta en tu respuesta.

            Las herramientas disponibles son:
            - [TOOL:blast] - BLAST para búsqueda de secuencias similares
            - [TOOL:alignment] - Alineamiento múltiple de secuencias
            - [TOOL:translation] - Traducción de ADN/ARN a proteína
            - [TOOL:visualization] - Visualización 3D de estructuras
            - [TOOL:annotation] - Anotación funcional de secuencias

            Recomendaciones para el uso de etiquetas:
            1. Inserta las etiquetas JUSTO DESPUÉS de mencionar la herramienta en tu texto
            2. Puedes utilizar las etiquetas en cualquier parte de tu respuesta, no solo al final
            3. Solo recomienda herramientas que sean directamente relevantes para la consulta del usuario
            4. Es posible recomendar la misma herramienta en diferentes partes de la respuesta si es necesario
            5. IMPORTANTE: Siempre coloca las etiquetas en una nueva línea después de mencionar la herramienta

            Ejemplo:
            Si quieres analizar secuencias similares, puedes usar BLAST.
            [TOOL:blast]
            Esta herramienta te permitirá comparar tu secuencia con bases de datos.
            """
            
            formatted_messages.append({"role": "system", "content": tool_instructions})
            
            # Para prompts de análisis bioinformático, usar solo el mensaje actual
            if is_analysis_prompt:
                formatted_messages.append({
                    "role": "user",
                    "content": message
                })
            else:
                # Añadir mensajes de la conversación normal
                for msg in conversation_messages:
                    formatted_messages.append({
                        "role": msg.role,
                        "content": msg.content
                    })
            
            # Iniciar stream y enviar fragmentos de texto
            full_response = ""
            tokens_used = 0  # Estimación
            recommended_tools = []
            
            # Notificar al cliente que la respuesta comienza
            await websocket.send_json({
                "event": "assistant_stream_start",
                "conversation_id": conversation.id
            })
            
            # Obtener respuesta de la IA en streaming
            async for content_chunk, is_done, error in StreamingChatService._call_openrouter_stream(provider, formatted_messages):
                if error:
                    # Enviar el error al cliente
                    await websocket.send_json({
                        "event": "error",
                        "message": error
                    })
                    break
                
                if is_done:
                    # Notificar al cliente que el streaming terminó
                    await websocket.send_json({
                        "event": "assistant_stream_end",
                        "conversation_id": conversation.id
                    })
                    break
                    
                # Enviar fragmento al cliente
                await websocket.send_json({
                    "event": "assistant_stream_chunk",
                    "content": content_chunk
                })
                
                # Acumular respuesta completa
                full_response += content_chunk
                tokens_used += len(content_chunk.split()) / 3  # Estimación aproximada de tokens
                
                # Detectar nuevas herramientas recomendadas
                tool_regex = r'\[TOOL:(blast|alignment|translation|visualization|annotation)\]'
                for match in re.finditer(tool_regex, content_chunk, re.IGNORECASE):
                    tool_id = match[1].lower()
                    if tool_id not in recommended_tools:
                        recommended_tools.append(tool_id)
                        # Notificar al cliente sobre la herramienta recomendada
                        await websocket.send_json({
                            "event": "tool_recommendation",
                            "tool": tool_id
                        })
            
            # Formatear el contenido final para negritas y encabezados
            formatted_content = full_response
            # Reemplazar los formatos Markdown con HTML
            formatted_content = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', formatted_content)
            # Reemplazar los encabezados H3 (###)
            formatted_content = re.sub(r'###\s+(.+?)\s*(\n|$)', r'<h3>\1</h3>\2', formatted_content)
            
            # Guardar respuesta completa en la base de datos
            assistant_message = ChatMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=formatted_content,
                ai_provider=provider.name,
                tokens_used=int(tokens_used),
                recommended_tools=",".join(recommended_tools) if recommended_tools else None
            )
            db.add(assistant_message)
            db.commit()
            db.refresh(assistant_message)
            
            # Actualizar uso del proveedor
            await AIProviderSelection.update_usage(db, provider.id, int(tokens_used))
            
            # Actualizar título de la conversación si es la primera interacción
            if len(conversation_messages) <= 1:  # Solo el mensaje del usuario actual
                if is_analysis_prompt:
                    # Generar un título más adecuado para análisis bioinformático
                    if "BLAST" in message or "blast" in message:
                        title = "Análisis de resultados BLAST"
                    elif "alignment" in message or "alineamiento" in message:
                        title = "Análisis de alineamiento de secuencias"
                    else:
                        title = "Análisis bioinformático"
                else:
                    # Generar título a partir del primer mensaje
                    title = message[:50] + "..." if len(message) > 50 else message
                
                conversation.title = title
                db.commit()
            
            # Notificar al cliente que el mensaje fue guardado con su contenido formateado
            await websocket.send_json({
                "event": "assistant_message_saved",
                "conversation_id": conversation.id,
                "message_id": assistant_message.id,
                "tokens_used": int(tokens_used),
                "content": formatted_content  # Enviar el contenido formateado
            })
            
        except Exception as e:
            # Manejar errores durante el streaming
            await websocket.send_json({
                "event": "error",
                "message": f"Error durante el streaming: {str(e)}"
            })
    @staticmethod
    def is_bioinformatic_analysis_prompt(content: str) -> bool:
        """
        Determina si un mensaje de usuario es un prompt de análisis bioinformático
        que debe ser excluido de la conversación guardada.
        """
        # Patrones para detectar prompts de análisis
        analysis_patterns = [
            # Patrón para prompt de análisis BLAST
            r"As a bioinformatics expert, analyze this (BLAST|blast) search result",
            # Patrón para prompt de análisis de alineamiento
            r"As a bioinformatics expert, analyze this (multiple sequence alignment|MSA)",
            # Detectar formato de detalles común a ambos tipos de análisis
            r"Details:\s*-\s*\w+:.+\s*-\s*\w+:.+\s*-\s*\w+:.+"
        ]
        
        # Verificar si alguno de los patrones está presente en el contenido
        for pattern in analysis_patterns:
            if re.search(pattern, content, re.IGNORECASE | re.DOTALL):
                return True
        
        return False