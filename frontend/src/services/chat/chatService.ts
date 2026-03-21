import api, { aiRequest } from '../api';

// Constantes de configuración
const RETRY_ATTEMPTS = 3;
const CHAT_REQUEST_TIMEOUT = 300000; // 5 minutos

// Tipos para las respuestas de la API
interface ChatMessage {
  id: number;
  conversation_id: number;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  ai_provider?: string;
  tokens_used?: number;
  recommended_tools?: string;
}

interface ChatConversation {
  id: number;
  user_id: number;
  title: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  tool_context?: string;
}

interface ChatResponse {
  message: string;
  conversation_id: number;
  message_id: number;
  ai_provider: string;
  recommended_tools?: string;
}

// URL base para las peticiones API
const API_URL = `${process.env.NEXT_PUBLIC_API_URL || ''}/api`;

// Obtener todas las conversaciones del usuario
export const getChatConversations = async (toolContext?: string): Promise<ChatConversation[]> => {
  try {
    const queryParams = toolContext ? `?tool_context=${toolContext}` : '';
    const response = await api.get(`${API_URL}/chat/conversations${queryParams}`);
    return response.data;
  } catch (error) {
    console.error('Error al obtener conversaciones:', error);
    throw error;
  }
};

// Obtener una conversación específica
export const getChatConversation = async (id: number): Promise<ChatConversation> => {
  try {
    const response = await api.get(`${API_URL}/chat/conversations/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error al obtener conversación ${id}:`, error);
    throw error;
  }
};

// Obtener mensajes de una conversación
export const getChatMessages = async (conversationId: number): Promise<ChatMessage[]> => {
  try {
    const response = await api.get(`${API_URL}/chat/conversations/${conversationId}/messages`);
    return response.data;
  } catch (error) {
    console.error(`Error al obtener mensajes de conversación ${conversationId}:`, error);
    throw error;
  }
};

// Comprobar si hay una solicitud pendiente y recuperarla
// Actualización de la función en chatService.ts

// Comprobar si hay una solicitud pendiente y recuperarla
export const checkPendingChatRequests = async (): Promise<ChatMessage | null> => {
  const pendingId = localStorage.getItem('pendingChatRequest');
  
  if (pendingId) {
    try {
      // Obtener los últimos mensajes para ver si la respuesta ya fue procesada
      const messages = await getChatMessages(parseInt(pendingId));
      
      // Si hay mensajes y el último es del asistente, significa que la respuesta
      // se procesó correctamente a pesar del timeout en el cliente
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        const lastMessage = messages[messages.length - 1];
        
        // Limpiar los datos de pendientes ya procesados
        localStorage.removeItem('pendingChatRequest');
        localStorage.removeItem('lastChatRequest');
        
        return lastMessage;
      }
      
      // También verificar si hay una solicitud guardada con más detalles
      const storedRequest = localStorage.getItem('lastChatRequest');
      if (storedRequest) {
        const { timestamp, data } = JSON.parse(storedRequest);
        const requestTime = new Date(timestamp);
        const currentTime = new Date();
        
        // Si la solicitud es demasiado antigua (más de 10 minutos), eliminarla
        if (currentTime.getTime() - requestTime.getTime() > 600000) {
          localStorage.removeItem('lastChatRequest');
        }
      }
    } catch (error) {
      console.error('Error al verificar solicitud pendiente:', error);
    }
    
    // Limpiar el ID pendiente si no pudimos recuperar nada
    // No eliminamos 'lastChatRequest' para permitir la recuperación manual
    localStorage.removeItem('pendingChatRequest');
  }
  
  return null;
};

