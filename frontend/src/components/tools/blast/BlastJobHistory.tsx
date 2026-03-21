import { useTranslation } from '@/context/TranslationProvider';
import { useState, useEffect } from 'react';
import { BlastJob } from '@/types/blast';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface BlastJobHistoryProps {
  jobs: BlastJob[];
  isLoading: boolean;
  onSelectJob: (job: BlastJob) => void;
  onDeleteJob: (jobId: number) => void;
  selectedJobId?: number;
  isJobBlocked?: (job: BlastJob) => boolean; // NUEVO: Función para verificar si un job está bloqueado
}

const BlastJobHistory = ({
  jobs,
  isLoading,
  onSelectJob,
  onDeleteJob,
  selectedJobId,
  isJobBlocked = () => false // NUEVO: Valor por defecto
}: BlastJobHistoryProps) => {
  const { t, language } = useTranslation();
  
  // Función para formatear la fecha con hora exacta
  const formatExactDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const locale = language === 'es' ? es : enUS;
    
    // Formato: "dd MMM yyyy, HH:mm" (ej: "15 May 2024, 14:30")
    return format(date, 'dd MMM yyyy, HH:mm', { locale });
  };

  // Obtener una previsualización de la secuencia
  const getSequencePreview = (sequence: string, maxLength = 20) => {
    const cleanSequence = sequence.replace(/\s/g, '');
    if (cleanSequence.length <= maxLength) {
      return cleanSequence;
    }
    return `${cleanSequence.substring(0, maxLength)}...`;
  };

  // Obtener color según estado
  const getStatusColor = (status: string | any) => {
    // Asegurarse de que status sea una cadena
    const statusStr = typeof status === 'string' ? status : 
                     (status && typeof status.status === 'string') ? status.status : 'unknown';
    
    switch (statusStr.toLowerCase()) {
      case 'completed':
      case 'complete':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'running':
      case 'pending':
      case 'queued':
      case 'starting':
      case 'submitting':
      case 'downloading':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'failed':
      case 'error':
      case 'timeout':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  // NUEVO: Función para manejar click en job
  const handleJobClick = (job: BlastJob) => {
    // Si el job está bloqueado, no hacer nada
    if (isJobBlocked(job)) {
      return;
    }
    onSelectJob(job);
  };
  
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
      <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">
        {t('blast.jobHistoryTitle')}
      </h3>
      
      {isLoading ? (
        <div className="text-center p-6">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-solid border-purple-500 border-r-transparent mb-2"></div>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('blast.loadingJobs')}
          </p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center p-6 text-gray-500 dark:text-gray-400">
          <p>{t('blast.noJobsFound')}</p>
        </div>
      ) : (
        <div className="overflow-y-auto max-h-80">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {jobs.map((job) => {
              // Asegurarnos de que status sea una cadena para mostrar
              const jobStatus = typeof job.status === 'string' ? job.status : 
                          (job.status && typeof job.status.status === 'string') ? job.status.status : 'unknown';
              
              // NUEVO: Verificar si el job está bloqueado
              const blocked = isJobBlocked(job);
              
              return (
                <li 
                  key={job.id}
                  className={`py-3 px-2 rounded-md ${
                    blocked 
                      ? 'opacity-50 cursor-not-allowed' // NUEVO: Estilo para jobs bloqueados
                      : 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800'
                  } ${
                    selectedJobId === job.id ? 'bg-purple-50 dark:bg-purple-900/10' : ''
                  }`}
                  onClick={() => handleJobClick(job)} // MODIFICADO: Usar función que maneja el bloqueo
                  title={blocked ? (t('blast.jobRunningTooltip') || 'Esta búsqueda está en progreso') : undefined} // NUEVO: Tooltip para jobs bloqueados
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {job.program} - {job.database}
                        {/* NUEVO: Indicador visual para jobs en progreso */}
                        {blocked && (
                          <span className="ml-2 inline-flex items-center">
                            <svg className="animate-spin h-3 w-3 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                        {getSequencePreview(job.sequence)}
                      </p>
                      <div className="flex items-center mt-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs ${getStatusColor(job.status)}`}>
                          {jobStatus}
                        </span>
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          {formatExactDateTime(job.created_at)}
                        </span>
                      </div>
                    </div>
                    
                    {/* Acciones */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(t('blast.confirmDelete'))) {
                            onDeleteJob(job.id);
                          }
                        }}
                        disabled={blocked} // NUEVO: Deshabilitar eliminación para jobs en progreso
                        className={`${
                          blocked 
                            ? 'text-gray-300 dark:text-gray-600 cursor-not-allowed' 
                            : 'text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400'
                        }`}
                        title={blocked ? (t('blast.cannotDeleteRunningJob') || 'No se puede eliminar una búsqueda en progreso') : undefined}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export default BlastJobHistory;