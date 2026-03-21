'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useTranslation } from '@/context/TranslationProvider';

const GoogleButton: React.FC = () => {
  const { initiateGoogleLogin, loading } = useAuth();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    // Prevenir múltiples clics
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      // Determine if we're in production based on hostname
      const isProduction = typeof window !== 'undefined' && 
        (window.location.hostname === 'genomiq.cat' || 
         window.location.hostname.endsWith('.genomiq.cat'));
      
      if (isProduction) {
        // Direct API call for production environment
        try {
          console.log('Using direct API call for production OAuth initiation');
          // Construct API URL based on current domain
          const apiBaseUrl = `${window.location.protocol}//${window.location.hostname}/api`;
          
          const response = await fetch(`${apiBaseUrl}/auth/google/login`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Cache-Control': 'no-cache',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.auth_url) {
              // Set a cookie to indicate OAuth is in progress
              document.cookie = "auth_in_progress=true; path=/; max-age=300";
              // Redirect to Google OAuth
              window.location.href = data.auth_url;
              return;
            }
          }
          // If direct call fails, we'll fall back to the context method
          console.warn('Direct API call failed, falling back to context method');
        } catch (directError) {
          console.warn('Error with direct API call, falling back to context method:', directError);
        }
      }
      
      // Fall back to context method if direct call failed or in development
      const response = await initiateGoogleLogin();
      
      // Verificar que tenemos una URL para redirigir
      if (response && response.auth_url) {
        // Set a cookie to indicate OAuth is in progress
        document.cookie = "auth_in_progress=true; path=/; max-age=300";
        // Redirigir usando window.location para una redirección completa
        window.location.href = response.auth_url;
      } else {
        throw new Error('No se recibió una URL de autenticación válida');
      }
    } catch (error) {
      console.error('Error al iniciar sesión con Google:', error);
      setIsLoading(false);
    }
  };

  // Detectar si estamos en la página de callback
  const isCallbackPage = typeof window !== 'undefined' && 
    window.location.pathname.includes('/auth/google/callback');

  // No mostrar el botón en la página de callback
  if (isCallbackPage) {
    return null;
  }

  return (
    <button
      onClick={handleGoogleLogin}
      disabled={loading || isLoading}
      className="flex items-center justify-center w-full px-4 py-2 space-x-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#55A63F] focus:ring-offset-2 transition duration-200 ease-in-out"
      type="button"
    >
      {(loading || isLoading) ? (
        <svg className="w-5 h-5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      ) : (
        <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
          <path fill="#FFC107" d="M43.6 20H24v8h11.3c-1.1 5.2-5.5 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l6.1-6.1C33.7 5.5 29.1 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-9 20-20c0-1.3-.2-2.7-.4-4z" />
          <path fill="#FF3D00" d="M6.3 14.7l7.1 5.2c1.8-4.7 6.3-8 11.6-8c3.1 0 5.9 1.2 8 3.1l6.1-6.1C33.7 5.5 29.1 4 24 4c-8.6 0-16 5.1-19.7 12.7z" />
          <path fill="#4CAF50" d="M24 44c4.9 0 9.5-1.6 13.1-4.3l-6.4-5.4c-2 1.3-4.6 2.1-6.7 2.1-5.8 0-10.5-3.9-12.1-9.1L4.4 32.7C8 39.6 15.5 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20H24v8h11.3c-0.6 2.5-2 4.6-4.2 6l6.4 5.4c3.8-3.5 6-8.6 6-14.8 0-1.3-.2-2.7-.4-4z" />
        </svg>
      )}
      <span>{t('auth.loginWithGoogle') || 'Continuar con Google'}</span>
    </button>
  );
};

export default GoogleButton;