'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { useChat } from '@/context/ChatContext';
import ChatContainer from '@/components/chat/ChatContainer';
import MessageInput from '@/components/chat/MessageInput';
import ChatHistory from '@/components/chat/ChatHistory';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

const ChatContent: React.FC = () => {
  const { t } = useTranslation();
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [loadingDuration, setLoadingDuration] = useState<number>(0);
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);
  
  const {
    conversations,
    currentConversation,
    messages,
    loading,
    isProcessingLongRequest,
    error,
    sendMessage,
    selectConversation,
    createNewConversation,
    fetchConversations,
    deleteChat
  } = useChat();
  
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
  
  // Verificar si es una nueva conversación (sin mensajes)
  const isNewConversation = messages.length === 0;
  
  // Toggle para el sidebar en escritorio
  const toggleSidebar = () => {
    setSidebarExpanded(!sidebarExpanded);
  };
  
  // Toggle para el sidebar en móvil
  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  };
  
  // Función para crear nueva conversación en móvil
  const handleNewConversationMobile = () => {
    createNewConversation();
    setMobileSidebarOpen(false); // Cerrar sidebar después de crear
  };
  
  // Función para seleccionar conversación en móvil
  const handleSelectConversationMobile = (id: number) => {
    selectConversation(id);
    setMobileSidebarOpen(false); // Cerrar sidebar después de seleccionar
  };
  
  // Función para enviar mensaje que maneja correctamente los estados de carga
  const handleSendMessage = async (content: string) => {
    if (!loading && !isProcessingLongRequest) {
      await sendMessage(content);
    }
  };
  
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-1 flex overflow-hidden relative">
        {/* Botones en la parte superior izquierda en móvil - solo visibles en móvil */}
        <div className="md:hidden absolute top-2 left-2 z-20 flex space-x-2">
          {/* Botón de historial de conversaciones */}
          <button
            onClick={toggleMobileSidebar}
            className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800"
            aria-label={t('chat.expandSidebar')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          </button>
          
          {/* Botón de nueva conversación */}
          <button
            onClick={handleNewConversationMobile}
            className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
            aria-label={t('chat.newConversation')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
        
        {/* Historial de conversaciones en escritorio - siempre oculto en móvil */}
        <div className="hidden md:block transition-all duration-300 ease-in-out h-full">
          <ChatHistory
            conversations={conversations}
            currentConversationId={currentConversation?.id || null}
            onSelectConversation={selectConversation}
            onDeleteConversation={deleteChat}
            onNewConversation={createNewConversation}
            isExpanded={sidebarExpanded}
            onToggleExpand={toggleSidebar}
          />
        </div>
        
        {/* Historial de conversaciones en móvil - modal que aparece/desaparece */}
        {mobileSidebarOpen && (
          <div className="md:hidden fixed inset-0 z-40 flex top-[4rem]">
            {/* Overlay/fondo oscuro para cerrar el modal al hacer clic fuera */}
            <div 
              className="absolute inset-0 bg-black bg-opacity-50"
              onClick={toggleMobileSidebar}
            ></div>
            
            {/* Panel lateral para móvil - altura completa comenzando después del navbar */}
            <div className="relative w-4/5 max-w-xs bg-white dark:bg-neutral-900 h-full">
              <ChatHistory
                conversations={conversations}
                currentConversationId={currentConversation?.id || null}
                onSelectConversation={handleSelectConversationMobile}
                onDeleteConversation={deleteChat}
                onNewConversation={handleNewConversationMobile}
                isExpanded={true}
                onToggleExpand={toggleMobileSidebar} // Usamos la función de cerrar modal
              />
            </div>
          </div>
        )}
        
        {/* Contenedor principal del chat - corregido para ancho móvil */}
        <div 
          ref={mainContentRef}
          className="flex-1 flex flex-col overflow-hidden relative transition-all duration-300 ease-in-out w-full"
        >
          {!isNewConversation && (
            /* Contenedor de mensajes - solo se muestra si hay mensajes existentes */
            <div className="flex-1 overflow-y-auto pb-32 w-full">
              <ChatContainer
                messages={messages}
                loading={loading}
              />
            </div>
          )}
          
          {/* Entrada de mensajes - posicionada según si es una nueva conversación o no */}
          <div className={`${isNewConversation ? 'absolute inset-0 flex flex-col items-center justify-center w-full' : 'absolute bottom-0 left-0 right-0 z-10 pb-4 md:pb-12 w-full'}`}>
            <div className={`${isNewConversation ? 'w-full max-w-xl px-2 sm:px-4' : 'max-w-4xl mx-auto w-full px-2 sm:px-4'}`}>
              {/* Mensaje de bienvenida cuando es una nueva conversación */}
              {isNewConversation && (
                <div className="text-center mb-3 text-base md:text-lg font-medium text-neutral-700 dark:text-neutral-300 px-2 sm:px-4">
                  {t('chat.welcomeMessage')}
                </div>
              )}
              
              {/* Mensaje de error si hay alguno */}
              {error && (
                <div className="mb-3 p-2 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 text-sm rounded-lg">
                  {error}
                </div>
              )}
              
              {/* Componente de entrada de mensajes mejorado con estado de procesamiento */}
              <MessageInput
                onSendMessage={handleSendMessage}
                loading={loading}
                isProcessingLongRequest={isProcessingLongRequest}
                loadingDuration={loadingDuration}
              />
              
              {/* Aviso de descargo de responsabilidad - siempre debajo del input */}
              <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 text-center px-2">
                {t('chat.disclaimer')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Página principal con protección de ruta
export default function ChatPage() {
  return (
    <ProtectedRoute requireAuth={true} redirectUnauthenticated="/auth/login">
      <ChatContent />
    </ProtectedRoute>
  );
}