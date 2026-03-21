'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { useChat, Message, Conversation } from '@/context/ChatContext';
import { useChatWebSocket } from '@/context/ChatWebSocketContext';
import { useRouter } from 'next/navigation';
import {
  ChatBubbleLeftRightIcon,
  XMarkIcon,
  BeakerIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CubeIcon,
  TagIcon,
  ArrowPathRoundedSquareIcon,
  ClockIcon
} from '@heroicons/react/24/solid';

interface FloatingChatProps {
  toolContext: {
    name: string;
    displayName: string;
  };
}

// Define a type for the available tool IDs
type ToolId = 'blast' | 'alignment' | 'translation' | 'visualization' | 'annotation';

// Define the structure for a tool configuration
interface ToolConfig {
  name: string;
  icon: React.ReactNode;
  url: string;
  description: string;
}

// Define the type for the toolsConfig object
type ToolsConfigType = {
  [key in ToolId]: ToolConfig;
};

const FloatingChat: React.FC<FloatingChatProps> = ({ toolContext }) => {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    messages,
    sendMessage,
    loading,
    conversations,
    selectConversation,
    createNewConversation,
    currentConversation,
    deleteChat,
    fetchConversations,
    isProcessingLongRequest,
    error,
    isTypewriting,
    typewriterContent,
    typewriterTools,
    typewriterConversationId
  } = useChat();

  // WebSocket context para streaming
  const {
    connected: wsConnected,
    sendStreamMessage
  } = useChatWebSocket();

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [flashBackground, setFlashBackground] = useState(false); // Para indicar visualmente nueva actividad
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loadingDuration, setLoadingDuration] = useState<number>(0);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Configuración de herramientas disponibles
  const toolsConfig: ToolsConfigType = {
    'blast': {
      name: t('tools.recommendations.blast'),
      icon: <BeakerIcon className="h-6 w-6 text-blue-500" />,
      url: '/tools/blast',
      description: 'Búsqueda de secuencias similares'
    },
    'alignment': {
      name: t('tools.recommendations.alignment'),
      icon: <ArrowPathIcon className="h-6 w-6 text-blue-500" />,
      url: '/tools/alignment',
      description: 'Alineamiento múltiple de secuencias'
    },
    'translation': {
      name: t('tools.recommendations.translation'),
      icon: <DocumentTextIcon className="h-6 w-6 text-blue-500" />,
      url: '/tools/translation',
      description: 'Traducción de secuencias de ADN/ARN a proteínas'
    },
    'visualization': {
      name: t('tools.recommendations.visualization'),
      icon: <CubeIcon className="h-6 w-6 text-blue-500" />,
      url: '/tools/visualization',
      description: 'Visualización 3D de estructuras moleculares'
    },
    'annotation': {
      name: t('tools.recommendations.annotation'),
      icon: <TagIcon className="h-6 w-6 text-blue-500" />,
      url: '/tools/annotation',
      description: 'Anotación funcional de secuencias'
    },
  };

  // Estado para efectos de typewriting en el FloatingChat
  const [typingText, setTypingText] = useState('');
  const [cursorVisible, setCursorVisible] = useState(true);
  const previousLengthRef = useRef<number>(0);

  // Efecto para manejar la redirección automática cuando se completa un stream
  useEffect(() => {
    // Añadimos un event listener para el evento personalizado 'autoSelectConversation'
    const handleAutoSelect = (event: any) => {
      const { conversationId } = event.detail;
      console.log('FloatingChat: Auto-seleccionando conversación:', conversationId);

      // Seleccionar la conversación y ocultar el historial si estaba visible
      if (conversationId) {
        selectConversation(conversationId);
        setShowHistory(false);
      }
    };

    // Agregar el listener al documento
    document.addEventListener('autoSelectConversation', handleAutoSelect);

    // Limpiar el listener cuando el componente se desmonte
    return () => {
      document.removeEventListener('autoSelectConversation', handleAutoSelect);
    };
  }, [selectConversation]);

  // Cargar sólo las conversaciones relacionadas con esta herramienta
  useEffect(() => {
    if (isOpen) {
      fetchConversations(toolContext.name);
    }
  }, [isOpen, toolContext.name, fetchConversations]);

  // Scroll al final de los mensajes cuando se añaden nuevos
  useEffect(() => {
    if (isOpen && !showHistory) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, showHistory, typingText]);

  // Efecto para hacer parpadear el botón cuando hay nueva actividad y el chat está cerrado
  useEffect(() => {
    if (!isOpen && messages.length > 0) {
      // Solo parpadear cuando llega un nuevo mensaje del asistente
      const lastMessage = messages[messages.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        setFlashBackground(true);
        const timer = setTimeout(() => {
          setFlashBackground(false);
        }, 2000);

        return () => clearTimeout(timer);
      }
    }
  }, [messages, isOpen]);

  // Mostrar notificación de error si hay uno
  useEffect(() => {
    if (error) {
      // Mostrar toast o notificación
      console.error('Error en el chat:', error);
    }
  }, [error]);

  // Efecto para controlar el tiempo de carga
  useEffect(() => {
    if (loading || isProcessingLongRequest) {
      // Si está cargando, iniciar o continuar el timer
      if (loadingTimerRef.current === null) {
        // Iniciar cuenta desde 0 si no había timer
        setLoadingDuration(0);

        // Actualizar cada segundo
        loadingTimerRef.current = setInterval(() => {
          setLoadingDuration(prev => prev + 1);
        }, 1000);
      }
    } else {
      // Si terminó de cargar, limpiar el timer
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
        setLoadingDuration(0);
      }
    }

    // Limpieza al desmontar
    return () => {
      if (loadingTimerRef.current) {
        clearInterval(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    };
  }, [loading, isProcessingLongRequest]);

  // Efecto para manejar el typewriting en streaming
  useEffect(() => {
    if (isTypewriting && shouldShowTypewriting()) {
      // Reiniciar cuando comienza una nueva sesión
      if (typingText === '') {
        previousLengthRef.current = 0;
      }

      // Manejar la actualización de contenido typewriter
      if (typewriterContent.length > previousLengthRef.current) {
        // Determinar qué nuevo texto añadir
        const newChunk = typewriterContent.substring(previousLengthRef.current);
        previousLengthRef.current = typewriterContent.length;

        // Para chunks pequeños, actualizar inmediatamente
        if (newChunk.length <= 3) {
          setTypingText(prev => {
            const newLength = prev.length + newChunk.length;
            return processHTMLForTyping(typewriterContent, newLength);
          });
          return;
        }

        // Para chunks más grandes, mostrarlos gradualmente
        let charIndex = 0;
        const currentText = typingText;

        const typeNextCharacter = () => {
          if (charIndex < newChunk.length) {
            // Determinar cuántos caracteres mostrar en este paso
            // Variar la velocidad para simular escritura natural
            const charsToAdd = Math.min(
              3 + Math.floor(Math.random() * 4), // Entre 3-6 caracteres por paso
              newChunk.length - charIndex
            );

            charIndex += charsToAdd;

            // Crear texto con formato HTML correcto
            const newLength = currentText.length + charIndex;
            setTypingText(processHTMLForTyping(typewriterContent, newLength));

            // Velocidad variable para simular escritura natural (entre 20-60ms)
            const speed = Math.max(20, Math.min(60, 40 - (charsToAdd * 5)));
            setTimeout(typeNextCharacter, speed);
          }
        };

        // Iniciar efecto de escritura para este chunk
        typeNextCharacter();
      } else if (typewriterContent.length < previousLengthRef.current) {
        // Si el contenido es más corto (raro, pero posible en situaciones como correcciones)
        previousLengthRef.current = typewriterContent.length;
        setTypingText(typewriterContent);
      }
    } else if (!isTypewriting) {
      // Limpiar cuando termina
      setTypingText('');
      previousLengthRef.current = 0;
    }
  }, [isTypewriting, typewriterContent, typingText]);

  // Efecto para crear animación de cursor parpadeante
  useEffect(() => {
    if (isTypewriting && shouldShowTypewriting()) {
      const cursorInterval = setInterval(() => {
        setCursorVisible(prev => !prev);
      }, 500);

      return () => clearInterval(cursorInterval);
    }
  }, [isTypewriting]);

  // Formatear tiempo de carga
  const formatLoadingTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const toggleChat = () => {
    setIsOpen(prev => !prev);
    if (showHistory) {
      setShowHistory(false);
    }
    // Al abrir, limpiar efectos visuales
    if (!isOpen) {
      setFlashBackground(false);
    }
  };

  const toggleHistory = () => {
    setShowHistory(prev => !prev);
  };

  const handleSelectConversation = async (id: number) => {
    await selectConversation(id);
    setShowHistory(false);
  };

  const handleNewConversation = () => {
    createNewConversation();
    setShowHistory(false);
  };

  const handleDeleteClick = (id: number) => {
    setConfirmDelete(id);
  };

  const handleConfirmDelete = async (id: number) => {
    await deleteChat(id);
    setConfirmDelete(null);
  };

  const handleCancelDelete = () => {
    setConfirmDelete(null);
  };

  // Verificar si debe mostrar el efecto de typewriting (considerando también FloatingChat)
  const shouldShowTypewriting = () => {
    // Si no hay streaming activo, no mostrar nada
    if (!isTypewriting) return false;

    // Verificar si la conversación actual coincide con la del streaming
    // o si es una nueva conversación sin conversación actual seleccionada
    if (!currentConversation) return true;

    // Si hay una conversación seleccionada, verificar que el streaming pertenece a esa conversación
    return !typewriterConversationId || currentConversation.id === typewriterConversationId;
  };

  // Función para manejar correctamente las etiquetas HTML durante la escritura
  const processHTMLForTyping = (fullText: string, currentLength: number): string => {
    if (currentLength === 0) return '';

    // Eliminar primero todas las etiquetas de herramientas
    let processedText = fullText.replace(/\[TOOL:(blast|alignment|translation|visualization|annotation)\]/gi, '');

    // Lista de etiquetas a verificar y sus contadores
    const tagPairs = [
      { open: '<strong>', close: '</strong>' },
      { open: '<h3>', close: '</h3>' },
      { open: '<p>', close: '</p>' },
      { open: '<ul>', close: '</ul>' },
      { open: '<ol>', close: '</ol>' },
      { open: '<li>', close: '</li>' },
      { open: '<em>', close: '</em>' },
      { open: '<code>', close: '</code>' },
      { open: '<pre>', close: '</pre>' },
    ];

    // Cortar el texto a la longitud actual
    let displayText = processedText.substring(0, currentLength);

    // Verificar cada par de etiquetas
    tagPairs.forEach(({ open, close }) => {
      const openCount = (displayText.match(new RegExp(open.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
      const closeCount = (displayText.match(new RegExp(close.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;

      // Cerrar etiquetas abiertas si es necesario
      if (openCount > closeCount) {
        displayText += close;
      }
    });

    return displayText;
  };

  // Mejorado: Ahora intentará usar streaming si está disponible, sino usa el método tradicional
  // Modificación del handleSubmit en FloatingChat.tsx

  // Modificación del handleSubmit en FloatingChat.tsx

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim() && !loading && !isProcessingLongRequest && !isTypewriting) {
      // Guardar el valor actual antes de limpiarlo
      const messageToSend = inputValue;
      // Limpia el input inmediatamente para mejor UX
      setInputValue('');

      // Para el caso del streaming, no necesitamos agregar el mensaje manualmente
      // ya que al compartir el contexto del chat (useChat), la UI se actualizará
      // cuando se complete el streaming.

      // En lugar de usar setMessages (que no existe en este componente),
      // usamos directamente sendMessage para agregar el mensaje a la interfaz
      if (!wsConnected) {
        // Si no vamos a usar streaming, agregamos el mensaje manualmente
        await sendMessage(messageToSend, currentConversation?.id, toolContext.name);

        // Cerrar el historial si está abierto
        if (showHistory) {
          setShowHistory(false);
        }

        // Si es una nueva conversación, debemos actualizar la UI aquí
        if (!currentConversation) {
          // Esperar un momento para que se actualice la lista de conversaciones
          setTimeout(() => {
            fetchConversations(toolContext.name);
          }, 1000);
        }

        return; // Terminamos aquí, ya que sendMessage se encarga de todo
      }

      try {
        // Usar streaming (wsConnected es true)
        // Cerrar el historial si está abierto
        if (showHistory) {
          setShowHistory(false);
        }

        // Agregar temporalmente el mensaje del usuario usando el método del ChatContext
        // Este método se encargará de agregarlo a la lista de mensajes
        await sendMessage(messageToSend, currentConversation?.id, toolContext.name);

        // Luego iniciamos el streaming
        await sendStreamMessage(
          messageToSend,
          currentConversation?.id,
          toolContext.name
        );

        // La redirección a la conversación ocurrirá automáticamente 
        // a través del evento autoSelectConversation cuando finalice el stream

      } catch (error) {
        console.error("Error al enviar mensaje:", error);
        // Si hay un error en el streaming, ya tenemos el mensaje del usuario agregado,
        // no necesitamos hacer nada más
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  // Función para navegar a la herramienta seleccionada
  const navigateToTool = (toolId: string) => {
    if (isValidToolId(toolId)) {
      router.push(toolsConfig[toolId].url);
      // Cerrar el chat después de redirigir
      setIsOpen(false);
    }
  };

  // Formatear la hora
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Formatear fecha para mostrar en el historial
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  // Función para limpiar el prefijo de contexto en los mensajes del usuario
  const cleanUserMessage = (message: string): string => {
    const prefixPattern = `\\[En la herramienta de ${toolContext.displayName}\\]\\s*`;
    const regExp = new RegExp(prefixPattern, 'i');
    return message.replace(regExp, '');
  };

  // Helper function to check if a string is a valid ToolId
  const isValidToolId = (id: string): id is ToolId => {
    return id in toolsConfig;
  };

  // Detectar herramientas recomendadas a partir del texto o del campo recommended_tools
  const detectRecommendedTools = (message: Message): ToolId[] => {
    // Si ya tenemos herramientas recomendadas explícitamente
    if (message.recommended_tools) {
      const tools = message.recommended_tools.split(',');
      return tools.filter(isValidToolId);
    }

    // Si no, buscar las etiquetas [TOOL:nombre_herramienta] en el contenido
    const tools: ToolId[] = [];
    const toolRegex = /\[TOOL:(blast|alignment|translation|visualization|annotation)\]/gi;
    let match;
    const content = message.content || '';

    while ((match = toolRegex.exec(content)) !== null) {
      const toolId = match[1].toLowerCase();
      if (isValidToolId(toolId) && !tools.includes(toolId)) {
        tools.push(toolId);
      }
    }

    return tools;
  };

  // Formatear el contenido del mensaje eliminando las etiquetas [TOOL:xxx]
  const formatContent = (content: string): string => {
    // Eliminar las etiquetas [TOOL:xxx] para que no se muestren al usuario
    return content.replace(/\[TOOL:(blast|alignment|translation|visualization|annotation)\]/gi, '');
  };

  // Verificar si un mensaje es "Regenerando respuesta..."
  const isRegeneratingMessage = (content: string): boolean => {
    return content.trim() === "Regenerando respuesta...";
  };

  // Verificar si hay algún mensaje del asistente
  const hasAssistantMessages = messages.some(msg => msg.role === 'assistant');

  // Verificar si hay algún mensaje "Regenerando respuesta..." para no mostrar el indicador de carga
  const isCurrentlyRegenerating = messages.some(
    message => message.role === 'assistant' && isRegeneratingMessage(message.content)
  );

  // Renderizar botones de herramientas
  const renderToolButtons = (tools: ToolId[]) => {
    if (!tools || tools.length === 0) return null;

    return (
      <div className="mt-3 mb-2">
        <div className="flex flex-wrap gap-2 justify-center">
          {tools.map((toolId) => {
            const tool = toolsConfig[toolId];
            return (
              <button
                key={toolId}
                onClick={() => navigateToTool(toolId)}
                className="flex flex-col items-center p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-neutral-200 dark:border-neutral-700 w-24"
              >
                <div className="mb-1">
                  {tool.icon}
                </div>
                <span className="text-xs text-neutral-700 dark:text-neutral-300">
                  {tool.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Botón flotante para abrir/cerrar el chat */}
      <button
        onClick={toggleChat}
        className={`rounded-full p-3 shadow-lg transition-colors ${isOpen
          ? 'bg-red-500 hover:bg-red-600 rotate-90'
          : flashBackground
            ? 'bg-green-500 hover:bg-green-600 animate-pulse'
            : 'bg-blue-500 hover:bg-blue-600'
          }`}
        aria-label={isOpen ? t('chat.close') : t('chat.open')}
      >
        {isOpen ? (
          <XMarkIcon className="h-6 w-6 text-white" />
        ) : (
          <ChatBubbleLeftRightIcon className="h-6 w-6 text-white" />
        )}
      </button>

      {/* Panel de chat (solo visible cuando isOpen es true) */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 md:w-96 h-96 bg-white dark:bg-neutral-900 rounded-lg shadow-xl border border-neutral-200 dark:border-neutral-800 flex flex-col overflow-hidden">
          {/* Header del chat */}
          <div className="bg-blue-500 text-white p-3 flex items-center justify-between">
            <div className="flex items-center">
              <ChatBubbleLeftRightIcon className="h-5 w-5 mr-2" />
              <span className="font-medium">
                {showHistory
                  ? t('chat.conversations')
                  : t('chat.assistant')
                }
              </span>
            </div>
            <div className="flex items-center">
              {/* Botones de navegación */}
              <div className="flex space-x-2">
                {/* Botón de historial / volver atrás */}
                <button
                  onClick={toggleHistory}
                  className="p-1 rounded-full hover:bg-blue-400 text-white"
                  aria-label={showHistory ? t('common.back') : t('chat.expandSidebar')}
                >
                  {showHistory ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 transform rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
                    </svg>
                  )}
                </button>

                {/* Botón de nueva conversación */}
                <button
                  onClick={handleNewConversation}
                  className="p-1 rounded-full bg-white/20 text-white hover:bg-white/30 transition-colors"
                  aria-label={t('chat.newConversation')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Contenido del chat */}
          {showHistory ? (
            // Vista de historial de conversaciones
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Lista de conversaciones */}
              {conversations.length === 0 ? (
                <div className="text-center text-neutral-500 dark:text-neutral-400 py-4">
                  {t('chat.noConversations')}
                </div>
              ) : (
                conversations.map((conversation) => (
                  <div
                    key={conversation.id}
                    className={`relative w-full rounded-lg ${currentConversation?.id === conversation.id
                      ? 'bg-blue-100 dark:bg-blue-900/30'
                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                  >
                    <button
                      onClick={() => handleSelectConversation(conversation.id)}
                      className={`w-full text-left py-2 px-3 rounded-lg transition-colors pr-8 ${currentConversation?.id === conversation.id
                        ? 'text-blue-500 dark:text-blue-400'
                        : 'text-neutral-700 dark:text-neutral-300'
                        }`}
                    >
                      <div className="truncate font-medium">{conversation.title}</div>
                      <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        {formatDate(conversation.updated_at)}
                      </div>
                    </button>

                    {/* Botón de eliminar */}
                    {confirmDelete === conversation.id ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 bg-opacity-90 dark:bg-opacity-90 rounded-lg">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleConfirmDelete(conversation.id)}
                            className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                          >
                            {t('common.confirm')}
                          </button>
                          <button
                            onClick={handleCancelDelete}
                            className="px-2 py-1 bg-neutral-300 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 text-xs rounded"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleDeleteClick(conversation.id)}
                        className="absolute right-2 top-2 p-1 text-neutral-400 hover:text-red-500 transition-colors rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        aria-label={t('chat.deleteConversation')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          ) : (
            // Vista de mensajes del chat
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {/* Mensaje de bienvenida cuando no hay mensajes */}
              {messages.length === 0 && (
                <div className="text-center text-neutral-500 dark:text-neutral-400 p-3">
                  {t('chat.welcomeToToolHelper')} {toolContext.displayName}
                </div>
              )}

              {/* Mostrar mensajes recientes (últimos 10) */}
              {messages.slice(-10).map((message: Message, index: number) => {
                const isUserMessage = message.role === 'user';
                const isRegenerating = !isUserMessage && isRegeneratingMessage(message.content);

                // No mostrar si es un mensaje temporal de carga
                if (!isUserMessage && message.content === 'Cargando...' && isTypewriting) {
                  return null;
                }

                return (
                  <div
                    key={message.id || index}
                    className={`rounded-lg p-3 max-w-[85%] ${isUserMessage
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-neutral-800 dark:text-neutral-200 ml-auto'
                      : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                      }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                        {isUserMessage ? t('chat.you') : t('chat.assistant')}
                      </div>
                      <div className="text-xs text-neutral-400 dark:text-neutral-500">
                        {formatTime(message.timestamp)}
                      </div>
                    </div>

                    {/* Contenido del mensaje con manejo especial para mensajes de regeneración */}
                    {isRegenerating ? (
                      <div className="text-neutral-700 dark:text-neutral-300">
                        <div className="flex items-center">
                          <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-1 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-1 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                          <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
                        </div>
                        <div className="mt-1 italic text-neutral-500 dark:text-neutral-400 opacity-70">
                          Regenerando respuesta...
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm whitespace-pre-wrap break-words" style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
                        {/* Eliminar el prefijo de contexto en los mensajes del usuario */}
                        {isUserMessage
                          ? cleanUserMessage(message.content)
                          : <div dangerouslySetInnerHTML={{ __html: formatContent(message.content) }} style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }} />
                        }
                      </div>
                    )}

                    {/* Mostrar botones de herramientas si hay recomendaciones y no está regenerando */}
                    {!isUserMessage && !isRegenerating && renderToolButtons(detectRecommendedTools(message))}
                  </div>
                );
              })}

              {/* Mensaje con efecto typewriting en tiempo real */}
              {isTypewriting && shouldShowTypewriting() && (
                <div className="rounded-lg p-3 max-w-[85%] bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200">
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {t('chat.assistant')}
                    </div>
                    <div className="text-xs text-neutral-400 dark:text-neutral-500">
                      {formatTime(new Date())}
                    </div>
                  </div>

                  {/* Renderizado del texto con efecto typewriter */}
                  <div style={{ display: 'inline' }}>
                    <span
                      dangerouslySetInnerHTML={{
                        __html: typewriterContent.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
                      }}
                    />
                    {/* Cursor inline con espacio reservado para evitar saltos de layout */}
                    <span className="inline-block" style={{ width: cursorVisible ? 'auto' : '0', overflow: 'hidden', minWidth: '1px' }}>
                      {cursorVisible && <span className="animate-pulse">▌</span>}
                      {!cursorVisible && <span style={{ opacity: 0 }}>▌</span>}
                    </span>
                  </div>

                  {/* Mostrar botones de herramientas en streaming */}
                  {typewriterTools.length > 0 && renderToolButtons(typewriterTools.filter(isValidToolId))}
                </div>
              )}

              {/* Mejorado - Indicador de carga con tiempo transcurrido */}
              {(loading || isProcessingLongRequest) && !isCurrentlyRegenerating && !isTypewriting && (
                <div className="rounded-lg p-3 bg-neutral-100 dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 max-w-[85%]">
                  <div className="flex justify-between items-start mb-1">
                    <div className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                      {t('chat.assistant')}
                    </div>
                    <div className="text-xs text-neutral-400 dark:text-neutral-500">
                      {formatTime(new Date())}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center">
                      <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-1 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                      <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full mr-1 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      <div className="w-2 h-2 bg-blue-500 dark:bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '600ms' }}></div>
                    </div>

                    {/* Mostrar mensaje con tiempo transcurrido si es una solicitud larga */}
                    {isProcessingLongRequest && loadingDuration > 10 && (
                      <div className="flex items-center mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                        <ClockIcon className="h-3 w-3 mr-1" />
                        <span>
                          Respuesta en progreso ({formatLoadingTime(loadingDuration)})...
                        </span>
                      </div>
                    )}

                    {/* Mensaje adicional después de 30 segundos */}
                    {isProcessingLongRequest && loadingDuration > 30 && (
                      <div className="mt-2 text-xs italic text-neutral-500 dark:text-neutral-400">
                        La respuesta está tomando más tiempo de lo habitual. No cierres la ventana.
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input para enviar mensajes (solo visible en la vista de chat) */}
          {!showHistory && (
            <form onSubmit={handleSubmit} className="p-3 border-t border-neutral-200 dark:border-neutral-700 flex">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading || isProcessingLongRequest || isTypewriting} // Deshabilitar durante carga o typewriting
                placeholder={
                  isTypewriting
                    ? t('chat.waitingTypewriter', { defaultValue: "Esperando a que termine de escribir..." })
                    : loading || isProcessingLongRequest
                      ? t('chat.waitingForResponse', { defaultValue: "Esperando respuesta..." })
                      : t('chat.askAboutTool', { defaultValue: "Pregúntame sobre esta herramienta..." })
                }
                className={`flex-1 resize-none bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg p-2 text-sm text-neutral-700 dark:text-neutral-300 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 ${(loading || isProcessingLongRequest || isTypewriting) ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                rows={1}
                style={{ minHeight: '40px', maxHeight: '120px' }}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || loading || isProcessingLongRequest || isTypewriting}
                className={`ml-2 ${!inputValue.trim() || loading || isProcessingLongRequest || isTypewriting
                  ? 'text-neutral-400 cursor-not-allowed'
                  : 'text-blue-500 hover:text-blue-600'
                  }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default FloatingChat;