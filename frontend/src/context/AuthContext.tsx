'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';

// Suppress specific console errors (only for OAuth errors)
// Original console.error function
const originalConsoleError = console.error;

// Override console.error to filter out expected OAuth errors
console.error = function(...args) {
  // Check if this is an OAuth error we want to suppress
  const isOAuthError = args.some(arg => {
    if (typeof arg === 'string') {
      return arg.includes('Error en el callback OAuth') || 
             arg.includes('Invalid or expired OAuth state') ||
             arg.includes('Error en el procesamiento del callback');
    }
    return false;
  });
  
  // Suppress expected OAuth errors if we have a success cookie
  if (isOAuthError && typeof document !== 'undefined' && 
      (document.cookie.includes('auth_success=true') || 
       document.cookie.includes('auth_success_pending=true'))) {
    return; // Suppress the error
  }
  
  // Call original console.error for other errors
  originalConsoleError.apply(console, args);
};

// User interface
interface User {
  id: number;
  email: string;
  full_name: string | null;
  language_preference: string;
  dark_mode: boolean;
  is_active: boolean;
  created_at: string;
  is_oauth_account?: boolean;
}

// Auth context interface
interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  token: string | null; // Added token to the context
  setToken: (token: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string, language?: string) => Promise<void>;
  logout: () => void;
  updateUserPreferences: (language?: string, darkMode?: boolean) => Promise<void>;
  initiateGoogleLogin: () => Promise<any>;
  processGoogleCallback: (code: string, state: string) => Promise<boolean>;
  setError: (error: string | null) => void;
}

// Create context
export const AuthContext = createContext<AuthContextType>({} as AuthContextType);

// Custom hook for using auth
export const useAuth = () => useContext(AuthContext);

