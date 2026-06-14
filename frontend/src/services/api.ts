import axios, { AxiosRequestConfig } from 'axios';

// Determine API URL based on environment
const getApiBaseUrl = () => {
  // Portfolio demo: use relative URLs so Next.js API Routes handle everything
  return '';
};

// Create axios instance with better logging
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  // Aumentar timeout considerablemente para las peticiones de IA
  timeout: 120000, // 2 minutos por defecto (reducido de 3 minutos)
  // Add specific headers for better CORS handling
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// Portfolio demo: no auth token needed

// Add request interceptor for debugging
api.interceptors.request.use(
  (config) => {
    // Para las peticiones de chat, establecer un timeout moderado
    // Un timeout más corto nos permite recuperarnos más rápido y comenzar el polling
    if (config.url?.includes('/chat/message') || config.url?.includes('/chat/messages/')) {
      config.timeout = 60000; // 1 minuto para mensajes de chat (reducido de 5 minutos)
    }
    
    console.log(`Request: ${config.method?.toUpperCase()} ${config.url}`);
    // Log auth header for debugging (remove in production)
    if (config.headers && config.headers.Authorization) {
      console.log('Auth header present ✓');
    } else {
      console.warn('Auth header missing ⚠️');
    }
    
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for handling errors
api.interceptors.response.use(
  (response) => {
    // Verificar que la respuesta tiene un cuerpo y es válida
    if (!response.data) {
      console.warn(`Response has no data: ${response.config.url}`);
    }
    
    console.log(`Response: ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    // Detailed error logging
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      let errorData = 'Error data unavailable';
      try {
        errorData = JSON.stringify(error.response.data);
      } catch (e) {
        console.warn('Could not stringify error response data');
      }
      
      console.error('Response error:', {
        status: error.response.status,
        data: errorData,
        url: error.config?.url,
        method: error.config?.method
      });
      
      // Añadir información adicional para depuración en caso de errores 500
      if (error.response.status >= 500) {
        console.error('Server error details:', {
          headers: error.response.headers,
          timestamp: new Date().toISOString()
        });
      }
      
      // Portfolio demo: no auth redirects needed
      
      // Para errores relacionados con sequenceDatabaseService, proporcionar un mensaje claro
      if (error.config?.url?.includes('/tools/sequences/')) {
        console.warn('Sequence database service error. Check server logs for details.');
        
        // Si es un error de formato, intentar transformarlo en un error más amigable
        if (error.response.status === 422 || error.response.status === 500) {
          error.friendlyMessage = 'Error en la búsqueda de secuencias. Por favor, intenta con otra consulta.';
        }
      }
    } else if (error.code === 'ECONNABORTED') {
      // Timeout específico: ajustar el mensaje para facilitar la identificación
      console.warn('Timeout error detected:', {
        url: error.config?.url,
        method: error.config?.method,
        timeout: error.config?.timeout
      });
      
      // Personalizar el mensaje de error para hacerlo más identificable
      error.message = 'timeout: La solicitud excedió el tiempo límite.';
      
      // En caso de timeout para chat messages, guardar información para posible recuperación
      if (typeof window !== 'undefined' && 
          (error.config?.url?.includes('/chat/message') || error.config?.url?.includes('/chat/messages/'))) {
        try {
          if (error.config.data) {
            const requestData = JSON.parse(error.config.data);
            if (requestData.conversation_id) {
              localStorage.setItem('pendingChatRequest', requestData.conversation_id.toString());
            }
          }
        } catch (e) {
          console.error('Error al analizar datos de la solicitud:', e);
        }
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received:', {
        url: error.config?.url,
        method: error.config?.method,
        timeoutMessage: error.message
      });
      
      // Si es un error de red, ajustar el mensaje para facilitar identificación
      error.message = 'network: Error de conexión. No se recibió respuesta del servidor.';
    } else {
      // Something happened in setting up the request that triggered an Error
      console.error('Request setup error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// Helper function to set token programmatically
export const setAuthToken = (token: string) => {
  if (token) {
    // Apply to axios instance
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    // Store in localStorage
    localStorage.setItem('token', token);
    console.log('Auth token set ✓');
  } else {
    // Remove from axios instance
    delete api.defaults.headers.common['Authorization'];
    // Remove from localStorage
    localStorage.removeItem('token');
    console.log('Auth token cleared ✓');
  }
};

/**
 * Función especializada para peticiones de IA con mayor timeout
 */
export const aiRequest = {
  post: async (url: string, data: any) => {
    try {
      // Configuración específica para peticiones de IA - timeout más corto para
      // permitir que el polling se inicie más rápido
      const config: AxiosRequestConfig = {
        timeout: 60000, // 1 minuto (reducido de 5 minutos)
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Request-Type': 'ai-request' // Identificador para el backend
        }
      };
      
      // Add auth token if it exists
      const token = localStorage.getItem('token');
      if (token) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${token}`
        };
      }
      
      return await api.post(url, data, config);
    } catch (error) {
      console.error('Error en petición de IA:', error);
      throw error;
    }
  },
  
  // También ajustar el timeout para put
  put: async (url: string, data: any) => {
    try {
      // Configuración específica para peticiones de IA
      const config: AxiosRequestConfig = {
        timeout: 60000, // 1 minuto (reducido de 5 minutos)
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Request-Type': 'ai-request' // Identificador para el backend
        }
      };
      
      // Add auth token if it exists
      const token = localStorage.getItem('token');
      if (token) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${token}`
        };
      }
      
      return await api.put(url, data, config);
    } catch (error) {
      console.error('Error en petición de IA (PUT):', error);
      throw error;
    }
  }
};

export default api;