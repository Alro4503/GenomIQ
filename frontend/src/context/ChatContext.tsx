'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  getChatConversations,
  getChatMessages,
  sendChatMessage,
  deleteConversation,
  regenerateChatMessage,
  checkPendingChatRequests
} from '@/services/chat/chatService';
import { ChatWebSocketProvider, useChatWebSocket } from './ChatWebSocketContext';

// Definición de tipos (mismos que tenías)
export interface Message {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  ai_provider?: string;
  recommended_tools?: string;
}

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  tool_context?: string;
}

interface PendingRequest {
  conversationId: number | null;
  userMessage: string;
  timestamp: Date;
  toolContext?: string;
  attempts?: number;
}

// Extendemos la interfaz ChatContextType con las propiedades para streaming
interface ChatContextType {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  messages: Message[];
  loading: boolean;
  error: string | null;
  sendMessage: (content: string, conversationId?: number, toolContext?: string) => Promise<void>;
  regenerateResponse: () => Promise<void>;
  selectConversation: (conversationId: number) => Promise<void>;
  createNewConversation: () => void;
  fetchConversations: (toolContext?: string) => Promise<void>;
  deleteChat: (conversationId: number) => Promise<void>;
  isProcessingLongRequest: boolean;

  // Propiedades para streaming
  isTypewriting: boolean;
  typewriterContent: string;
  typewriterTools: string[];
  typewriterConversationId: number | null; // Nueva propiedad para conversación actual en streaming
}

// Creación del contexto
const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Hook personalizado para usar el contexto
export const useChat = () => {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
};

// Tiempos para polling de verificación (ms)
const CHECK_INTERVAL_SHORT = 5000; // 5 segundos
const CHECK_INTERVAL_LONG = 20000; // 20 segundos
const MAX_CHECK_DURATION = 600000; // 10 minutos

