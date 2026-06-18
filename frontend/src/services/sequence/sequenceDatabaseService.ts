import api from '../api';

interface SearchResult {
  id: string;
  name: string;
  organism: string;
  length: number;
  type: 'dna' | 'rna' | 'protein';
  preview: string;
  sequence?: string;
}

interface SequenceResponse {
  sequence: string;
}

/**
 * Service for searching and retrieving biological sequences from databases
 */
const sequenceDatabaseService = {
  /**
   * Search for sequences in biological databases with retry logic
   * @param query Search query (can be keyword, name, ID, etc.)
   * @param type Type of sequence to search for ('nucleotide', 'protein', or 'all')
   * @param maxRetries Maximum number of retries on rate limit (429) errors
   * @returns Promise with the search results
   */
  async searchSequences(
    query: string,
    type: 'nucleotide' | 'protein' | 'all' = 'all',
    maxRetries: number = 2
  ): Promise<SearchResult[]> {
    let retries = 0;
    
    while (retries <= maxRetries) {
      try {
        const API_URL = `${process.env.NEXT_PUBLIC_API_URL || ''}/api`;
        console.log(`Searching sequences with URL: ${API_URL}/tools/sequences/search?query=${encodeURIComponent(query)}&type=${type}`);
        
        const response = await api.get(
          `${API_URL}/tools/sequences/search?query=${encodeURIComponent(query)}&type=${type}`,
          {
            // Aumentar timeout para dar más tiempo a la búsqueda en producción
            timeout: 30000,
            // Añadir headers adicionales para debugging
            headers: {
              'X-Request-With': 'XMLHttpRequest',
              'Accept': 'application/json',
              'X-Debug-Info': 'frontend-sequence-search'
            }
          }
        );
        
        // Validar la respuesta
        if (!response.data) {
          console.error("No data returned from server");
          return [];
        }
        
        // Asegurar que results siempre es un array, incluso si es null o undefined
        const results = response.data.results || [];
        
        // Validar que results es efectivamente un array
        if (!Array.isArray(results)) {
          console.error("Results is not an array:", results);
          return [];
        }
        
        // Verificar cada resultado para asegurar que tiene la estructura correcta
        const sanitizedResults = results.map((result: any) => ({
          id: result.id || 'unknown-id',
          name: result.name || 'Unknown Name',
          organism: result.organism || 'Unknown Organism',
          length: typeof result.length === 'number' ? result.length : 0,
          type: ['dna', 'rna', 'protein'].includes(result.type) ? result.type : 'dna',
          preview: result.preview || '',
          sequence: result.sequence || undefined // 🔧 AGREGAR ESTA LÍNEA
        }));
        
        return sanitizedResults;
      } catch (error) {
        // Log del error completo para mejor diagnóstico
        console.error('Error searching sequences (full error):', error);
        
        // Check if it's a rate limit error (429) and we have retries left
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as any;
          
          if (axiosError.response && axiosError.response.status === 429 && retries < maxRetries) {
            // If it's a rate limit error, wait before retrying (with exponential backoff)
            const waitTime = Math.pow(2, retries) * 1000; // 1s, 2s, 4s, ...
            console.log(`Rate limit hit, retrying in ${waitTime}ms (attempt ${retries + 1}/${maxRetries})`);
            
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retries++;
            continue; // Try again
          }
          
          // Si es otro tipo de error HTTP, proporcionar información detallada
          if (axiosError.response) {
            console.error(`HTTP error ${axiosError.response.status}:`, axiosError.response.data);
          }
        }
        
        // Para errores de timeout o red, dar información más clara
        if (error && typeof error === 'object' && 'code' in error) {
          const networkError = error as any;
          if (networkError.code === 'ECONNABORTED') {
            console.error('Request timed out when searching sequences');
          } else if (networkError.message && networkError.message.includes('Network Error')) {
            console.error('Network error when searching sequences');
          }
        }
        
        // Retornar array vacío en lugar de propagar el error
        // Esto permite que la aplicación siga funcionando incluso con errores
        return [];
      }
    }
    
    console.warn('Maximum retries exceeded for sequence search');
    return []; // Retornar array vacío en lugar de lanzar error
  },
  
  /**
   * Fetch a complete sequence by ID with retry logic
   * @param id Sequence identifier
   * @param database Database type ('dna', 'rna', or 'protein')
   * @param maxRetries Maximum number of retries on rate limit (429) errors
   * @returns Promise with the full sequence
   */
  async fetchSequence(
    id: string,
    database: 'dna' | 'rna' | 'protein',
    maxRetries: number = 2
  ): Promise<string> {
    let retries = 0;
    
    while (retries <= maxRetries) {
      try {
        const API_URL = `${process.env.NEXT_PUBLIC_API_URL || ''}/api`;
        const response = await api.get(
          `${API_URL}/tools/sequences/fetch?id=${encodeURIComponent(id)}&database=${database}`,
          {
            // Aumentar timeout para dar más tiempo a la búsqueda en producción
            timeout: 30000,
            // Añadir headers adicionales para debugging
            headers: {
              'X-Request-With': 'XMLHttpRequest',
              'Accept': 'application/json',
              'X-Debug-Info': 'frontend-sequence-fetch'
            }
          }
        );
        
        if (!response.data || !response.data.sequence) {
          throw new Error('No sequence found in response');
        }
        
        return response.data.sequence;
      } catch (error) {
        // Check if it's a rate limit error (429) and we have retries left
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as any;
          
          if (axiosError.response && axiosError.response.status === 429 && retries < maxRetries) {
            // If it's a rate limit error, wait before retrying (with exponential backoff)
            const waitTime = Math.pow(2, retries) * 1000; // 1s, 2s, 4s, ...
            console.log(`Rate limit hit, retrying in ${waitTime}ms (attempt ${retries + 1}/${maxRetries})`);
            
            await new Promise(resolve => setTimeout(resolve, waitTime));
            retries++;
            continue; // Try again
          }
        }
        
        console.error('Error fetching sequence:', error);
        const axiosErr = error as any;
        const serverMsg = axiosErr?.response?.data?.error;
        throw new Error(serverMsg || 'Could not retrieve this sequence. Try a different result or paste the sequence manually.');
      }
    }
    
    // This will only be reached if all retries are exhausted
    throw new Error('Maximum retries exceeded for sequence fetch');
  }
};

export default sequenceDatabaseService;