// Auth provider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  
  const router = useRouter();

  // Function to maintain consistent title
  const maintainTitle = () => {
    document.title = "GenomIQ";
  };

  // Function to set token
  const setToken = (token: string) => {
    // Store token in localStorage
    localStorage.setItem('token', token);
    
    // Set token in state
    setTokenState(token);
    
    // Set token in API headers
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    // Maintain title
    maintainTitle();
  };

  // Initialize auth state
  useEffect(() => {
    const checkAuth = async () => {
      // Maintain title
      maintainTitle();
      
      const storedToken = localStorage.getItem('token');
      
      if (!storedToken) {
        setLoading(false);
        return;
      }
      
      try {
        // Set auth header for requests
        api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        
        // Set token in state
        setTokenState(storedToken);
        
        const response = await api.get('/api/auth/me');
        setUser(response.data);
      } catch (err) {
        // Clear invalid token
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        setTokenState(null);
        
        // Use custom logger to avoid displaying in console
        if (process.env.NODE_ENV === 'development') {
          originalConsoleError('Auth error:', err);
        }
      } finally {
        setLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  // Login function
  const login = async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    
    // Maintain title
    maintainTitle();
    
    try {
      const response = await api.post('/api/auth/login', { email, password });
      const { access_token } = response.data;
      
      // Use setToken function
      setToken(access_token);
      
      // Get user data
      const userResponse = await api.get('/api/auth/me');
      setUser(userResponse.data);
      
      // Maintain title
      maintainTitle();
      
      // Redirect to dashboard
      router.push('/dashboard');
    } catch (err: any) {
      // Use custom logger to avoid displaying in console
      if (process.env.NODE_ENV === 'development') {
        originalConsoleError('Login error:', err);
      }
      setError(err.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
      // Maintain title
      maintainTitle();
    }
  };

  // Register function
  const register = async (email: string, password: string, fullName?: string, language = 'en') => {
    setLoading(true);
    setError(null);
    
    // Maintain title
    maintainTitle();
    
    try {
      await api.post('/api/auth/register', { 
        email, 
        password, 
        full_name: fullName, 
        language_preference: language 
      });
      
      // Maintain title
      maintainTitle();
      
      // Auto login after registration
      await login(email, password);
    } catch (err: any) {
      // Use custom logger to avoid displaying in console
      if (process.env.NODE_ENV === 'development') {
        originalConsoleError('Registration error:', err);
      }
      setError(err.response?.data?.detail || 'Registration failed');
      setLoading(false);
      // Maintain title
      maintainTitle();
    }
  };

  // Logout function
  const logout = () => {
    // Clear token
    localStorage.removeItem('token');
    setTokenState(null);
    
    // Remove auth header
    delete api.defaults.headers.common['Authorization'];
    
    // Clear user state
    setUser(null);
    
    // Clear any OAuth related session storage and cookies
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('oauth_callback_processed');
      document.cookie = "auth_success=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "auth_success_pending=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      document.cookie = "auth_in_progress=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    }
    
    // Maintain title
    maintainTitle();
    
    // Redirect to home
    router.push('/');
  };

  // Update user preferences
  const updateUserPreferences = async (language?: string, darkMode?: boolean) => {
    if (!user) return;
    
    // Maintain title
    maintainTitle();
    
    try {
      const updateData: any = {};
      
      if (language !== undefined) {
        updateData.language_preference = language;
      }
      
      if (darkMode !== undefined) {
        updateData.dark_mode = darkMode;
      }
      
      const response = await api.patch('/api/auth/me', updateData);
      setUser(response.data);
    } catch (err) {
      // Use custom logger to avoid displaying in console
      if (process.env.NODE_ENV === 'development') {
        originalConsoleError('Update preferences error:', err);
      }
    }
    
    // Maintain title
    maintainTitle();
  };

  // Initiate Google login flow
  const initiateGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    
    // Maintain title
    maintainTitle();
    
    try {
      // Clear any existing OAuth session data
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('oauth_callback_processed');
        document.cookie = "auth_success=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "auth_success_pending=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "auth_in_progress=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      
      const response = await api.get('/api/auth/google/login');
      setLoading(false);
      
      // Maintain title
      maintainTitle();
      
      // Return response object to handle in component
      return response.data;
    } catch (err: any) {
      // Use silent error logging
      if (process.env.NODE_ENV === 'development') {
        originalConsoleError('Google login error:', err);
      }
      setError(err.response?.data?.detail || 'Error al iniciar sesión con Google');
      setLoading(false);
      
      // Maintain title
      maintainTitle();
      
      throw err;
    }
  };

  // Process Google OAuth callback
  const processGoogleCallback = async (code: string, state: string) => {
    setLoading(true);
    setError(null);
    
    // Maintain title
    maintainTitle();
    
    // If another request already succeeded, just fetch user data
    if (document.cookie.includes('auth_success=true')) {
      try {
        const storedToken = localStorage.getItem('token');
        if (storedToken) {
          api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
          setTokenState(storedToken);
          const userResponse = await api.get('/api/auth/me');
          setUser(userResponse.data);
          setLoading(false);
          return true;
        }
      } catch (e) {
        // Silently handle errors
      }
    }
    
    // Create unique request ID for tracing
    const requestId = Math.random().toString(36).substring(2, 15);
    
    try {
      // Create timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await api.get(
        `/api/auth/google/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}&_=${timestamp}&requestId=${requestId}`,
        { 
          timeout: 15000,
          headers: {
            'Cache-Control': 'no-cache, no-store',
            'Pragma': 'no-cache',
            'X-Request-ID': requestId
          }
        }
      );
      
      console.log('Respuesta recibida del servidor:', response.status);
      
      const { access_token } = response.data;
      
      if (!access_token) {
        throw new Error('No se recibió el token de acceso');
      }
      
      // Set success cookie
      document.cookie = "auth_success=true; path=/; max-age=30";
      
      // Save token
      setToken(access_token);
      
      // Get user data
      console.log('Obteniendo datos del usuario autenticado');
      const userResponse = await api.get('/api/auth/me');
      setUser(userResponse.data);
      
      console.log('Autenticación OAuth completada exitosamente');
      
      // Maintain title
      maintainTitle();
      
      return true;
    } catch (err: any) {
      // Check if another request already succeeded
      if (document.cookie.includes('auth_success=true')) {
        return true;
      }
      
      // Check if this is a "state already used" error
      const isStateError = err?.response?.data?.detail?.includes('Invalid or expired OAuth state');
      
      // Only log details in development mode and not for expected errors
      if (process.env.NODE_ENV === 'development' && !isStateError) {
        // Use the original console.error to avoid our filter
        originalConsoleError('OAuth callback details (silent):', {
          status: err.response?.status,
          message: err.message,
          requestId: requestId
        });
      }
      
      // If this is a state error and we have a pending cookie, don't treat as error
      if (isStateError && document.cookie.includes('auth_success_pending=true')) {
        // This is expected - another request is already processing
        return false;
      }
      
      // Set error message
      let errorMessage = 'Error durante la autenticación con Google';
      if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      
      // Maintain title
      maintainTitle();
      
      throw err;
    } finally {
      setLoading(false);
      maintainTitle();
    }
  };

  // Maintain title during component lifecycle
  useEffect(() => {
    maintainTitle();
    
    // Maintain title when auth state changes
    const titleObserver = setInterval(maintainTitle, 1000);
    
    // Clean up custom console.error override on component unmount
    return () => {
      clearInterval(titleObserver);
      
      // Restore original console.error when component unmounts
      if (typeof window !== 'undefined') {
        console.error = originalConsoleError;
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      error,
      token,
      setError,
      setToken,
      login, 
      register, 
      logout,
      updateUserPreferences,
      initiateGoogleLogin,
      processGoogleCallback
    }}>
      {children}
    </AuthContext.Provider>
  );
};