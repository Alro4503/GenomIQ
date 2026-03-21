'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

const GoogleCallbackHandler: React.FC = () => {
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [isProcessed, setIsProcessed] = useState(false); // Track if we've processed the code
  const { processGoogleCallback, setToken } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Keep page title as "GenomIQ"
  useEffect(() => {
    document.title = "GenomIQ";
  }, []);

  // Set success-tracking cookie immediately to handle parallel requests
  useEffect(() => {
    // Save a flag in sessionStorage to avoid double-processing across page refreshes
    if (sessionStorage.getItem('oauth_callback_processed') === 'true') {
      // We've already processed the callback in this session, just redirect
      router.push('/dashboard');
      return;
    }
  }, [router]);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log("Handling OAuth callback...");
        const code = searchParams?.get('code');
        const state = searchParams?.get('state');
        
        if (!code || !state) {
          setError('Faltan parámetros de autenticación');
          setTimeout(() => router.push('/auth/login'), 3000);
          return;
        }
        
        // Check if we've already processed the callback
        if (isProcessed || sessionStorage.getItem('oauth_callback_processed') === 'true') {
          router.push('/dashboard');
          return;
        }
        
        // Mark as processed to prevent duplicate processing
        setIsProcessed(true);
        sessionStorage.setItem('oauth_callback_processed', 'true');
        
        // Set a success flag cookie immediately to help other concurrent requests
        document.cookie = "auth_success_pending=true; path=/; max-age=30";
        
        // Determine if we're in production
        const isProduction = typeof window !== 'undefined' &&
          (window.location.hostname === 'genomiq.cat' || 
           window.location.hostname.endsWith('.genomiq.cat'));
        
        console.log(`Environment: ${isProduction ? 'Production' : 'Development'}`);
        
        if (isProduction) {
          // In production, try calling the API directly first
          try {
            console.log("Using direct API call for production...");
            const apiBaseUrl = `${window.location.protocol}//${window.location.hostname}/api`;
            const response = await fetch(
              `${apiBaseUrl}/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`,
              {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Accept': 'application/json',
                  'Cache-Control': 'no-cache',
                }
              }
            );
            
            if (response.ok) {
              const data = await response.json();
              if (data.access_token) {
                // Use the context to set the token
                setToken(data.access_token);
                
                // Set success cookie
                document.cookie = "auth_success=true; path=/; max-age=30";
                
                console.log('Direct API call successful, redirecting to dashboard');
                router.push('/dashboard');
                return;
              }
            } else {
              console.warn('Direct API call failed:', await response.text());
            }
          } catch (directError) {
            console.warn('Error with direct API call:', directError);
          }
        }
        
        // Process the OAuth callback using context method (fallback or development)
        try {
          console.log("Using context method for OAuth callback...");
          const success = await processGoogleCallback(code, state);
          
          if (success) {
            // Successful authentication
            document.cookie = "auth_success=true; path=/; max-age=30";
            console.log('Authentication successful, redirecting to dashboard');
            router.push('/dashboard');
          } else {
            // Silent failure - check if another request succeeded
            if (document.cookie.includes('auth_success=true')) {
              router.push('/dashboard');
            } else {
              // No request succeeded
              setError('Error durante la autenticación con Google');
              setTimeout(() => router.push('/auth/login'), 3000);
            }
          }
        } catch (err: any) {
          // Only show error if we don't have a success flag
          if (!document.cookie.includes('auth_success=true')) {
            setError(err.message || 'Error durante la autenticación con Google');
            setTimeout(() => router.push('/auth/login'), 3000);
          } else {
            // Another request succeeded, just redirect
            router.push('/dashboard');
          }
        }
      } finally {
        setIsProcessing(false);
      }
    };

    // Process the callback once if needed
    if (isProcessing && !isProcessed && sessionStorage.getItem('oauth_callback_processed') !== 'true') {
      handleCallback();
    }
  }, [searchParams, processGoogleCallback, router, isProcessing, isProcessed, setToken]);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-neutral-900 z-50">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-full animate-spin border-2 border-solid border-[#55A63F] border-t-transparent"></div>
        {error && (
          <div className="mt-4 text-red-500 dark:text-red-400">{error}</div>
        )}
      </div>
    </div>
  );
};

export default GoogleCallbackHandler;