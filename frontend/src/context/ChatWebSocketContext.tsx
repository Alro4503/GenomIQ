'use client';

import React, { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Message, Conversation } from '@/context/ChatContext';

// Tipo para los eventos de streaming
type StreamEvent = {
  event: string;
  content?: string;
  conversation_id?: number;
  message_id?: number;
  tool?: string;
  message?: string;
  error?: string;
};

// Interfaz para el contexto
interface ChatWebSocketContextType {
  connected: boolean;
  connecting: boolean;
  streamingMessage: string;
  isStreaming: boolean;
  streamingTools: string[];
  streamingConversationId: number | null; // Añadido para identificar la conversación en streaming
  sendStreamMessage: (message: string, conversationId?: number, toolContext?: string) => Promise<void>;
  reconnect: () => void;
}

// Valores predeterminados
const defaultContextValue: ChatWebSocketContextType = {
  connected: false,
  connecting: false,
  streamingMessage: '',
  isStreaming: false,
  streamingTools: [],
  streamingConversationId: null, // Valor predeterminado
  sendStreamMessage: async () => {},
  reconnect: () => {},
};

// Crear contexto
const ChatWebSocketContext = createContext<ChatWebSocketContextType>(defaultContextValue);

// Hook personalizado para acceder al contexto
export const useChatWebSocket = () => useContext(ChatWebSocketContext);

// Proveedor del contexto
interface ChatWebSocketProviderProps {
  children: ReactNode;
  onStreamStart?: (conversationId: number) => void;
  onStreamChunk?: (chunk: string) => void;
  onStreamComplete?: (content: string, conversationId: number, messageId: number, tools: string[]) => void;
  onStreamError?: (error: string) => void;
}

