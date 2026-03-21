'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { useChat } from '@/context/ChatContext';
import { ClockIcon } from '@heroicons/react/24/outline';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  loading: boolean;
  isProcessingLongRequest?: boolean;
  loadingDuration?: number;
}

const MessageInput: React.FC<MessageInputProps> = ({ 
  onSendMessage, 
  loading, 
  isProcessingLongRequest = false,
  loadingDuration = 0
}) => {
  const { t } = useTranslation();
  const [message, setMessage] = useState<string>('');
  const [textareaHeight, setTextareaHeight] = useState<number>(48);
  const { isTypewriting } = useChat(); // Añadir esto para detectar si hay typewriting en curso
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const [showLongRequestMessage, setShowLongRequestMessage] = useState<boolean>(false);
  
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (isProcessingLongRequest && loadingDuration > 10) {
      setShowLongRequestMessage(true);
    } else if (!isProcessingLongRequest) {
      timer = setTimeout(() => {
        setShowLongRequestMessage(false);
      }, 1000);
    }
    
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isProcessingLongRequest, loadingDuration]);
  
  // Ajustar automáticamente la altura del textarea
  useEffect(() => {
    if (textareaRef.current) {
      // Resetear altura al mínimo primero
      textareaRef.current.style.height = '48px';
      
      // Calcular si el contenido requiere más de una línea
      const scrollHeight = textareaRef.current.scrollHeight;
      const lineHeight = 24; // Altura aproximada de una línea de texto
      
      if (scrollHeight > lineHeight) {
        // Si necesita más de una línea, ajustar la altura
        const newHeight = Math.min(Math.max(48, scrollHeight), 120);
        setTextareaHeight(newHeight);
        textareaRef.current.style.height = `${newHeight}px`;
      } else {
        // Mantener la altura mínima si solo es una línea
        setTextareaHeight(48);
        textareaRef.current.style.height = '48px';
      }
    }
  }, [message]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !loading && !isProcessingLongRequest && !isTypewriting) { // Añadir verificación de !isTypewriting
      onSendMessage(message);
      setMessage('');
      setTextareaHeight(48);
      if (textareaRef.current) {
        textareaRef.current.style.height = '48px';
      }
    }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  const formatLoadingTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} segundos`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes} min ${remainingSeconds} seg`;
  };
  
  // Verificar si el input debería estar deshabilitado
  const isDisabled = loading || isProcessingLongRequest || isTypewriting;
  
  return (
    <div className="mx-auto border border-neutral-300 dark:border-neutral-700 rounded-xl shadow-lg p-4 bg-white dark:bg-neutral-900 relative">
      {showLongRequestMessage && (
        <div className="absolute -top-8 left-0 right-0 flex items-center justify-center">
          <div className="bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs rounded-full py-1 px-3 flex items-center shadow-md">
            <ClockIcon className="h-3 w-3 mr-1" />
            <span>Procesando respuesta ({formatLoadingTime(loadingDuration)})...</span>
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex items-center">
        <textarea
          ref={textareaRef}
          className={`w-full bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-lg resize-none py-3 px-4 text-neutral-700 dark:text-neutral-300 focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-500 transition-colors ${
            isDisabled ? 'opacity-70 cursor-not-allowed' : ''
          }`}
          rows={1}
          placeholder={
            isTypewriting
              ? t('chat.waitingTypewriter', { defaultValue: "Esperando a que termine de escribir..." })
              : isDisabled
              ? t('chat.waitingForResponse', { defaultValue: "Esperando respuesta..." })
              : t('chat.placeholder', { defaultValue: "Escribe un mensaje..." })
          }
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isDisabled}
          style={{ 
            height: `${textareaHeight}px`,
            overflow: 'hidden' // Siempre ocultar el scrollbar
          }}
        />
        
        <button
          type="submit"
          className={`ml-2 flex-shrink-0 transition-colors ${
            !message.trim() || isDisabled
              ? 'text-neutral-400 cursor-not-allowed'
              : 'text-blue-500 hover:text-blue-600'
          }`}
          disabled={!message.trim() || isDisabled}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>

      {isTypewriting && (
        <div className="mt-2 text-xs text-center text-neutral-500 dark:text-neutral-400 italic">
          La IA está escribiendo una respuesta. Por favor, espera...
        </div>
      )}
      
      {isProcessingLongRequest && loadingDuration > 60 && !isTypewriting && (
        <div className="mt-2 text-xs text-center text-neutral-500 dark:text-neutral-400 italic">
          Las respuestas largas pueden tardar hasta 5 minutos. No cierres esta ventana.
        </div>
      )}
    </div>
  );
};

export default MessageInput;