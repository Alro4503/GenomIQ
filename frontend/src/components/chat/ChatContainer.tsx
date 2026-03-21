'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { Message, useChat } from '@/context/ChatContext';
import { useRouter } from 'next/navigation';
import StreamingMessage from '@/components/chat/StreamingMessage';
import {
  BeakerIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CubeIcon,
  TagIcon,
  ClockIcon
} from '@heroicons/react/24/outline';

interface ChatContainerProps {
  messages: Message[];
  loading: boolean;
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

const ChatContainer: React.FC<ChatContainerProps> = ({ messages, loading }) => {
  const { t } = useTranslation();
  const {
    isProcessingLongRequest,
    error,
    isTypewriting
  } = useChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [loadingDuration, setLoadingDuration] = useState<number>(0);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Función para formatear la hora
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Formato para mostrar el tiempo de carga
  const formatLoadingTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  // Objeto con configuración de herramientas disponibles
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

  // Función para navegar a la herramienta seleccionada
  const navigateToTool = (toolId: string) => {
    if (isValidToolId(toolId)) {
      router.push(toolsConfig[toolId].url);
    }
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
    // Reemplazar las etiquetas [TOOL:xxx] con un elemento span vacío para preservar el espaciado
    // pero evitar que se muestren al usuario
    return content.replace(/\[TOOL:(blast|alignment|translation|visualization|annotation)\]/gi, '');
  };

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

  // Mostrar notificación de error si hay uno
  useEffect(() => {
    if (error) {
      console.error('Error en el chat:', error);
      // Aquí podríamos mostrar un toast o notificación
    }
  }, [error]);

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

  // Renderizar un mensaje individual
  // En ChatContainer.tsx, modifica la función renderMessage

  const renderMessage = (message: Message) => {
    const isUserMessage = message.role === 'user';
    const recommendedTools = isUserMessage ? [] : detectRecommendedTools(message);

    // No mostrar mensajes temporales de carga si hay streaming activo
    if (!isUserMessage && message.content === 'Cargando...' && isTypewriting) {
      return null;
    }

    // Detectar posiciones de las etiquetas en el contenido
    const toolPositions: { toolId: string, position: number }[] = [];
    const toolRegex = /\[TOOL:(blast|alignment|translation|visualization|annotation)\]/gi;
    let match;
    const content = message.content || '';

    while ((match = toolRegex.exec(content)) !== null) {
      const toolId = match[1].toLowerCase();
      if (isValidToolId(toolId)) {
        toolPositions.push({
          toolId,
          position: match.index
        });
      }
    }

    // Dividir las herramientas en intercaladas y al final
    const contentLength = content.length;
    const contentThreshold = contentLength * 0.9;

    const inlineTools: string[] = [];
    const endingTools: string[] = [];

    toolPositions.forEach(tool => {
      // Si la etiqueta está cerca del final, la consideramos "al final"
      if (tool.position > contentThreshold) {
        if (!endingTools.includes(tool.toolId)) {
          endingTools.push(tool.toolId);
        }
      } else {
        inlineTools.push(tool.toolId);
      }
    });

    // Obtener contenido formateado sin etiquetas
    const formattedContent = formatContent(content);

    return (
      <div
        key={message.id}
        className={`chat-message rounded-lg p-4 w-full md:w-[90%] lg:w-[750px] mx-auto ${isUserMessage
          ? 'bg-blue-100 dark:bg-blue-900/30 ml-auto'
          : 'bg-neutral-100 dark:bg-neutral-800 mr-auto'
          }`}
      >
        <div className="flex justify-between items-start mb-1">
          <div className="font-medium text-neutral-700 dark:text-neutral-300">
            {isUserMessage ? t('chat.you') : 'GenomIQ AI'}
          </div>
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {formatTime(message.timestamp)}
          </div>
        </div>

        <div className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap break-words"
          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}>
          {/* Si hay herramientas intercaladas, procesarlas */}
          {inlineTools.length > 0 && !isUserMessage ? (
            <>
              {toolPositions
                .filter(tool => inlineTools.includes(tool.toolId))
                .sort((a, b) => a.position - b.position)
                .reduce((parts: JSX.Element[], tool, index, sortedTools) => {
                  // Calcular posiciones en el texto original
                  const currentToolPos = tool.position;
                  const prevToolEndPos = index > 0 ?
                    sortedTools[index - 1].position + `[TOOL:${sortedTools[index - 1].toolId}]`.length :
                    0;

                  // Extraer texto entre herramientas
                  const originalTextBetween = content.substring(prevToolEndPos, currentToolPos);
                  const formattedTextBetween = formatContent(originalTextBetween);

                  if (formattedTextBetween) {
                    parts.push(
                      <div
                        key={`content-${index}`}
                        dangerouslySetInnerHTML={{ __html: formattedTextBetween }}
                        style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                      />
                    );
                  }

                  // Añadir botón individual para esta herramienta (en nueva línea)
                  parts.push(
                    <div key={`tool-${index}`} className="my-2">
                      <button
                        onClick={() => navigateToTool(tool.toolId)}
                        className="flex items-center px-3 py-2 bg-white dark:bg-neutral-800 rounded-md shadow-sm hover:shadow-md transition-shadow border border-neutral-200 dark:border-neutral-700"
                      >
                        <div className="mr-2">
                          {isValidToolId(tool.toolId) && toolsConfig[tool.toolId as ToolId].icon}
                        </div>
                        <span className="text-sm text-neutral-700 dark:text-neutral-300">
                          {isValidToolId(tool.toolId) && toolsConfig[tool.toolId as ToolId].name}
                        </span>
                      </button>
                    </div>
                  );

                  // Para la última herramienta, añadir el texto final
                  if (index === sortedTools.length - 1) {
                    const finalToolEndPos = currentToolPos + `[TOOL:${tool.toolId}]`.length;
                    const originalTextAfter = content.substring(finalToolEndPos);
                    const formattedTextAfter = formatContent(originalTextAfter);

                    if (formattedTextAfter) {
                      parts.push(
                        <div
                          key="content-final"
                          dangerouslySetInnerHTML={{ __html: formattedTextAfter }}
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                        />
                      );
                    }
                  }

                  return parts;
                }, [])}
            </>
          ) : (
            // Sin herramientas intercaladas, mostrar el contenido completo
            <div dangerouslySetInnerHTML={{ __html: formattedContent }} style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }} />
          )}
        </div>

        {/* Mostrar herramientas al final (TODAS EN HORIZONTAL) */}
        {!isUserMessage && endingTools.length > 0 && (
          <div className="mt-3 mb-2">
            <div className="flex flex-wrap gap-2 justify-center">
              {endingTools.map((toolId) => {
                if (!isValidToolId(toolId)) return null;
                const validToolId = toolId as ToolId;
                const tool = toolsConfig[validToolId];

                return (
                  <button
                    key={validToolId}
                    onClick={() => navigateToTool(validToolId)}
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
        )}
      </div>
    );
  };

  // Scroll automático al final de los mensajes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, isTypewriting]);

  return (
    <div className="chat-messages flex-1 overflow-y-auto p-2 md:p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="text-center text-neutral-500 dark:text-neutral-400 mt-8">
          {t('chat.noMessages')}
        </div>
      ) : (
        <>
          {/* Renderizar mensajes normales */}
          {messages.map(renderMessage)}

          {/* Mensaje con efecto typewriting en tiempo real */}
          {isTypewriting && (
            <StreamingMessage className="mr-auto w-full md:w-[90%] lg:w-[750px] mx-auto" />
          )}
        </>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatContainer;