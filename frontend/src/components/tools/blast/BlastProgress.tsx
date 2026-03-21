import { useTranslation } from '@/context/TranslationProvider';
import { useMemo } from 'react';

interface BlastProgressProps {
  status: string; // Aceptamos cualquier formato de estado
  completionPercent: number;
  message?: string;
}

const BlastProgress = ({
  status,
  completionPercent,
  message
}: BlastProgressProps) => {
  const { t } = useTranslation();

  // Normalización del estado para compatibilidad (caso insensitivo)
  const normalizedStatus = useMemo(() => {
    if (!status) return '';
    
    // Convertir a minúsculas para comparación 
    const statusLower = status.toLowerCase();
    
    // Mapear diferentes formatos de estado a formato estándar
    if (statusLower.includes('queue') || statusLower.includes('pending')) return 'queued';
    if (statusLower.includes('start')) return 'starting';
    if (statusLower.includes('submit')) return 'submitting';
    if (statusLower.includes('run') || statusLower.includes('process')) return 'running';
    if (statusLower.includes('download')) return 'downloading';
    if (statusLower.includes('complet')) return 'completed';
    if (statusLower.includes('fail')) return 'failed';
    if (statusLower.includes('error')) return 'error';
    if (statusLower.includes('time')) return 'timeout';
    
    // Si no se encuentra un mapeo, devolver el estado original
    return statusLower;
  }, [status]);

  // Determinar color basado en el estado normalizado
  const getStatusColor = () => {
    switch (normalizedStatus) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
      case 'error':
      case 'timeout':
        return 'bg-red-500';
      default:
        return 'bg-purple-500';
    }
  };

  // Obtener texto del estado para mostrar
  const getStatusText = () => {
    switch (normalizedStatus) {
      case 'queued':
        return t('blast.statusQueued');
      case 'starting':
        return t('blast.statusStarting');
      case 'submitting':
        return t('blast.statusSubmitting');
      case 'running':
        return t('blast.statusRunning');
      case 'downloading':
        return t('blast.statusDownloading');
      case 'completed':
        return t('blast.statusCompleted');
      case 'failed':
        return t('blast.statusFailed');
      case 'error':
        return t('blast.statusError');
      case 'timeout':
        return t('blast.statusTimeout');
      default:
        // Si no hay mapeo, usar el estado original capitalizado
        return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    }
  };

  // Asegurar que el porcentaje sea válido
  const safePercentage = useMemo(() => {
    let percent = parseInt(String(completionPercent), 10);
    
    if (isNaN(percent)) {
      percent = 0;
    }
    
    // Limitar entre 0-100
    return Math.min(100, Math.max(0, percent));
  }, [completionPercent]);

  return (
    <div className="w-full">
      <div className="flex justify-between mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {getStatusText()}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {safePercentage}%
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
        <div 
          className={`h-2.5 rounded-full ${getStatusColor()} transition-all duration-300 ease-in-out`} 
          style={{ width: `${safePercentage}%` }}
        ></div>
      </div>
      {message && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400">
          {message}
        </p>
      )}
    </div>
  );
};

export default BlastProgress;