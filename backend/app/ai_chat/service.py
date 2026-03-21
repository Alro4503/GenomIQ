import random
import re
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple

import httpx
from sqlalchemy.orm import Session

from app.ai_chat.models import AIProvider, AIProviderUsage, ChatConversation, ChatMessage
from app.ai_chat.schemas import ChatRequest
from app.auth.models import User
from app.config import settings


class AIProviderSelection:
    """Clase para seleccionar el proveedor de IA adecuado según prioridad y límites de uso."""
    
    @staticmethod
    async def select_provider(db: Session) -> Optional[AIProvider]:
        """Selecciona un proveedor de IA disponible basado en prioridad y cuota."""
        # Obtener el proveedor OpenRouter activo
        provider = db.query(AIProvider).filter(
            AIProvider.name == "openrouter", 
            AIProvider.is_active == True
        ).first()
        
        if not provider:
            return None
        
        # Verificar si el proveedor tiene cuota disponible
        usage = db.query(AIProviderUsage).filter(AIProviderUsage.provider_id == provider.id).first()
        
        if not usage:
            # Si no existe registro de uso, crear uno
            usage = AIProviderUsage(
                provider_id=provider.id, 
                current_usage=0, 
                daily_limit=settings.AI_PROVIDERS_CONFIG.get("openrouter", {}).get("daily_limit", 100000)
            )
            db.add(usage)
            db.commit()
        
        # Resetear el contador si ha pasado un día
        # Usar datetime.now() con timezone para que sea compatible con last_reset
        if datetime.now(tz=timezone.utc) - usage.last_reset > timedelta(days=1):
            usage.current_usage = 0
            usage.last_reset = datetime.now(tz=timezone.utc)
            db.commit()
        
        # Verificar si hay cuota disponible
        if usage.current_usage < usage.daily_limit:
            return provider
        
        # Si no hay cuota disponible, retornar None
        return None
    
    @staticmethod
    async def update_usage(db: Session, provider_id: int, tokens_used: int) -> None:
        """Actualiza el contador de uso de un proveedor."""
        usage = db.query(AIProviderUsage).filter(AIProviderUsage.provider_id == provider_id).first()
        
        if usage:
            usage.current_usage += tokens_used
            db.commit()
    
    @staticmethod
    def select_openrouter_model(is_analysis_prompt: bool = False) -> str:
        """
        Selecciona un modelo de OpenRouter basado en el tipo de consulta.
        
        Args:
            is_analysis_prompt: Si es True, se selecciona Claude 3 Opus para análisis.
                            Si es False, se usa GPT-3.5 Turbo para chat general.
        """
        if is_analysis_prompt:
            # Para análisis complejos de BLAST y alineamiento
            return "openai/gpt-4.1"
        else:
            # Para consultas generales y chat rápido
            return "openai/gpt-3.5-turbo"


