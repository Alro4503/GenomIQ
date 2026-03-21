'use client';

import React from 'react';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import Link from 'next/link';
import { useTranslation } from '@/context/TranslationProvider'; // Añadimos el hook de traducción
import {
  ChatBubbleLeftRightIcon,
  BeakerIcon,
} from '@heroicons/react/24/outline';

const DashboardContent: React.FC = () => {
  // Obtenemos el usuario del contexto de autenticación
  const { user } = useAuth();
  // Añadimos el hook de traducción
  const { t } = useTranslation();
  
  // Obtenemos el nombre del usuario o usamos su email como fallback
  const getFirstName = (): string => {
    if (!user) return '';
    
    if (user.full_name && user.full_name.trim().length > 0) {
      // Dividimos el nombre completo y obtenemos solo el primer nombre
      const nameParts = user.full_name.trim().split(' ');
      return nameParts[0];
    }
    
    // Si no hay nombre completo, usamos la parte del email antes del @
    return user.email.split('@')[0];
  };
  
  return (
    <div className="p-6 mx-auto max-w-6xl">
      {/* Welcome banner */}
      <div className="mb-8 bg-white dark:bg-neutral-900 rounded-xl p-8 border border-neutral-200 dark:border-neutral-800 hover:shadow-md transition-all">
        <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 mb-3">
          {t('dashboard.welcome').replace('{{name}}', getFirstName())}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 text-lg">
          {t('dashboard.summary')}
        </p>
      </div>
      
      {/* Main navigation blocks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <Link href="/chat">
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md transition-all group">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4 group-hover:bg-blue-200 dark:group-hover:bg-blue-800/40 transition-colors">
                <ChatBubbleLeftRightIcon className="h-12 w-12 text-blue-500 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">{t('nav.chat')}</h2>
              <p className="text-neutral-600 dark:text-neutral-400">{t('chat.newConversation')}</p>
            </div>
          </div>
        </Link>
        
        <Link href="/tools">
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md transition-all group">
            <div className="flex flex-col items-center text-center">
              <div className="p-4 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4 group-hover:bg-purple-200 dark:group-hover:bg-purple-800/40 transition-colors">
                <BeakerIcon className="h-12 w-12 text-purple-500 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-neutral-800 dark:text-neutral-200 mb-2">{t('tools.title')}</h2>
              <p className="text-neutral-600 dark:text-neutral-400">{t('dashboard.toolsDescription')}</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

// Página principal que usa ProtectedRoute para requerir autenticación
export default function DashboardPage() {
  return (
    <ProtectedRoute requireAuth={true} redirectUnauthenticated="/auth/login">
      <DashboardContent />
    </ProtectedRoute>
  );
}