export const ChatWebSocketProvider: React.FC<ChatWebSocketProviderProps> = ({ 
  children,
  onStreamStart,
  onStreamChunk,
  onStreamComplete,
  onStreamError
}) => {
  const { user, token } = useAuth();
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [connecting, setConnecting] = useState<boolean>(false);
  const [streamingMessage, setStreamingMessage] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingTools, setStreamingTools] = useState<string[]>([]);
  const [streamingConversationId, setStreamingConversationId] = useState<number | null>(null); // Estado para identificar la conversación en streaming
  
  // Referencias para manejar reconexión y heartbeat
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isReconnecting = useRef<boolean>(false);
  
  // Configuración de reconexión
  const MAX_RECONNECT_DELAY = 5000;
  const RECONNECT_BASE_DELAY = 500;
  const reconnectAttempts = useRef<number>(0);
  
  // Inicializar conexión WebSocket
  const initializeWebSocket = async () => {
    if (!user || socket?.readyState === WebSocket.OPEN || connecting) return;
    
    try {
      setConnecting(true);
      
      // Obtener token JWT - usando el token directamente del contexto de Auth
      if (!token) {
        console.error('No se pudo obtener el token de autenticación');
        setConnecting(false);
        return;
      }
      
      // Crear WebSocket con token en URL
      const apiUrl = `${process.env.NEXT_PUBLIC_API_URL || ''}/api/chat/ws?token=${token}`;
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = apiUrl.replace(/^http(s)?:/, wsProtocol);
      
      const newSocket = new WebSocket(wsUrl);
      
      // Gestionar eventos del WebSocket
      newSocket.onopen = () => {
        console.log('WebSocket conectado');
        setSocket(newSocket);
        setConnected(true);
        setConnecting(false);
        reconnectAttempts.current = 0;
        isReconnecting.current = false;
        
        // Establecer ping periódico para mantener la conexión activa
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = setInterval(() => {
          if (newSocket.readyState === WebSocket.OPEN) {
            newSocket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000); // Ping cada 30 segundos
      };
      
      newSocket.onclose = (event) => {
        console.log(`WebSocket cerrado: ${event.code}, ${event.reason}`);
        setConnected(false);
        setConnecting(false);
        
        // Limpiar intervalos y timeouts
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
        
        // Iniciar reconexión automática si no está en proceso
        if (!isReconnecting.current) {
          scheduleReconnect();
        }
      };
      
      newSocket.onerror = (error) => {
        console.error('Error en WebSocket:', error);
        if (onStreamError) {
          onStreamError('Error de conexión con el servidor');
        }
      };
      
      newSocket.onmessage = (event) => {
        try {
          const data: StreamEvent = JSON.parse(event.data);
          handleStreamEvent(data);
        } catch (error) {
          console.error('Error al procesar mensaje WebSocket:', error);
        }
      };
      
      setSocket(newSocket);
      
    } catch (error) {
      console.error('Error al inicializar WebSocket:', error);
      setConnecting(false);
      
      // Programar reconexión en caso de error
      scheduleReconnect();
    }
  };
  
  // Programar reconexión con backoff exponencial
  const scheduleReconnect = () => {
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    
    isReconnecting.current = true;
    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(1.5, reconnectAttempts.current),
      MAX_RECONNECT_DELAY
    );
    
    reconnectAttempts.current += 1;
    
    reconnectTimeoutRef.current = setTimeout(() => {
      initializeWebSocket();
    }, delay);
  };
  
  // Forzar reconexión manual
  const reconnect = () => {
    if (socket) {
      socket.close();
    }
    
    reconnectAttempts.current = 0;
    initializeWebSocket();
  };
  
  // Manejar eventos recibidos en streaming
  const handleStreamEvent = (data: StreamEvent) => {
    switch (data.event) {
      case 'assistant_stream_start':
        setIsStreaming(true);
        setStreamingMessage('');
        setStreamingTools([]);
        
        // Guardar el ID de la conversación en streaming
        if (data.conversation_id) {
          setStreamingConversationId(data.conversation_id);
        }
        
        if (onStreamStart && data.conversation_id) {
          const conversationId = data.conversation_id;
          onStreamStart(conversationId);
        }
        break;
        
      case 'assistant_stream_chunk':
        if (data.content) {
          const contentChunk = data.content; // Store in a local variable for type narrowing
          setStreamingMessage(prev => {
            const newContent = prev + contentChunk;
            
            // Notificar sobre el nuevo chunk
            if (onStreamChunk) {
              onStreamChunk(contentChunk);
            }
            
            return newContent;
          });
        }
        break;
        
      case 'tool_recommendation':
        if (data.tool) {
          setStreamingTools(prev => {
            // Solo agregar si no existe ya en el array
            if (data.tool && !prev.includes(data.tool)) {
              return [...prev, data.tool];
            }
            return prev;
          });
        }
        break;
        
      case 'assistant_stream_end':
        // No desactivar el streaming aquí - esperar a que se guarde el mensaje
        // setIsStreaming(false);
        break;
        
      case 'assistant_message_saved':
        if (onStreamComplete && data.conversation_id && data.message_id) {
          const conversationId = data.conversation_id;
          const messageId = data.message_id;
          
          // Contenido formateado para pasar al callback
          const finalContent = data.content || streamingMessage;
          
          // Llamar al callback con los datos
          onStreamComplete(
            finalContent, 
            conversationId, 
            messageId,
            streamingTools
          );
          
          // Terminar el streaming
          setIsStreaming(false);
          setStreamingConversationId(null); // Resetear el ID de conversación en streaming
          
          // Simular un evento para seleccionar automáticamente la conversación
          // Este evento será capturado por el ChatContext para seleccionar la conversación
          document.dispatchEvent(new CustomEvent('autoSelectConversation', {
            detail: { conversationId }
          }));
        }
        break;
        
      case 'error':
        console.error('Error en streaming:', data.message || 'Error desconocido');
        setIsStreaming(false);
        setStreamingConversationId(null); // Resetear el ID de conversación en streaming
        
        if (onStreamError && data.message) {
          const errorMessage = data.message;
          onStreamError(errorMessage);
        }
        break;
    }
  };
  
  // Enviar mensaje vía WebSocket
  const sendStreamMessage = async (
    message: string, 
    conversationId?: number, 
    toolContext?: string
  ) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      // Intentar reconectar y enviar después
      await initializeWebSocket();
      
      // Verificar si se conectó correctamente
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        console.error('No se pudo establecer conexión WebSocket');
        if (onStreamError) {
          onStreamError('No se pudo establecer conexión con el servidor');
        }
        return;
      }
    }
    
    // Preparar mensaje para enviar
    const chatMessage = {
      type: 'chat_message',
      message,
      conversation_id: conversationId,
      tool_context: toolContext
    };
    
    // Enviar mensaje
    socket.send(JSON.stringify(chatMessage));
  };
  
  // Inicializar WebSocket cuando el usuario está autenticado
  useEffect(() => {
    if (user) {
      initializeWebSocket();
    }
    
    // Limpiar al desmontar
    return () => {
      if (socket) {
        socket.close();
      }
      
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [user]);
  
  // Contexto que se proveerá
  const contextValue: ChatWebSocketContextType = {
    connected,
    connecting,
    streamingMessage,
    isStreaming,
    streamingTools,
    streamingConversationId,
    sendStreamMessage,
    reconnect
  };
  
  return (
    <ChatWebSocketContext.Provider value={contextValue}>
      {children}
    </ChatWebSocketContext.Provider>
  );
};

export default ChatWebSocketContext;