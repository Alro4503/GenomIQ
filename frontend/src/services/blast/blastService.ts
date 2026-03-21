// Use environment variable to determine API base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL
  ? `${process.env.NEXT_PUBLIC_API_URL}/api/tools/blast`
  : '/api/tools/blast';

console.log("BLAST API URL:", API_BASE_URL);

import { BlastJobCreate, BlastJob, BlastJobStatus, BlastResults } from '@/types/blast';

/**
 * Servicio para interactuar con la API de BLAST
 */
export const blastService = {
  /**
   * Obtiene los headers comunes incluyendo el token de autenticación
   */
  getHeaders(): Record<string, string> {
    // Obtenemos el token del localStorage (donde lo guarda AuthContext)
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  },

  /**
   * Maneja errores de respuesta de API
   */
  handleApiError(response: Response, customMessage?: string): void {
    console.error(`BLAST API Error: ${response.status} ${response.statusText}`);

    if (response.status === 401) {
      // Redirigir al login si hay error de autenticación
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/auth/login?redirectTo=' + encodeURIComponent(window.location.pathname);
      }
      throw new Error('Sesión expirada. Por favor, vuelve a iniciar sesión.');
    } else if (response.status === 503) {
      throw new Error('El servicio BLAST está temporalmente no disponible. Por favor, inténtalo más tarde.');
    } else {
      throw new Error(customMessage || `Error (${response.status}): ${response.statusText}`);
    }
  },

  /**
   * Crea una nueva búsqueda BLAST
   */
  async createSearch(blastData: BlastJobCreate): Promise<BlastJob> {
    console.log("Creating BLAST search with cleaned data:", {
      ...blastData,
      sequence: `${blastData.sequence.substring(0, 50)}... (${blastData.sequence.length} chars)`
    });

    // Validación local antes de enviar
    if (!blastData.sequence || blastData.sequence.trim().length === 0) {
      throw new Error('La secuencia no puede estar vacía');
    }

    // Limpiar la secuencia de espacios en blanco y validar longitud
    const cleanSequence = blastData.sequence.replace(/\s+/g, '').toUpperCase();
    if (cleanSequence.length < 10) {
      throw new Error('La secuencia debe tener al menos 10 caracteres válidos');
    }

    // Asegurar que enviamos la secuencia limpia
    const cleanedBlastData = {
      ...blastData,
      sequence: cleanSequence
    };

    console.log("Using URL:", `${API_BASE_URL}/search`);
    console.log("Cleaned sequence length:", cleanSequence.length);

    try {
      const response = await fetch(`${API_BASE_URL}/search`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(cleanedBlastData),
        credentials: 'include'
      });

      console.log("BLAST search response status:", response.status);

      if (!response.ok) {
        console.error("Response not OK, getting text...");
        const errorText = await response.text();
        console.error("Error text:", errorText);

        // Intentar parsear el error para obtener más detalles
        try {
          const errorData = JSON.parse(errorText);
          if (errorData.detail && Array.isArray(errorData.detail)) {
            const sequenceError = errorData.detail.find((err: any) =>
              err.loc && err.loc.includes('sequence')
            );
            if (sequenceError) {
              throw new Error(sequenceError.msg || 'Error de validación de secuencia');
            }
          }
          throw new Error(errorData.message || errorData.detail || 'Error al crear búsqueda BLAST');
        } catch (parseError) {
          this.handleApiError(response, 'Error al crear búsqueda BLAST');
        }
      }

      return await response.json();
    } catch (error) {
      console.error('Error en createSearch:', error);
      throw error;
    }
  },

  /**
   * Obtiene todos los trabajos BLAST del usuario
   */
  async getJobs(skip = 0, limit = 100): Promise<BlastJob[]> {
    console.log("Getting BLAST jobs with URL:", `${API_BASE_URL}/jobs?skip=${skip}&limit=${limit}`);

    try {
      const response = await fetch(`${API_BASE_URL}/jobs?skip=${skip}&limit=${limit}`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      console.log("BLAST jobs response status:", response.status);

      if (!response.ok) {
        console.error("Response not OK, getting text...");
        const errorText = await response.text();
        console.error("Error text:", errorText);
        this.handleApiError(response, 'Error al obtener trabajos BLAST');
      }

      return await response.json();
    } catch (error) {
      console.error('Error en getJobs:', error);
      throw error;
    }
  },

  /**
   * Obtiene información detallada de un trabajo BLAST
   */
  async getJob(jobId: number): Promise<BlastJob> {
    console.log("Getting BLAST job details with URL:", `${API_BASE_URL}/jobs/${jobId}`);

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      console.log("BLAST job details response status:", response.status);

      if (!response.ok) {
        console.error("Response not OK, getting text...");
        const errorText = await response.text();
        console.error("Error text:", errorText);
        this.handleApiError(response, 'Error al obtener información del trabajo BLAST');
      }

      return await response.json();
    } catch (error) {
      console.error(`Error en getJob (${jobId}):`, error);
      throw error;
    }
  },

  /**
   * Obtiene el estado actual de un trabajo BLAST
   */
  async getJobStatus(jobId: number): Promise<BlastJobStatus> {
    console.log("Getting BLAST job status with URL:", `${API_BASE_URL}/jobs/${jobId}/status`);

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/status`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      console.log("BLAST job status response status:", response.status);

      if (!response.ok) {
        console.error("Response not OK, getting text...");
        const errorText = await response.text();
        console.error("Error text:", errorText);
        this.handleApiError(response, 'Error al obtener estado del trabajo BLAST');
      }

      return await response.json();
    } catch (error) {
      console.error(`Error en getJobStatus (${jobId}):`, error);
      throw error;
    }
  },

  /**
   * Obtiene los resultados completos de un trabajo BLAST
   */
  async getResults(jobId: number): Promise<{ job_id: number; task_id: string; status: string; results: BlastResults }> {
    console.log("Getting BLAST results with URL:", `${API_BASE_URL}/jobs/${jobId}/results`);

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}/results`, {
        method: 'GET',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      console.log("BLAST results response status:", response.status);

      if (!response.ok) {
        console.error("Response not OK, getting text...");
        const errorText = await response.text();
        console.error("Error text:", errorText);
        this.handleApiError(response, 'Error al obtener resultados BLAST');
      }

      return await response.json();
    } catch (error) {
      console.error(`Error en getResults (${jobId}):`, error);
      throw error;
    }
  },

  /**
   * Elimina un trabajo BLAST
   */
  async deleteJob(jobId: number): Promise<{ message: string }> {
    console.log("Deleting BLAST job with URL:", `${API_BASE_URL}/jobs/${jobId}`);

    try {
      const response = await fetch(`${API_BASE_URL}/jobs/${jobId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
        credentials: 'include'
      });

      console.log("BLAST job delete response status:", response.status);

      if (!response.ok) {
        console.error("Response not OK, getting text...");
        const errorText = await response.text();
        console.error("Error text:", errorText);
        this.handleApiError(response, 'Error al eliminar trabajo BLAST');
      }

      return await response.json();
    } catch (error) {
      console.error(`Error en deleteJob (${jobId}):`, error);
      throw error;
    }
  },

  /**
   * Crea un cliente WebSocket para actualizaciones en tiempo real
   * @param clientId ID único del cliente
   * @returns WebSocket
   */
  createWebSocketClient(clientId: string): WebSocket {
    try {
      // Determine base URL for WebSocket
      let wsBaseUrl;

      if (process.env.NEXT_PUBLIC_API_URL) {
        // Extract hostname from NEXT_PUBLIC_API_URL
        const apiUrl = new URL(process.env.NEXT_PUBLIC_API_URL);
        const host = apiUrl.host;

        // Determinar protocolo (wss para https, ws para http)
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

        // Construir la URL del WebSocket - importante: mantener la estructura /api/tools/blast/ws/
        wsBaseUrl = `${protocol}//${host}/api/tools/blast/ws/${clientId}`;

        console.log("WebSocket URL (from env):", wsBaseUrl);
      } else {
        // For relative URLs, use current window location
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        wsBaseUrl = `${protocol}//${window.location.host}/api/tools/blast/ws/${clientId}`;

        console.log("WebSocket URL (from window location):", wsBaseUrl);
      }

      // Crear instancia de WebSocket
      const ws = new WebSocket(wsBaseUrl);

      // Añadir logs detallados para depuración
      ws.onopen = (event) => {
        console.log(`WebSocket conectado correctamente a ${wsBaseUrl}`, event);
      };

      ws.onerror = (error) => {
        console.error(`Error en WebSocket al conectar a ${wsBaseUrl}:`, error);
      };

      ws.onclose = (event) => {
        console.log(`WebSocket cerrado. Código: ${event.code}, Razón: ${event.reason}, Limpio: ${event.wasClean}`);
      };

      // Sobreescribir el método send para incluir token
      const originalSend = ws.send;
      ws.send = function (data) {
        console.log(`WebSocket intentando enviar datos a ${wsBaseUrl}`);

        // Si es un string JSON, añadir token
        if (typeof data === 'string') {
          try {
            let messageData;

            // Si ya es JSON, parsearlo; si no, crear objeto
            if (data.startsWith('{')) {
              messageData = JSON.parse(data);
            } else {
              messageData = { message: data };
            }

            const token = localStorage.getItem('token');
            const userId = localStorage.getItem('userId');

            // Asegurar que tenemos userId
            if (!messageData.user_id && userId) {
              messageData.user_id = parseInt(userId, 10);
            }

            // Añadir token para autenticación
            if (token) {
              messageData.token = token;
            }

            console.log("WebSocket enviando datos con autenticación:", {
              ...messageData,
              token: token ? 'PRESENT' : 'MISSING',
              user_id: messageData.user_id
            });

            return originalSend.call(this, JSON.stringify(messageData));
          } catch (e) {
            console.error('Error al procesar datos para WebSocket:', e);
            return originalSend.call(this, data);
          }
        }

        return originalSend.call(this, data);
      };

      return ws;
    } catch (error) {
      console.error('Error al crear cliente WebSocket:', error);
      throw error;
    }
  },

  /**
   * Método alternativo para realizar búsquedas BLAST usando HTTP en lugar de WebSocket
   * @param blastData Datos para la búsqueda BLAST
   * @returns Objeto con ID del trabajo y ID de tarea
   */
  async searchWithoutWebSocket(blastData: BlastJobCreate): Promise<{ jobId: number, taskId: string }> {
    console.log("Usando método HTTP alternativo para búsqueda BLAST");

    // Crear trabajo BLAST usando endpoint normal
    const job = await this.createSearch(blastData);

    return {
      jobId: job.id,
      taskId: job.task_id || ''
    };
  }
};

export default blastService;