// Enviar un mensaje y obtener respuesta con reintentos
export const sendChatMessage = async (
  message: string, 
  conversationId?: number,
  toolContext?: string
): Promise<ChatResponse> => {
  let attempts = 0;
  let lastError: any = null;
  
  // Almacenar información de la solicitud para recuperación
  const requestData = {
    message,
    conversation_id: conversationId,
    tool_context: toolContext
  };
  
  // Variable para controlar si se ha verificado una respuesta existente
  let checkedForExistingResponse = false;
  
  while (attempts < RETRY_ATTEMPTS) {
    try {
      console.log(`Intento #${attempts + 1} de enviar mensaje a la IA...`);
      
      // Comprobar primero si ya existe una respuesta para este mensaje
      // Solo hacemos esto después del primer intento fallido
      if (attempts > 0 && conversationId && !checkedForExistingResponse) {
        try {
          console.log('Verificando si la respuesta ya existe en el servidor...');
          checkedForExistingResponse = true;
          
          // Esperar un momento para dar tiempo al servidor a procesar
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Obtener los mensajes más recientes
          const messages = await getChatMessages(conversationId);
          
          // Buscar el mensaje del usuario y verificar si tiene una respuesta
          let foundUserMessage = false;
          let assistantResponse = null;
          
          // Recorrer los mensajes en orden cronológico
          for (let i = 0; i < messages.length; i++) {
            const msg = messages[i];
            
            // Si encontramos el mensaje del usuario...
            if (msg.role === 'user' && msg.content === message) {
              foundUserMessage = true;
              
              // ...y luego una respuesta del asistente, la consideramos la respuesta a este mensaje
              if (i + 1 < messages.length && messages[i + 1].role === 'assistant') {
                assistantResponse = messages[i + 1];
                break;
              }
            }
          }
          
          // Si encontramos una respuesta válida, retornarla
          if (foundUserMessage && assistantResponse) {
            console.log('Se encontró una respuesta existente para este mensaje.');
            return {
              message: assistantResponse.content,
              conversation_id: conversationId,
              message_id: assistantResponse.id,
              ai_provider: assistantResponse.ai_provider || 'unknown',
              recommended_tools: assistantResponse.recommended_tools
            };
          }
        } catch (checkError) {
          console.error('Error al verificar mensajes existentes:', checkError);
          // Continuamos con el reintento normal si falla esta verificación
        }
      }
      
      // Usar aiRequest para tener mejor manejo de timeout
      const response = await aiRequest.post(`${API_URL}/chat/message`, requestData);
      
      // Limpiar datos de recuperación al tener éxito
      if (typeof window !== 'undefined') {
        localStorage.removeItem('lastChatRequest');
        localStorage.removeItem('pendingChatRequest');
      }
      
      return response.data;
    } catch (error: any) {
      lastError = error;
      
      // Si no es un error de timeout o de red, no reintentamos
      if (!error.message.includes('timeout') && !error.message.includes('network')) {
        console.error('Error al enviar mensaje (no es timeout ni error de red):', error);
        break;
      }
      
      console.warn(`Timeout en intento #${attempts + 1}. Reintentando...`);
      attempts++;
      
      // Si tenemos un ID de conversación, intentar verificar si el mensaje se procesó
      if (conversationId) {
        try {
          // Esperar un poco antes de verificar
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          const messages = await getChatMessages(conversationId);
          // Buscar si hay un mensaje reciente del asistente después de nuestro mensaje de usuario
          
          // Primero, buscar nuestro mensaje de usuario
          let userMessageIndex = -1;
          for (let i = 0; i < messages.length; i++) {
            if (messages[i].role === 'user' && messages[i].content === message) {
              userMessageIndex = i;
              break;
            }
          }
          
          // Si encontramos el mensaje de usuario y hay un mensaje del asistente después
          if (userMessageIndex >= 0 && userMessageIndex + 1 < messages.length && 
              messages[userMessageIndex + 1].role === 'assistant') {
            
            const assistantMessage = messages[userMessageIndex + 1];
            
            // La respuesta ya existe, regresarla en el formato esperado
            console.log('Respuesta encontrada a pesar del timeout!');
            return {
              message: assistantMessage.content,
              conversation_id: conversationId,
              message_id: assistantMessage.id,
              ai_provider: assistantMessage.ai_provider || 'unknown',
              recommended_tools: assistantMessage.recommended_tools
            };
          }
        } catch (verifyError) {
          console.error('Error al verificar si el mensaje se procesó:', verifyError);
        }
      }
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  throw lastError || new Error('Error al enviar mensaje después de varios intentos');
};

// Actualizar título de una conversación
export const updateConversationTitle = async (
  conversationId: number, 
  title: string,
  toolContext?: string
): Promise<ChatConversation> => {
  try {
    let url = `${API_URL}/chat/conversations/${conversationId}?title=${encodeURIComponent(title)}`;
    if (toolContext) {
      url += `&tool_context=${encodeURIComponent(toolContext)}`;
    }
    const response = await api.put(url);
    return response.data;
  } catch (error) {
    console.error(`Error al actualizar conversación ${conversationId}:`, error);
    throw error;
  }
};

// Eliminar una conversación
export const deleteConversation = async (conversationId: number): Promise<void> => {
  try {
    await api.delete(`${API_URL}/chat/conversations/${conversationId}`);
  } catch (error) {
    console.error(`Error al eliminar conversación ${conversationId}:`, error);
    throw error;
  }
};

// Regenerar una respuesta específica del asistente con reintentos
export const regenerateChatMessage = async (
  messageId: number, 
  originalUserMessage: string
): Promise<ChatMessage> => {
  let attempts = 0;
  let lastError: any = null;
  
  while (attempts < RETRY_ATTEMPTS) {
    try {
      console.log(`Intento #${attempts + 1} de regenerar respuesta...`);
      
      // Usar config específico para peticiones de AI
      const config = {
        timeout: CHAT_REQUEST_TIMEOUT
      };
      
      const response = await api.put(
        `${API_URL}/chat/messages/${messageId}`, 
        { message: originalUserMessage },
        config
      );
      
      return response.data;
    } catch (error: any) {
      lastError = error;
      
      // Si no es un error de timeout, no reintentamos
      if (!error.message.includes('timeout')) {
        console.error('Error al regenerar respuesta (no es timeout):', error);
        break;
      }
      
      console.warn(`Timeout en intento #${attempts + 1} de regeneración. Reintentando...`);
      attempts++;
      
      // Esperar un poco antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  throw lastError || new Error('Error al regenerar respuesta después de varios intentos');
};

// Verificar si un mensaje existe - útil para confirmar si se procesó a pesar del timeout
export const checkMessageExists = async (messageId: number): Promise<boolean> => {
  try {
    await api.get(`${API_URL}/chat/messages/${messageId}`);
    return true;
  } catch (error) {
    return false;
  }
};

export const sendEphemeralChatMessage = async (
  message: string, 
  toolContext?: string
): Promise<ChatResponse> => {
  let attempts = 0;
  let lastError: any = null;
  
  while (attempts < RETRY_ATTEMPTS) {
    try {
      console.log(`Intento #${attempts + 1} de enviar mensaje efímero a la IA...`);
      
      // Usar aiRequest para tener mejor manejo de timeout
      const response = await aiRequest.post(`${API_URL}/chat/ephemeral`, {
        message,
        tool_context: toolContext
      });
      
      return response.data;
    } catch (error: any) {
      lastError = error;
      
      // Si no es un error de timeout o de red, no reintentamos
      if (!error.message.includes('timeout') && !error.message.includes('network')) {
        console.error('Error al enviar mensaje efímero (no es timeout ni error de red):', error);
        break;
      }
      
      console.warn(`Timeout en intento #${attempts + 1}. Reintentando...`);
      attempts++;
      
      // Esperar un poco antes de reintentar
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Si llegamos aquí, todos los intentos fallaron
  throw lastError || new Error('Error al enviar mensaje efímero después de varios intentos');
};