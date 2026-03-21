'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { Conversation } from '@/context/ChatContext';
import {
  BeakerIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CubeIcon,
  TagIcon
} from '@heroicons/react/24/outline';

interface ChatHistoryProps {
  conversations: Conversation[];
  currentConversationId: number | null;
  onSelectConversation: (id: number) => void;
  onDeleteConversation: (id: number) => Promise<void>;
  onNewConversation: () => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

// Definir un tipo para el mapeo de herramientas a iconos
type ToolIconMap = {
  [key: string]: React.ReactNode;
};

const ChatHistory: React.FC<ChatHistoryProps> = ({
  conversations,
  currentConversationId,
  onSelectConversation,
  onDeleteConversation,
  onNewConversation,
  isExpanded,
  onToggleExpand
}) => {
  const { t } = useTranslation();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<boolean>(false);
  
  // Mapeo de herramientas a iconos
  const toolIcons: ToolIconMap = {
    'blast': <BeakerIcon className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />,
    'alignment': <ArrowPathIcon className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />,
    'translation': <DocumentTextIcon className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />,
    'visualization': <CubeIcon className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />,
    'annotation': <TagIcon className="h-5 w-5 text-neutral-500 dark:text-neutral-400" />
  };
  
  // Iconos para conversaciones activas
  const activeToolIcons: ToolIconMap = {
    'blast': <BeakerIcon className="h-5 w-5 text-purple-500" />,
    'alignment': <ArrowPathIcon className="h-5 w-5 text-purple-500" />,
    'translation': <DocumentTextIcon className="h-5 w-5 text-purple-500" />,
    'visualization': <CubeIcon className="h-5 w-5 text-purple-500" />,
    'annotation': <TagIcon className="h-5 w-5 text-purple-500" />
  };
  
  // Formatear fecha para mostrar
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };
  
  // Iniciar proceso de eliminación
  const handleDeleteClick = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    setDeletingId(id);
    setConfirmDelete(true);
  };
  
  // Confirmar eliminación
  const handleConfirmDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deletingId) {
      await onDeleteConversation(deletingId);
      setConfirmDelete(false);
      setDeletingId(null);
    }
  };
  
  // Cancelar eliminación
  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDelete(false);
    setDeletingId(null);
  };
  
  // Determinar si la conversación está asociada a una herramienta
  const isToolConversation = (conversation: Conversation): boolean => {
    return !!conversation.tool_context;
  };
  
  // Obtener el icono adecuado para la herramienta
  const getToolIcon = (toolContext: string | undefined, isActive: boolean): React.ReactNode => {
    if (!toolContext) return null;
    return isActive ? activeToolIcons[toolContext] || null : toolIcons[toolContext] || null;
  };
  
  // Si está colapsado, mostrar solo la barra con el botón de expandir
  if (!isExpanded) {
    return (
      <div className="w-14 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col items-center py-6 transition-all duration-300 ease-in-out h-full">
        <button
          onClick={onToggleExpand}
          className="p-2 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 mb-4"
          aria-label={t('chat.expandSidebar')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={onNewConversation}
          className="p-2 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          aria-label={t('chat.newConversation')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    );
  }
  
  // Si está expandido, mostrar la versión completa con animación suave
  return (
    <div className="w-full md:w-64 lg:w-80 bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 flex flex-col h-full transition-all duration-300 ease-in-out">
      <div className="flex justify-between items-center p-4 border-b border-neutral-200 dark:border-neutral-800">
        <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          {t('chat.conversations')}
        </h3>
        <button
          onClick={onToggleExpand}
          className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300"
          aria-label={t('chat.collapseSidebar')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
          </svg>
        </button>
      </div>
      
      {/* Botón para nueva conversación con margen adecuado */}
      <div className="px-4 pt-4">
        <button
          onClick={onNewConversation}
          className="w-full py-2 px-4 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
        >
          {t('chat.newConversation')}
        </button>
      </div>
      
      {/* Lista de conversaciones con un solo scroll - SOLUCIÓN PARA MÓVIL */}
      <div 
        className="overflow-y-auto flex-grow mt-4 px-4 pb-4 w-full" 
        style={{ 
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        <div className="space-y-2 pb-4 w-full">
          {conversations.length === 0 ? (
            <div className="text-center text-neutral-500 dark:text-neutral-400 py-4">
              {t('chat.noConversations')}
            </div>
          ) : (
            <div className="space-y-2 w-full">
              {conversations.map((conversation) => {
                const isActive = currentConversationId === conversation.id;
                const isTool = isToolConversation(conversation);
                
                return (
                  <div
                    key={conversation.id}
                    className={`relative w-full rounded-lg ${
                      isActive
                        ? isTool
                          ? 'bg-purple-100 dark:bg-purple-900/30'
                          : 'bg-blue-100 dark:bg-blue-900/30'
                        : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                    }`}
                  >
                    <button
                      onClick={() => onSelectConversation(conversation.id)}
                      className={`w-full text-left py-2 px-3 rounded-lg transition-colors pr-8 flex items-center ${
                        isActive
                          ? isTool
                            ? 'text-purple-600 dark:text-purple-400'
                            : 'text-blue-600 dark:text-blue-400'
                          : 'text-neutral-700 dark:text-neutral-300'
                      }`}
                    >
                      {/* Icono de herramienta si la conversación está asociada a una */}
                      {isTool && (
                        <div className="mr-2 flex-shrink-0">
                          {getToolIcon(conversation.tool_context, isActive)}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="truncate font-medium">
                          {conversation.title}
                        </div>
                        <div className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                          {formatDate(conversation.updated_at)}
                        </div>
                      </div>
                    </button>
                    
                    {/* Botón de eliminar */}
                    {confirmDelete && deletingId === conversation.id ? (
                      <div className="absolute inset-0 flex items-center justify-center bg-neutral-100 dark:bg-neutral-800 bg-opacity-90 dark:bg-opacity-90 rounded-lg z-10">
                        <div className="flex space-x-2">
                          <button
                            onClick={handleConfirmDelete}
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
                        onClick={(e) => handleDeleteClick(e, conversation.id)}
                        className="absolute right-2 top-2 p-1 text-neutral-400 hover:text-red-500 transition-colors rounded-full hover:bg-neutral-200 dark:hover:bg-neutral-700"
                        aria-label={t('chat.deleteConversation')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHistory;