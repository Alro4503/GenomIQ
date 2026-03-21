import { AnnotationSettings, AnnotationFeature } from '@/types/annotation';
import { axiosInstance } from '../axiosConfig';

// Validación de secuencias (cliente)
export const isValidProteinSequence = (sequence: string): boolean => {
  return /^[ACDEFGHIKLMNPQRSTVWY]+$/i.test(sequence);
};

export const isValidDNASequence = (sequence: string): boolean => {
  return /^[ACGT]+$/i.test(sequence);
};

// Función principal para anotar secuencias (llama a la API del backend)
// Modificación en annotationService.ts
export const annotateSequence = async (
  sequenceData: string | null, 
  sequenceId: string | null, 
  settings: AnnotationSettings
): Promise<{ features: AnnotationFeature[], sequence?: string }> => {
  try {
    // Validar que tengamos al menos una entrada
    if (!sequenceData && !sequenceId) {
      throw new Error('Se requiere una secuencia o un ID de secuencia');
    }

    // Realizar la petición al backend
    const response = await axiosInstance.post('/api/tools/annotation/annotate', {
      settings: {
        sequenceType: settings.sequenceType,
        database: settings.database,
        showFeatures: {
          domains: settings.showFeatures.domains,
          motifs: settings.showFeatures.motifs,
          modifications: settings.showFeatures.modifications,
          variants: settings.showFeatures.variants
        }
      },
      sequence: {
        sequence_data: sequenceData,
        sequence_id: sequenceId
      }
    });

    if (response.status !== 200) {
      throw new Error(`Error del servidor: ${response.status}`);
    }

    // Ahora el backend debe devolver tanto las características como la secuencia
    return {
      features: response.data.features || response.data,
      sequence: response.data.sequence || sequenceData // Usar la secuencia del backend o la proporcionada
    };
  } catch (error) {
    console.error('Error en la anotación:', error);
    if (error instanceof Error) {
      throw new Error(error.message);
    } else {
      throw new Error('Error desconocido durante la anotación');
    }
  }
};

// Función para obtener los trabajos de anotación del usuario
export const getAnnotationJobs = async () => {
  try {
    const response = await axiosInstance.get('/api/tools/annotation/jobs');
    return response.data;
  } catch (error) {
    console.error('Error al obtener los trabajos de anotación:', error);
    throw error;
  }
};

// Función para obtener los detalles de un trabajo específico
export const getAnnotationJob = async (jobId: number) => {
  try {
    const response = await axiosInstance.get(`/api/tools/annotation/jobs/${jobId}`);
    return response.data;
  } catch (error) {
    console.error(`Error al obtener el trabajo de anotación ${jobId}:`, error);
    throw error;
  }
};

// Función para obtener las características de un trabajo
export const getAnnotationFeatures = async (jobId: number): Promise<AnnotationFeature[]> => {
  try {
    const response = await axiosInstance.get(`/api/tools/annotation/jobs/${jobId}/features`);
    return response.data;
  } catch (error) {
    console.error(`Error al obtener las características del trabajo ${jobId}:`, error);
    throw error;
  }
};

// Función para eliminar un trabajo
export const deleteAnnotationJob = async (jobId: number) => {
  try {
    const response = await axiosInstance.delete(`/api/tools/annotation/jobs/${jobId}`);
    return response.data;
  } catch (error) {
    console.error(`Error al eliminar el trabajo de anotación ${jobId}:`, error);
    throw error;
  }
};