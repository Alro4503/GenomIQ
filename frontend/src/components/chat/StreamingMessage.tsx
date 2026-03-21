import React, { useEffect, useState, useRef } from 'react';
import { useChat } from '@/context/ChatContext';
import { useRouter } from 'next/navigation';
import { 
  BeakerIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CubeIcon,
  TagIcon
} from '@heroicons/react/24/outline';

interface StreamingMessageProps {
  className?: string;
  inFloatingChat?: boolean; // Prop para indicar si estamos en FloatingChat
}

// Definir un tipo para el mapeo de herramientas a iconos
type ToolIconMap = {
  [key: string]: React.ReactNode;
};

// Definir un tipo para los datos de herramientas
type ToolId = 'blast' | 'alignment' | 'translation' | 'visualization' | 'annotation';

// Configuración de herramientas
type ToolsConfigType = {
  [key in ToolId]: {
    name: string;
    icon: React.ReactNode;
    url: string;
    description: string;
  };
};

// Interfaz para representar una posición de herramienta en el texto
interface ToolPosition {
  toolId: ToolId;
  position: number;
}

const StreamingMessage: React.FC<StreamingMessageProps> = ({ 
  className = '', 
  inFloatingChat = false 
}) => {
  const { 
    isTypewriting, 
    typewriterContent, 
    typewriterTools,
    currentConversation,
    typewriterConversationId
  } = useChat();
  
  const [displayText, setDisplayText] = useState<string>('');
  const [cursorVisible, setCursorVisible] = useState<boolean>(true);
  const previousLengthRef = useRef<number>(0);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  // Mapeo de herramientas a iconos
  const toolIcons: ToolIconMap = {
    'blast': <BeakerIcon className="h-6 w-6 text-blue-500" />,
    'alignment': <ArrowPathIcon className="h-6 w-6 text-blue-500" />,
    'translation': <DocumentTextIcon className="h-6 w-6 text-blue-500" />,
    'visualization': <CubeIcon className="h-6 w-6 text-blue-500" />,
    'annotation': <TagIcon className="h-6 w-6 text-blue-500" />
  };

  // Configuración de herramientas
  const toolsConfig: ToolsConfigType = {
    'blast': {
      name: 'BLAST',
      icon: <BeakerIcon className="h-6 w-6 text-blue-500" />,
      url: '/tools/blast',
      description: 'Búsqueda de secuencias similares'
    },
    'alignment': {
      name: 'Alineamiento',
      icon: <ArrowPathIcon className="h-6 w-6 text-blue-500" />,
      url: '/tools/alignment',
      description: 'Alineamiento múltiple de secuencias'
    },
    'translation': {
      name: 'Traducción',
      icon: <DocumentTextIcon className="h-6 w-6 text-blue-500" />,
      url: '/tools/translation',
      description: 'Traducción de secuencias de ADN/ARN a proteínas'
    },
    'visualization': {
      name: 'Visualización',
      icon: <CubeIcon className="h-6 w-6 text-blue-500" />,
      url: '/tools/visualization',
      description: 'Visualización 3D de estructuras moleculares'
    },
    'annotation': {
      name: 'Anotación',
      icon: <TagIcon className="h-6 w-6 text-blue-500" />,
      url: '/tools/annotation',
      description: 'Anotación funcional de secuencias'
    },
  };
  
  // Helper function to check if a string is a valid ToolId
  const isValidToolId = (id: string): id is ToolId => {
    return id in toolsConfig;
  };
  
  // Función para navegar a la herramienta seleccionada
  const navigateToTool = (toolId: string) => {
    if (isValidToolId(toolId)) {
      router.push(toolsConfig[toolId].url);
    }
  };
  
  // Verificar si el streaming pertenece a la conversación actual
  const shouldShowStreaming = () => {
    // Si no hay streaming activo, no mostrar nada
    if (!isTypewriting) return false;
    
    // Si no hay conversación actual seleccionada pero hay streaming activo, mostrar
    // (esto ocurre cuando se empieza una nueva conversación)
    if (!currentConversation) return true;
    
    // Si hay una conversación seleccionada, verificar que el streaming pertenece a esa conversación
    // o que no tiene una conversación específica asignada (compatibilidad con versiones anteriores)
    return !typewriterConversationId || currentConversation.id === typewriterConversationId;
  };
  
  // Efecto para crear animación de cursor parpadeante
  useEffect(() => {
    if (!shouldShowStreaming()) return;
    
    const cursorInterval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);
    
    return () => clearInterval(cursorInterval);
  }, [isTypewriting, currentConversation, typewriterConversationId]);
  
  // Función para eliminar las etiquetas de herramientas del texto
  const formatContent = (content: string): string => {
    return content.replace(/\[TOOL:(blast|alignment|translation|visualization|annotation)\]/gi, '');
  };
  
  // Función para detectar posiciones de herramientas en el texto
  const detectToolPositions = (text: string): ToolPosition[] => {
    const positions: ToolPosition[] = [];
    const toolRegex = /\[TOOL:(blast|alignment|translation|visualization|annotation)\]/gi;
    let match;
    
    while ((match = toolRegex.exec(text)) !== null) {
      const toolIdStr = match[1].toLowerCase();
      if (isValidToolId(toolIdStr)) {
        positions.push({
          toolId: toolIdStr,
          position: match.index
        });
      }
    }
    
    return positions;
  };
  
  // Función para manejar correctamente las etiquetas HTML durante la escritura
  const processHTMLForTyping = (fullText: string, currentLength: number): string => {
    if (currentLength === 0) return '';
    
    // Eliminar primero todas las etiquetas de herramientas
    let processedText = formatContent(fullText);
    
    // Crear un estado válido de HTML incluso cuando se corta a mitad de una etiqueta
    
    // Manejar etiquetas <strong>...</strong>
    const strongOpenCount = (processedText.substring(0, currentLength).match(/<strong>/g) || []).length;
    const strongCloseCount = (processedText.substring(0, currentLength).match(/<\/strong>/g) || []).length;
    
    // Manejar etiquetas <h3>...</h3>
    const h3OpenCount = (processedText.substring(0, currentLength).match(/<h3>/g) || []).length;
    const h3CloseCount = (processedText.substring(0, currentLength).match(/<\/h3>/g) || []).length;
    
    // Cortar el texto a la longitud actual
    let displayText = processedText.substring(0, currentLength);
    
    // Cerrar etiquetas abiertas si es necesario
    if (strongOpenCount > strongCloseCount) {
      displayText += '</strong>';
    }
    
    if (h3OpenCount > h3CloseCount) {
      displayText += '</h3>';
    }
    
    return displayText;
  };
  
  // Mejorado: Efecto para actualizar el texto mostrado gradualmente con formato HTML correcto
  useEffect(() => {
    if (!shouldShowStreaming()) {
      // Resetear el estado si no deberíamos mostrar streaming
      setDisplayText('');
      previousLengthRef.current = 0;
      return;
    }
    
    // Si es nuevo contenido desde la última actualización
    if (typewriterContent.length > previousLengthRef.current) {
      // Determinar qué nuevo texto añadir
      const newChunk = typewriterContent.substring(previousLengthRef.current);
      previousLengthRef.current = typewriterContent.length;
      
      // Para chunks pequeños, actualizar inmediatamente
      if (newChunk.length <= 3) {
        setDisplayText(prev => {
          const newLength = prev.length + newChunk.length;
          return processHTMLForTyping(typewriterContent, newLength);
        });
        return;
      }
      
      // Para chunks más grandes, mostrarlos gradualmente
      let charIndex = 0;
      const currentText = displayText;
      
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
          setDisplayText(processHTMLForTyping(typewriterContent, newLength));
          
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
      setDisplayText(typewriterContent);
    }
  }, [typewriterContent, shouldShowStreaming, displayText]);
  
  // Efecto para reiniciar el estado cuando comienza una nueva sesión de typewriting
  useEffect(() => {
    if (shouldShowStreaming()) {
      // Reiniciar cuando comienza una nueva sesión
      if (displayText === '') {
        previousLengthRef.current = 0;
      }
    } else {
      // Limpiar cuando termina o cambia de conversación
      setDisplayText('');
      previousLengthRef.current = 0;
    }
  }, [shouldShowStreaming, displayText]);

  // Efecto para hacer scroll al final cuando se agrega nuevo texto
  useEffect(() => {
    if (messageContainerRef.current && displayText) {
      const element = messageContainerRef.current;
      element.scrollTop = element.scrollHeight;
    }
  }, [displayText]);

  // Renderizar botones de herramientas horizontalmente
  const renderToolButtons = (tools: ToolId[]) => {
    if (!tools || tools.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 justify-start mt-2 mb-3">
        {tools.map((toolId) => (
          <button
            key={toolId}
            onClick={() => navigateToTool(toolId)}
            className="flex flex-col items-center p-2 bg-white dark:bg-neutral-800 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-neutral-200 dark:border-neutral-700 w-20 sm:w-24"
          >
            <div className="mb-1">
              {toolIcons[toolId]}
            </div>
            <span className="text-xs text-neutral-700 dark:text-neutral-300 truncate w-full text-center">
              {toolsConfig[toolId].name}
            </span>
          </button>
        ))}
      </div>
    );
  };
  
  // Si no hay que mostrar streaming, no renderizar nada
  if (!shouldShowStreaming()) return null;
  
  // Preparar el contenido formateado sin etiquetas de herramientas
  const formattedContent = formatContent(displayText);
  
  // Detectar herramientas en el contenido actual
  const toolsInContent = detectToolPositions(displayText);
  
  // Separamos en herramientas intercaladas vs herramientas al final
  // Para simplificar, consideramos que las herramientas están al final si aparecen 
  // después del 90% del contenido
  const contentLength = formattedContent.length;
  const contentThreshold = contentLength * 0.9;
  
  const inlineTools: ToolPosition[] = [];
  const endingTools: ToolId[] = [];
  
  toolsInContent.forEach(tool => {
    // Si la etiqueta está cerca del final, la consideramos "al final"
    if (tool.position > contentThreshold) {
      // Solo añadir si aún no está en la lista
      if (!endingTools.includes(tool.toolId)) {
        endingTools.push(tool.toolId);
      }
    } else {
      inlineTools.push(tool);
    }
  });
  
  // También incluir las herramientas que vienen del state global (typewriterTools)
  typewriterTools.forEach(toolId => {
    if (isValidToolId(toolId) && !endingTools.includes(toolId)) {
      // Verificar si la herramienta ya está en inlineTools
      const alreadyInlined = inlineTools.some(t => t.toolId === toolId);
      if (!alreadyInlined) {
        endingTools.push(toolId);
      }
    }
  });
  
  // Estructura responsiva usando w-full en móvil y porcentajes/tamaños específicos en pantallas más grandes
  return (
    <div className={`chat-message rounded-lg p-4 bg-neutral-100 dark:bg-neutral-800 ${
      inFloatingChat 
        ? 'max-w-[85%]' 
        : 'w-full md:w-[90%] lg:w-[750px] mx-auto'
    } ${className}`}>
      <div className="flex justify-between items-start mb-1">
        <div className="font-medium text-neutral-700 dark:text-neutral-300">
          GenomIQ AI
        </div>
        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
      
      <div 
        ref={messageContainerRef}
        className="text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap break-words"
        style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
      >
        {/* Mostrar el contenido con herramientas intercaladas */}
        {inlineTools.length === 0 ? (
          // Sin herramientas intercaladas, mostrar todo el contenido con el cursor inline
          <div style={{ display: 'inline' }}>
            <span 
              dangerouslySetInnerHTML={{ __html: formattedContent }} 
              style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }} 
            />
            {/* Cursor inline con espacio reservado para evitar saltos de layout */}
            <span className="inline-block" style={{ width: cursorVisible ? 'auto' : '0', overflow: 'hidden', minWidth: '1px' }}>
              {cursorVisible && <span className="animate-pulse">▌</span>}
              {!cursorVisible && <span style={{ opacity: 0 }}>▌</span>}
            </span>
          </div>
        ) : (
          // Con herramientas intercaladas, dividir el contenido
          // Para simplificar, solo implementaremos un proceso básico
          // que divide el contenido en las posiciones donde detecta herramientas
          <>
            {inlineTools
              .sort((a, b) => a.position - b.position) // Ordenar por posición
              .reduce((parts: JSX.Element[], tool, index, sortedTools) => {
                // Calcular posiciones en el texto formateado
                const currentToolPos = tool.position;
                const prevToolEndPos = index > 0 ? sortedTools[index-1].position + `[TOOL:${sortedTools[index-1].toolId}]`.length : 0;
                
                // Extraer texto entre herramientas
                const originalTextBetween = displayText.substring(prevToolEndPos, currentToolPos);
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
                
                // Añadir botón individual para esta herramienta
                parts.push(
                  <button
                    key={`tool-${index}`}
                    onClick={() => navigateToTool(tool.toolId)}
                    className="inline-flex items-center px-2 py-1 ml-1 mr-1 my-1 bg-white dark:bg-neutral-800 rounded-md shadow-sm hover:shadow-md transition-shadow border border-neutral-200 dark:border-neutral-700"
                  >
                    <div className="mr-1">
                      {React.cloneElement(toolIcons[tool.toolId] as React.ReactElement, { className: "h-4 w-4 text-blue-500" })}
                    </div>
                    <span className="text-xs text-neutral-700 dark:text-neutral-300">
                      {toolsConfig[tool.toolId].name}
                    </span>
                  </button>
                );
                
                // Para la última herramienta, añadir el texto final
                if (index === sortedTools.length - 1) {
                  const finalToolEndPos = currentToolPos + `[TOOL:${tool.toolId}]`.length;
                  const originalTextAfter = displayText.substring(finalToolEndPos);
                  const formattedTextAfter = formatContent(originalTextAfter);
                  
                  if (formattedTextAfter) {
                    parts.push(
                      <div 
                        key="content-final" 
                        style={{ display: 'inline' }}
                      >
                        <span 
                          dangerouslySetInnerHTML={{ __html: formattedTextAfter }} 
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word' }}
                        />
                      </div>
                    );
                  }
                }
                
                return parts;
              }, [])}
              
            {/* Cursor al final, después de las herramientas intercaladas */}
            <span className="inline-block" style={{ width: cursorVisible ? 'auto' : '0', overflow: 'hidden', minWidth: '1px' }}>
              {cursorVisible && <span className="animate-pulse">▌</span>}
              {!cursorVisible && <span style={{ opacity: 0 }}>▌</span>}
            </span>
          </>
        )}
        
        {/* Mostrar herramientas al final horizontalmente */}
        {endingTools.length > 0 && renderToolButtons(endingTools)}
      </div>
    </div>
  );
};

export default StreamingMessage;