class ChatService:
    """Servicio para gestionar las conversaciones y mensajes de chat con IA."""
    
    @staticmethod
    async def get_conversations(db: Session, user_id: int) -> List[ChatConversation]:
        """Obtener todas las conversaciones activas de un usuario."""
        return db.query(ChatConversation)\
            .filter(ChatConversation.user_id == user_id, ChatConversation.is_active == True)\
            .order_by(ChatConversation.updated_at.desc())\
            .all()
    
    @staticmethod
    async def get_conversations_by_tool(db: Session, user_id: int, tool_context: Optional[str] = None) -> List[ChatConversation]:
        """Obtener conversaciones activas de un usuario, filtradas por herramienta."""
        query = db.query(ChatConversation).filter(
            ChatConversation.user_id == user_id,
            ChatConversation.is_active == True
        )
        
        if tool_context:
            query = query.filter(ChatConversation.tool_context == tool_context)
        
        return query.order_by(ChatConversation.updated_at.desc()).all()
    
    @staticmethod
    async def get_conversation(db: Session, conversation_id: int, user_id: int) -> Optional[ChatConversation]:
        """Obtener una conversación específica."""
        return db.query(ChatConversation)\
            .filter(
                ChatConversation.id == conversation_id,
                ChatConversation.user_id == user_id,
                ChatConversation.is_active == True
            )\
            .first()
    
    @staticmethod
    async def create_conversation(db: Session, user_id: int, title: str = "Nueva conversación", tool_context: Optional[str] = None) -> ChatConversation:
        """Crear una nueva conversación."""
        conversation = ChatConversation(user_id=user_id, title=title, tool_context=tool_context)
        db.add(conversation)
        db.commit()
        db.refresh(conversation)
        return conversation
    
    @staticmethod
    async def update_conversation(db: Session, conversation_id: int, user_id: int, title: str, tool_context: Optional[str] = None) -> Optional[ChatConversation]:
        """Actualizar el título y/o el contexto de herramienta de una conversación."""
        conversation = await ChatService.get_conversation(db, conversation_id, user_id)
        
        if conversation:
            conversation.title = title
            if tool_context is not None:
                conversation.tool_context = tool_context
            conversation.updated_at = datetime.now()
            db.commit()
            db.refresh(conversation)
        
        return conversation
    
    @staticmethod
    async def delete_conversation(db: Session, conversation_id: int, user_id: int) -> bool:
        """Eliminar (desactivar) una conversación."""
        conversation = await ChatService.get_conversation(db, conversation_id, user_id)
        
        if conversation:
            conversation.is_active = False
            db.commit()
            return True
        
        return False
    
    @staticmethod
    async def get_conversation_messages(db: Session, conversation_id: int, user_id: int) -> List[ChatMessage]:
        """Obtener todos los mensajes de una conversación."""
        conversation = await ChatService.get_conversation(db, conversation_id, user_id)
        
        if conversation:
            return db.query(ChatMessage)\
                .filter(ChatMessage.conversation_id == conversation_id)\
                .order_by(ChatMessage.created_at)\
                .all()
        
        return []
    
    @staticmethod
    async def process_message(db: Session, chat_request: ChatRequest, user: User) -> Tuple[Optional[ChatMessage], Optional[str]]:
        """Procesa un mensaje del usuario y obtiene respuesta de la IA."""
        
        # Verificar si es un mensaje de análisis bioinformático
        is_analysis_prompt = ChatService.is_bioinformatic_analysis_prompt(chat_request.message)
        
        # Obtener o crear conversación
        conversation_id = chat_request.conversation_id
        if conversation_id:
            conversation = await ChatService.get_conversation(db, conversation_id, user.id)
            if not conversation:
                return None, "Conversación no encontrada"
        else:
            # Crear una nueva conversación, posiblemente con un contexto de herramienta
            conversation = await ChatService.create_conversation(
                db, 
                user.id, 
                "Nueva conversación", 
                chat_request.tool_context
            )
        
        # Guardar mensaje del usuario SOLO si no es un prompt de análisis bioinformático
        user_message = None
        if not is_analysis_prompt:
            user_message = ChatMessage(
                conversation_id=conversation.id,
                role="user",
                content=chat_request.message
            )
            db.add(user_message)
            db.commit()
        
        # Actualizar timestamp de la conversación
        conversation.updated_at = datetime.now()
        db.commit()
        
        # Seleccionar proveedor de IA
        provider = await AIProviderSelection.select_provider(db)
        if not provider:
            error_message = "No hay proveedores de IA disponibles en este momento"
            # Guardar mensaje de error como respuesta del asistente
            assistant_message = ChatMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=error_message,
                ai_provider="system"
            )
            db.add(assistant_message)
            db.commit()
            return assistant_message, error_message
        
        # Obtener contexto de la conversación (mensajes anteriores)
        conversation_messages = await ChatService.get_conversation_messages(db, conversation.id, user.id)
        
        # Añadir información de contexto de herramienta si está disponible
        tool_info = ""
        if conversation.tool_context:
            tool_info = f"[Contexto: La conversación está relacionada con la herramienta {conversation.tool_context}]"
        
        # Obtener respuesta de la IA
        ai_response, tokens_used, recommended_tools = await ChatService._get_ai_response(
            provider=provider,
            messages=conversation_messages,
            user_language=user.language_preference,
            tool_context=conversation.tool_context,
            current_message=chat_request.message  # Pasar el mensaje actual para el caso de análisis
        )
        
        # Si es un prompt de análisis, guardar una versión limpia de la respuesta
        if is_analysis_prompt:
            # Guardar solo la respuesta de la IA sin guardar el prompt del usuario
            assistant_message = ChatMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=ai_response,
                ai_provider=provider.name,
                tokens_used=tokens_used,
                recommended_tools=",".join(recommended_tools) if recommended_tools else None
            )
            db.add(assistant_message)
            db.commit()
        else:
            # Guardar respuesta de la IA normalmente
            assistant_message = ChatMessage(
                conversation_id=conversation.id,
                role="assistant",
                content=ai_response,
                ai_provider=provider.name,
                tokens_used=tokens_used,
                recommended_tools=",".join(recommended_tools) if recommended_tools else None
            )
            db.add(assistant_message)
            db.commit()
        
        # Actualizar uso del proveedor
        await AIProviderSelection.update_usage(db, provider.id, tokens_used)
        
        # Actualizar título de la conversación si es la primera interacción y no es análisis bioinformático
        if len(conversation_messages) <= 1 and not is_analysis_prompt:
            # Generar título a partir del primer mensaje
            title = chat_request.message[:50] + "..." if len(chat_request.message) > 50 else chat_request.message
            conversation.title = title
            db.commit()
        elif len(conversation_messages) <= 1 and is_analysis_prompt:
            # Generar un título más adecuado para análisis bioinformático
            if "BLAST" in chat_request.message or "blast" in chat_request.message:
                title = "Análisis de resultados BLAST"
            elif "alignment" in chat_request.message or "alineamiento" in chat_request.message:
                title = "Análisis de alineamiento de secuencias"
            else:
                title = "Análisis bioinformático"
            
            conversation.title = title
            db.commit()
        
        return assistant_message, None
    
    @staticmethod
    async def _get_ai_response(
        provider: AIProvider, 
        messages: List[ChatMessage], 
        user_language: str,
        tool_context: Optional[str] = None,
        current_message: Optional[str] = None  # Añadir este parámetro
    ) -> Tuple[str, int, List[str]]:
        """Obtiene respuesta del proveedor de IA seleccionado."""
        
        # Verificar si el mensaje actual es un prompt de análisis bioinformático
        if is_analysis_prompt:
            bioinformatic_format = """
            Para análisis bioinformáticos (BLAST, alineamiento, etc.), usa el siguiente formato:
            1. Marca claramente los títulos de secciones y conceptos importantes con doble asterisco (**Título**)
            2. Usa saltos de línea dobles entre párrafos (dos veces \n\n) para crear una estructura clara
            3. Organiza tu análisis en secciones bien definidas con títulos en negrita
            4. Asegúrate de que la conclusión sea completa y clara al final del análisis
            5. Usa un formato consistente en todo el documento
            """
            formatted_messages.append({"role": "system", "content": bioinformatic_format})
        
        # Preparar mensajes para la API de IA
        formatted_messages = [
            {"role": "system", "content": settings.AI_SYSTEM_PROMPT},
            {"role": "system", "content": "Por favor, responde en el mismo idioma que utilice el usuario en su mensaje."}
        ]
        
        # Añadir contexto de herramienta si está disponible
        if tool_context:
            tool_context_prompt = f"""
            Esta conversación está ocurriendo en el contexto de la herramienta '{tool_context}' de GenomIQ.
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
                "content": current_message or ""
            })
        else:
            # Añadir mensajes de la conversación para otros tipos de mensaje
            for msg in messages:
                formatted_messages.append({
                    "role": msg.role,
                    "content": msg.content
                })
        
        try:
            # Llamar a OpenRouter
            return await ChatService._call_openrouter(provider, formatted_messages)
                
        except Exception as e:
            # Manejo de errores en la llamada a la API
            return f"Lo siento, ocurrió un error al procesar tu solicitud: {str(e)}", 0, []
    
    @staticmethod
    async def _call_openrouter(provider: AIProvider, messages: List[Dict[str, str]]) -> Tuple[str, int, List[str]]:
        """Realiza llamada a la API de OpenRouter."""
        # Detectar si es un prompt de análisis bioinformático (puedes usar tu función existente)
        first_user_message = next((msg["content"] for msg in messages if msg["role"] == "user"), "")
        is_analysis_prompt = ChatService.is_bioinformatic_analysis_prompt(first_user_message)
        
        # Seleccionar modelo basado en el tipo de mensaje
        model = AIProviderSelection.select_openrouter_model(is_analysis_prompt)
            
        # Añadir instrucciones para herramientas en el prompt del sistema
        tool_instructions = """
        Cuando consideres útil recomendar alguna herramienta de la plataforma, indica tu recomendación
        insertando una etiqueta en tu respuesta con el formato [TOOL:nombre_herramienta]. 
        
        Las herramientas disponibles son:
        - [TOOL:blast] - Para búsqueda de secuencias similares (BLAST)
        - [TOOL:alignment] - Para alineamiento múltiple de secuencias
        - [TOOL:translation] - Para traducción de secuencias de ADN/ARN a proteínas
        - [TOOL:visualization] - Para visualización 3D de estructuras moleculares
        - [TOOL:annotation] - Para anotación funcional de secuencias
        
        Recomienda solo las herramientas realmente relevantes para la consulta del usuario.
        Incluye la etiqueta solo una vez por herramienta y colócala después de mencionar la herramienta en tu texto.
        """
        
        # Añadir estas instrucciones como un mensaje del sistema
        system_messages = [msg for msg in messages if msg.get("role") == "system"]
        if system_messages:
            # Añadir a las instrucciones del sistema existentes
            system_messages[0]["content"] += "\n\n" + tool_instructions
        else:
            # Añadir como nuevo mensaje del sistema
            messages.insert(0, {"role": "system", "content": tool_instructions})
        
        async with httpx.AsyncClient(timeout=60.0) as client:
            headers = {
                "Authorization": f"Bearer {provider.api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": settings.PROJECT_WEBSITE_URL or "https://genomiq.app",
                "X-Title": settings.PROJECT_NAME
            }
            
            data = {
                "model": model,
                "messages": messages,
                "temperature": settings.AI_TEMPERATURE,
                "max_tokens": settings.AI_MAX_TOKENS
            }
            
            response = await client.post(
                provider.base_url or "https://openrouter.ai/api/v1/chat/completions",
                headers=headers,
                json=data
            )
            
            if response.status_code != 200:
                raise Exception(f"Error en API de OpenRouter: {response.text}")
            
            result = response.json()
            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            tokens_used = result.get("usage", {}).get("total_tokens", 0) or (
                result.get("usage", {}).get("prompt_tokens", 0) + 
                result.get("usage", {}).get("completion_tokens", 0)
            )
            
            # Procesar el contenido para formatear negritas y encabezados
            formatted_content = content
            # Reemplazar los formatos Markdown con HTML
            formatted_content = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', formatted_content)
            # Reemplazar los encabezados H3 (###)
            formatted_content = re.sub(r'###\s+(.+?)\s*(\n|$)', r'<h3>\1</h3>\2', formatted_content)
            
            # Identificar herramientas recomendadas mediante las etiquetas [TOOL:xxx]
            recommended_tools = []
            tool_regex = r'\[TOOL:(blast|alignment|translation|visualization|annotation)\]'
            for match in re.finditer(tool_regex, formatted_content, re.IGNORECASE):
                tool_id = match.group(1).lower()
                if tool_id not in recommended_tools:
                    recommended_tools.append(tool_id)
            
            return formatted_content, tokens_used, recommended_tools
    
    @staticmethod
    def _process_tool_recommendations(content: str) -> Tuple[str, List[str]]:
        """Procesa el contenido de la respuesta para detectar recomendaciones de herramientas."""
        # Lista de todas las herramientas disponibles
        available_tools = {
            "blast": ["blast", "búsqueda de secuencias", "comparación de secuencias"],
            "alignment": ["alineamiento", "msa", "alineamiento múltiple", "clustal"],
            "translation": ["traducción", "traducir secuencia", "dna a proteína"],
            "visualization": ["visualización", "visualizar", "estructura 3d", "modelado"],
            "annotation": ["anotación", "anotar", "características", "anotación funcional"]
        }
        
        # Patrones que indican que se está recomendando usar una herramienta
        recommendation_patterns = [
            "puedes usar", "te recomiendo", "prueba con", "utiliza", "deberías usar",
            "la herramienta", "podría ayudarte", "herramienta adecuada", "te sugiero"
        ]
        
        # Verificar si el contenido sugiere usar alguna herramienta
        is_recommendation = any(pattern.lower() in content.lower() for pattern in recommendation_patterns)
        
        # Si parece una recomendación, buscar qué herramientas menciona
        recommended_tools = []
        if is_recommendation:
            for tool_id, keywords in available_tools.items():
                if any(keyword.lower() in content.lower() for keyword in keywords):
                    recommended_tools.append(tool_id)
        
        # Formato de las negritas: cambiar ** y ### por HTML
        formatted_content = content
        # Reemplazar los formatos Markdown con HTML
        formatted_content = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', formatted_content)
        
        # Reemplazar los encabezados H3 (###)
        formatted_content = re.sub(r'###\s+(.+?)\s*(\n|$)', r'<h3>\1</h3>\2', formatted_content)
        
        return formatted_content, recommended_tools
    
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
    @staticmethod
    async def process_ephemeral_message(db: Session, chat_request: ChatRequest, user: User) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Procesa un mensaje del usuario y obtiene una respuesta de la IA sin persistir la conversación.
        Utiliza el proveedor de IA pero no guarda nada en la base de datos.
        """
        try:
            # Seleccionar proveedor de IA
            provider = await AIProviderSelection.select_provider(db)
            if not provider:
                return None, "No hay proveedores de IA disponibles en este momento"
            
            # Crear lista de mensajes para el proveedor de IA
            formatted_messages = [
                {"role": "system", "content": settings.AI_SYSTEM_PROMPT},
                {"role": "system", "content": "Por favor, responde en el mismo idioma que utilice el usuario en su mensaje."}
            ]
            
            # Añadir contexto de herramienta si está disponible
            if chat_request.tool_context:
                tool_context_prompt = f"""
                Esta consulta está ocurriendo en el contexto de la herramienta '{chat_request.tool_context}' de GenomIQ.
                Enfoca tu respuesta para ayudar específicamente con esta herramienta.
                Esta es una petición efímera que no será guardada como conversación.
                """
                formatted_messages.append({"role": "system", "content": tool_context_prompt})
            
            # Añadir el mensaje del usuario
            formatted_messages.append({"role": "user", "content": chat_request.message})
            
            # Obtener respuesta de la IA
            ai_response, tokens_used, recommended_tools = await ChatService._call_openrouter(
                provider=provider,
                messages=formatted_messages
            )
            
            # Actualizar uso del proveedor (registrar el uso aunque no guardemos la conversación)
            await AIProviderSelection.update_usage(db, provider.id, tokens_used)
            
            # Devolver la respuesta sin guardarla
            return {
                "content": ai_response,
                "ai_provider": provider.name,
                "tokens_used": tokens_used,
                "recommended_tools": ",".join(recommended_tools) if recommended_tools else None
            }, None
            
        except Exception as e:
            # Manejo de errores en la llamada a la API
            return None, f"Lo siento, ocurrió un error al procesar tu solicitud: {str(e)}"