// Componente interno que contiene la lógica del chat
const ChatProviderInner: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentToolContext, setCurrentToolContext] = useState<string | undefined>(undefined);
  const [isProcessingLongRequest, setIsProcessingLongRequest] = useState<boolean>(false);

  // Estados para typewriting
  const [isTypewriting, setIsTypewriting] = useState<boolean>(false);
  const [typewriterContent, setTypewriterContent] = useState<string>('');
  const [typewriterTools, setTypewriterTools] = useState<string[]>([]);
  const [typewriterConversationId, setTypewriterConversationId] = useState<number | null>(null);

  // Referencias para controlar el polling y solicitudes pendientes
  const pendingRequestRef = useRef<PendingRequest | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartTimeRef = useRef<number>(0);
  const totalPollAttemptsRef = useRef<number>(0);

  // Acceder al contexto WebSocket
  const {
    sendStreamMessage,
    isStreaming,
    streamingMessage,
    streamingTools,
    streamingConversationId
  } = useChatWebSocket();

  // Sincronizar estados de WebSocket con estados locales
  useEffect(() => {
    setIsTypewriting(isStreaming);
    setTypewriterContent(streamingMessage);
    setTypewriterTools(streamingTools);
    setTypewriterConversationId(streamingConversationId);
  }, [isStreaming, streamingMessage, streamingTools, streamingConversationId]);


  // Recuperar conversaciones
  const fetchConversations = useCallback(async (toolContext?: string) => {
    if (!user) return;

    try {
      setLoading(true);
      setCurrentToolContext(toolContext);
      const data = await getChatConversations(toolContext);
      setConversations(data);
      setLoading(false);
    } catch (err) {
      setError('Error al cargar conversaciones');
      setLoading(false);
    }
  }, [user]);

  // Cargar mensajes de una conversación
  const loadMessages = useCallback(async (conversationId: number) => {
    if (!user) return;

    try {
      setLoading(true);
      const data = await getChatMessages(conversationId);

      // Convertir timestamps a objetos Date
      const formattedMessages = data.map(msg => ({
        ...msg,
        timestamp: new Date(msg.created_at)
      }));

      setMessages(formattedMessages);
      setLoading(false);
    } catch (err) {
      setError('Error al cargar mensajes');
      setLoading(false);
    }
  }, [user]);

  // Seleccionar una conversación
  const selectConversation = useCallback(async (conversationId: number) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setCurrentConversation(conversation);
      await loadMessages(conversationId);
    }
  }, [conversations, loadMessages]);

  // Añadir este efecto en ChatProviderInner
  useEffect(() => {
    // Función para manejar la selección automática de conversación
    const handleAutoSelect = (event: any) => {
      const { conversationId } = event.detail;
      console.log('Auto-seleccionando conversación:', conversationId);

      // Usar selectConversation para seleccionar la conversación,
      // lo que cargará los mensajes y actualizará la UI
      selectConversation(conversationId);
    };

    // Agregar el listener al documento
    document.addEventListener('autoSelectConversation', handleAutoSelect);

    // Limpiar el listener cuando el componente se desmonte
    return () => {
      document.removeEventListener('autoSelectConversation', handleAutoSelect);
    };
  }, [selectConversation]); // Asegurarse de incluir selectConversation en las dependencias

  // Crear nueva conversación
  const createNewConversation = useCallback(() => {
    setCurrentConversation(null);
    setMessages([]);
  }, []);

  // Función para detener el polling
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Función para verificar periódicamente si una solicitud pendiente ha sido procesada
  const startPolling = useCallback((conversationId: number) => {
    // Limpiar cualquier polling existente
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
    }

    // Iniciar contadores
    pollStartTimeRef.current = Date.now();
    totalPollAttemptsRef.current = 0;

    // Función que se ejecutará periódicamente
    const checkForResponse = async () => {
      totalPollAttemptsRef.current++;
      console.log(`Verificando respuesta (intento #${totalPollAttemptsRef.current})...`);

      try {
        // Si han pasado más de MAX_CHECK_DURATION, detener el polling
        if (Date.now() - pollStartTimeRef.current > MAX_CHECK_DURATION) {
          console.warn('Se alcanzó el tiempo máximo de espera');
          stopPolling();
          setLoading(false);
          setIsProcessingLongRequest(false);
          setError('La solicitud está tomando demasiado tiempo. Por favor, intenta nuevamente.');
          return;
        }

        // Obtener los mensajes actualizados
        const updatedMessages = await getChatMessages(conversationId);

        // Convertir timestamps a objetos Date
        const formattedMessages = updatedMessages.map(msg => ({
          ...msg,
          timestamp: new Date(msg.created_at)
        }));

        // Comparar el número de mensajes para detectar nuevos mensajes
        // También verificar el último mensaje para asegurarse de que es del asistente
        if (formattedMessages.length > messages.length &&
          formattedMessages[formattedMessages.length - 1].role === 'assistant') {

          console.log('¡Se encontró una respuesta nueva!');

          // Actualizar los mensajes
          setMessages(formattedMessages);
          setLoading(false);
          setIsProcessingLongRequest(false);

          // Detener el polling
          stopPolling();

          // Limpiar la referencia de solicitud pendiente
          pendingRequestRef.current = null;

          // Actualizar la lista de conversaciones
          fetchConversations(currentToolContext);
        } else {
          // Verificar si hay un mensaje nuevo del asistente comparando el contenido del último mensaje
          if (formattedMessages.length > 0 && messages.length > 0) {
            const lastServerMsg = formattedMessages[formattedMessages.length - 1];
            const lastLocalMsg = messages[messages.length - 1];

            // Si el último mensaje en ambos es del asistente pero con contenido diferente,
            // significa que probablemente se actualizó la respuesta
            if (lastServerMsg.role === 'assistant' && lastLocalMsg.role === 'assistant' &&
              lastServerMsg.content !== lastLocalMsg.content) {

              console.log('¡Se encontró una actualización en la respuesta!');

              setMessages(formattedMessages);
              setLoading(false);
              setIsProcessingLongRequest(false);
              stopPolling();
              pendingRequestRef.current = null;
              fetchConversations(currentToolContext);
            }
          }
        }
      } catch (error) {
        console.error('Error al verificar respuesta:', error);
      }
    };

    // Iniciar con un intervalo corto para los primeros intentos
    setIsProcessingLongRequest(true);
    pollTimerRef.current = setInterval(() => {
      // Cambiar a un intervalo más largo después de varios intentos
      if (totalPollAttemptsRef.current >= 6) { // Después de 30 segundos (6 * 5s)
        if (pollTimerRef.current) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = setInterval(checkForResponse, CHECK_INTERVAL_LONG);
        }
      }

      checkForResponse();
    }, CHECK_INTERVAL_SHORT);

    // Hacer una verificación inmediata
    checkForResponse();

  }, [messages, currentToolContext, fetchConversations, stopPolling]);

  // Eliminar una conversación
  const deleteChat = useCallback(async (conversationId: number) => {
    if (!user) return;

    try {
      setLoading(true);
      // Llamar al servicio de eliminación
      await deleteConversation(conversationId);

      // Actualizar el estado local
      setConversations(prev => prev.filter(c => c.id !== conversationId));

      // Si la conversación actual es la que se eliminó, crear una nueva
      if (currentConversation?.id === conversationId) {
        createNewConversation();
      }

      setLoading(false);
    } catch (err) {
      setError('Error al eliminar la conversación');
      setLoading(false);
    }
  }, [user, currentConversation, createNewConversation]);

  // Manejador para cuando se completa un stream
  const handleStreamComplete = useCallback((
    content: string,
    conversationId: number,
    messageId: number,
    tools: string[]
  ) => {
    console.log('Stream completado. Actualizando mensajes con la respuesta completa.');

    // Actualizar mensajes con la respuesta completa
    setMessages(prev => {
      // Filtrar cualquier mensaje temporal del asistente (si existe)
      const filteredMessages = prev.filter(m =>
        !(m.role === 'assistant' && m.content === 'Cargando...')
      );

      // Agregar el mensaje con la respuesta completa
      return [
        ...filteredMessages,
        {
          id: messageId,
          conversation_id: conversationId,
          role: 'assistant',
          content: content,
          timestamp: new Date(),
          recommended_tools: tools.join(',')
        }
      ];
    });

    setLoading(false);
    setIsProcessingLongRequest(false);

    // Si es una nueva conversación, actualizar el estado
    if (!currentConversation || (currentConversation.id !== conversationId)) {
      // Buscar la conversación en las existentes o recargarlas
      if (conversations.some(conv => conv.id === conversationId)) {
        const conv = conversations.find(c => c.id === conversationId);
        if (conv) {
          setCurrentConversation(conv);
        }
      } else {
        fetchConversations(currentToolContext);
      }
    }
  }, [currentConversation, conversations, fetchConversations, currentToolContext]);

  // Regenerar la última respuesta del asistente
  const regenerateResponse = useCallback(async () => {
    if (!user || messages.length < 2 || !currentConversation) return;

    // Determinar el último mensaje del asistente y el mensaje de usuario correspondiente
    let lastAssistantMessage: Message | null = null;
    let correspondingUserMessage: Message | null = null;

    // Recorremos los mensajes en orden inverso para encontrar el último par usuario-asistente
    for (let i = messages.length - 1; i >= 0; i--) {
      if (!lastAssistantMessage && messages[i].role === 'assistant') {
        lastAssistantMessage = messages[i];
        // Buscar el mensaje de usuario que lo precedió
        if (i > 0 && messages[i - 1].role === 'user') {
          correspondingUserMessage = messages[i - 1];
        }
        break;
      }
    }

    // Verificar que tenemos ambos mensajes
    if (!lastAssistantMessage || !correspondingUserMessage) {
      setError('No se puede regenerar - no hay suficientes mensajes');
      return;
    }

    try {
      setLoading(true);

      // Actualizar visualmente para mostrar que está cargando
      setMessages(prev => {
        const newMessages = [...prev];
        const index = newMessages.findIndex(msg => msg.id === lastAssistantMessage?.id);
        if (index !== -1) {
          // Marcamos el mensaje como "Regenerando respuesta..."
          newMessages[index] = {
            ...newMessages[index],
            content: "Regenerando respuesta..."
          };
        }
        return newMessages;
      });

      try {
        // Intentar usar streaming si está disponible
        await sendStreamMessage(
          correspondingUserMessage.content,
          currentConversation.id,
          currentConversation.tool_context
        );

        // No necesitamos hacer nada más aquí, el evento de stream completado
        // se encargará de actualizar los mensajes

      } catch (streamError) {
        console.error('Error al usar streaming para regeneración:', streamError);

        // Fallback al método tradicional
        try {
          const updatedMessage = await regenerateChatMessage(
            lastAssistantMessage.id,
            correspondingUserMessage.content
          );

          // Actualizar el mensaje en el estado local
          setMessages(prev => {
            const newMessages = [...prev];
            const index = newMessages.findIndex(msg => msg.id === lastAssistantMessage?.id);
            if (index !== -1) {
              newMessages[index] = {
                ...newMessages[index],
                content: updatedMessage.content,
                recommended_tools: updatedMessage.recommended_tools,
                timestamp: new Date(updatedMessage.created_at)
              };
            }
            return newMessages;
          });

          setLoading(false);
        } catch (error: any) {
          console.error('Error de regeneración tradicional:', error);

          // Si es un error de timeout, iniciar el polling
          if (error.message && error.message.includes('timeout')) {
            console.log('La regeneración está tomando más tiempo...');
            startPolling(currentConversation.id);
          } else {
            // Otro tipo de error, restaurar y mostrar
            setMessages(prev => {
              return prev.map(msg =>
                msg.id === lastAssistantMessage?.id
                  ? { ...msg, content: lastAssistantMessage.content }
                  : msg
              );
            });
            setLoading(false);
            setError('Error al regenerar respuesta');
          }
        }
      }

      // Actualizar la lista de conversaciones
      fetchConversations(currentToolContext);

    } catch (err) {
      console.error('Error general en regeneración:', err);
      setLoading(false);
      setError('Error al regenerar respuesta');

      // Restaurar el mensaje original en caso de error
      setMessages(prev => {
        return prev.map(msg =>
          msg.id === lastAssistantMessage?.id
            ? { ...msg, content: lastAssistantMessage.content }
            : msg
        );
      });
    }
  }, [user, messages, currentConversation, fetchConversations, currentToolContext, startPolling, sendStreamMessage]);

  // Enviar mensaje
  const sendMessage = useCallback(async (content: string, conversationId?: number, toolContext?: string) => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      // Agregar mensaje de usuario inmediatamente para la UI
      const userMessage: Message = {
        id: Date.now(), // ID temporal
        role: 'user',
        content,
        timestamp: new Date()
      };

      // NO agregar mensaje temporal del asistente si vamos a usar streaming
      setMessages(prev => [...prev, userMessage]);

      // Intentar usar streaming si está disponible
      try {
        await sendStreamMessage(
          content,
          conversationId || currentConversation?.id,
          toolContext
        );

        // No necesitamos esperar ni procesar la respuesta aquí
        // El evento streamComplete manejará la actualización de los mensajes

        // Si es una nueva conversación, actualizar el estado cuando tengamos el ID
        if (!conversationId && !currentConversation) {
          // fetchConversations se llamará en handleStreamComplete
        }

      } catch (streamingError) {
        console.error('Error al usar streaming, fallback al método tradicional:', streamingError);

        // Agregar mensaje temporal del asistente (para loading) solo en caso de fallback
        const tempAssistantMessage: Message = {
          id: Date.now() + 1, // ID temporal 
          role: 'assistant',
          content: 'Cargando...',
          timestamp: new Date()
        };

        // Actualizar mensajes con el temporal
        setMessages(prev => [...prev, tempAssistantMessage]);

        // Usar el método tradicional como fallback
        try {
          // Guardar información de la solicitud en curso
          pendingRequestRef.current = {
            conversationId: conversationId || currentConversation?.id || null,
            userMessage: content,
            timestamp: new Date(),
            toolContext
          };

          // Enviar mensaje al servidor
          const response = await sendChatMessage(content, conversationId || currentConversation?.id, toolContext);

          // Si es una nueva conversación, actualizar el estado
          if (!conversationId && !currentConversation) {
            const newConversation = {
              id: response.conversation_id,
              title: content.length > 30 ? content.substring(0, 30) + '...' : content,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              tool_context: toolContext
            };

            setCurrentConversation(newConversation);
            setConversations(prev => [newConversation, ...prev]);
          }

          // Actualizar el mensaje temporal con la respuesta real
          setMessages(prev => {
            const newMessages = [...prev];
            const index = newMessages.findIndex(msg => msg.id === tempAssistantMessage.id);
            if (index !== -1) {
              newMessages[index] = {
                id: response.message_id,
                role: 'assistant',
                content: response.message,
                timestamp: new Date(),
                ai_provider: response.ai_provider,
                recommended_tools: response.recommended_tools
              };
            }
            return newMessages;
          });

          setLoading(false);
          setIsProcessingLongRequest(false);
          pendingRequestRef.current = null;

          // Limpiar datos de recuperación al tener éxito
          if (typeof window !== 'undefined') {
            localStorage.removeItem('lastChatRequest');
          }
        } catch (error: any) {
          console.error('Error al enviar mensaje tradicional:', error);

          // Incrementar contador de intentos para evitar loops infinitos
          const currentAttempt = (pendingRequestRef.current?.attempts || 0) + 1;

          // Si es un error de timeout o conexión, iniciar el polling
          if ((error.message && error.message.includes('timeout')) ||
            (error.message && error.message.includes('network'))) {
            console.log('La solicitud está tomando más tiempo de lo esperado...');

            // Actualizar el registro de solicitud pendiente con el número de intentos
            if (pendingRequestRef.current) {
              pendingRequestRef.current.attempts = currentAttempt;
            }

            // Si tenemos un ID de conversación, iniciar polling
            if (conversationId || currentConversation?.id) {
              const convId = conversationId || currentConversation?.id;
              if (convId) {
                // Guardar en localStorage para recuperación en caso de recargar la página
                if (typeof window !== 'undefined') {
                  localStorage.setItem('lastChatRequest', JSON.stringify({
                    timestamp: new Date().toISOString(),
                    data: {
                      conversation_id: convId,
                      message: content,
                      tool_context: toolContext
                    }
                  }));
                }

                startPolling(convId);
              }
            } else {
              setLoading(false);
              setError('La respuesta está tomando más tiempo de lo esperado. Por favor, espera unos momentos.');
            }
          } else {
            // Para otros errores, mostrar mensaje apropiado
            setLoading(false);
            setIsProcessingLongRequest(false);
            setError('Error al enviar mensaje: ' + (error.message || 'Error desconocido'));

            // Eliminar el mensaje temporal de carga en caso de error
            setMessages(prev => prev.filter(m => m.id !== tempAssistantMessage.id));
          }
        }
      }

      // Actualizar la lista de conversaciones
      fetchConversations(currentToolContext);

    } catch (err) {
      console.error('Error general en envío de mensaje:', err);
      setLoading(false);
      setIsProcessingLongRequest(false);
      setError('Error al procesar la solicitud');
    }
  }, [user, currentConversation, fetchConversations, currentToolContext, startPolling, sendStreamMessage]);

  // Verificar solicitudes pendientes al cargar la página
  useEffect(() => {
    const checkForPendingRequests = async () => {
      if (!user) return;

      try {
        const pendingMessage = await checkPendingChatRequests();
        if (pendingMessage) {
          // Si hay un mensaje pendiente, actualizamos la UI
          console.log('Se encontró un mensaje pendiente:', pendingMessage);

          // Obtener la conversación
          const conversation = await getChatConversations();
          const relevantConversation = conversation.find(c => c.id === pendingMessage.conversation_id);

          if (relevantConversation) {
            setCurrentConversation(relevantConversation);

            // Obtener todos los mensajes de la conversación
            const allMessages = await getChatMessages(relevantConversation.id);

            // Formatear mensajes
            const formattedMessages = allMessages.map(msg => ({
              ...msg,
              timestamp: new Date(msg.created_at)
            }));

            setMessages(formattedMessages);
          }
        }
      } catch (error) {
        console.error('Error al verificar solicitudes pendientes:', error);
      }
    };

    checkForPendingRequests();

    // Limpieza al desmontar
    return () => {
      stopPolling();
    };
  }, [user, stopPolling]);

  // Limpiar polling al desmontar el componente
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  // Cargar conversaciones al iniciar
  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user, fetchConversations]);

  // Cargar solicitud pendiente si se recarga la página
  useEffect(() => {
    if (user) {
      const storedRequest = localStorage.getItem('lastChatRequest');
      if (storedRequest) {
        try {
          const { timestamp, data } = JSON.parse(storedRequest);
          const requestTime = new Date(timestamp);
          const currentTime = new Date();

          // Solo considerar solicitudes de menos de 10 minutos
          if (currentTime.getTime() - requestTime.getTime() < MAX_CHECK_DURATION) {
            console.log('Recuperando solicitud pendiente después de recarga de página');

            // Reiniciar con la solicitud pendiente
            if (data.conversation_id) {
              selectConversation(data.conversation_id).then(() => {
                // Si hay un ID de conversación, iniciar polling
                startPolling(data.conversation_id);
              });
            } else if (data.message) {
              // Si solo hay un mensaje, mostrarlo como pendiente
              const userMessage: Message = {
                id: Date.now(),
                role: 'user',
                content: data.message,
                timestamp: requestTime
              };

              setMessages([userMessage]);
              setLoading(true);
              setIsProcessingLongRequest(true);
            }
          } else {
            // La solicitud es demasiado antigua, eliminarla
            localStorage.removeItem('lastChatRequest');
          }
        } catch (error) {
          console.error('Error al recuperar solicitud pendiente:', error);
          localStorage.removeItem('lastChatRequest');
        }
      }
    }
  }, [user, selectConversation, startPolling]);

  // Conectar el manejador de eventos para el streaming completo
  useEffect(() => {
    // Configurar el listener para cuando un stream se completa
    if (typeof handleStreamComplete === 'function') {
      const handleWsStreamComplete = (
        content: string,
        conversationId: number,
        messageId: number,
        tools: string[]
      ) => {
        handleStreamComplete(content, conversationId, messageId, tools);
      };

      // Aquí iría un código para "suscribirse" al evento de "stream complete"
      // si es que tu implementación de WebSocket lo requiere
    }
  }, [handleStreamComplete]);

  const value = {
    conversations,
    currentConversation,
    messages,
    loading,
    error,
    sendMessage,
    regenerateResponse,
    selectConversation,
    createNewConversation,
    fetchConversations,
    deleteChat,
    isProcessingLongRequest,
    // Propiedades para typewriting
    isTypewriting,
    typewriterContent,
    typewriterTools,
    typewriterConversationId
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
};

// Proveedor principal que combina ChatWebSocketProvider con ChatContext
export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <ChatWebSocketProvider
      onStreamStart={(conversationId) => {
        console.log(`Inicio de streaming para conversación ${conversationId}`);
      }}
      onStreamChunk={(chunk) => {
        // Se puede usar para debugging
        // console.log(`Recibido chunk: ${chunk.substring(0, 20)}...`);
      }}
      onStreamComplete={(content, conversationId, messageId, tools) => {
        console.log(`Streaming completado para conversación ${conversationId}, mensaje ${messageId}`);
      }}
      onStreamError={(error) => {
        console.error(`Error de streaming: ${error}`);
      }}
    >
      <ChatProviderInner>{children}</ChatProviderInner>
    </ChatWebSocketProvider>
  );
};

export default ChatProvider;