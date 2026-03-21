import { useTranslation } from '@/context/TranslationProvider';
import { BlastJob, BlastProgramInfo, BlastDatabaseInfo } from '@/types/blast';
import Link from 'next/link';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';
import BlastProgress from './BlastProgress';

interface BlastJobCardProps {
  job: BlastJob;
}

const BlastJobCard = ({ job }: BlastJobCardProps) => {
  const { t, language } = useTranslation();
  
  // Función para formatear la fecha con hora exacta
  const formatExactDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const locale = language === 'es' ? es : enUS;
    
    // Formato: "dd MMM yyyy, HH:mm" (ej: "15 May 2024, 14:30")
    return format(date, 'dd MMM yyyy, HH:mm', { locale });
  };
  
  // Obtener información del programa y base de datos
  const programInfo = BlastProgramInfo[job.program as keyof typeof BlastProgramInfo] || { name: job.program };
  const databaseInfo = BlastDatabaseInfo[job.database as keyof typeof BlastDatabaseInfo] || { name: job.database };
  
  // Normalizar estado para compatibilidad
  const normalizeStatus = (status: any): string => {
    if (typeof status === 'string') {
      return status.toLowerCase();
    }
    if (status && typeof status === 'object' && status.status) {
      return status.status.toLowerCase();
    }
    return 'unknown';
  };
  
  const normalizedStatus = normalizeStatus(job.status);
  const displayStatus = typeof job.status === 'string' ? job.status : 
                       (job.status && job.status.status) ? job.status.status : 'unknown';
  
  // Determinar si está en progreso
  const isInProgress = ['pending', 'running', 'queued', 'starting', 'submitting', 'downloading'].includes(normalizedStatus);
  
  // Calcular el porcentaje de completitud
  const getCompletionPercent = () => {
    if (normalizedStatus === 'completed') return 100;
    if (normalizedStatus === 'failed' || normalizedStatus === 'error') return 0;
    if (normalizedStatus === 'running') return Math.floor(Math.random() * 40) + 30; // 30-70%
    if (normalizedStatus === 'downloading') return Math.floor(Math.random() * 20) + 80; // 80-100%
    return Math.floor(Math.random() * 30) + 5; // 5-35% para otros estados
  };

  const completionPercent = getCompletionPercent();

  return (
    <Link 
      href={`/tools/blast?jobId=${job.id}`}
      className="block hover:no-underline"
      title={`Job #${job.id}: ${programInfo.name} búsqueda en ${databaseInfo.name} - ${displayStatus} - ${formatExactDateTime(job.created_at)}`}
    >
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-gray-800 dark:text-white">
            #{job.id}: {programInfo.name} {t('blast.search')}
          </h3>
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            normalizedStatus === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
            normalizedStatus === 'failed' || normalizedStatus === 'error' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
            'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
          }`}>
            {displayStatus}
          </span>
        </div>
        
        <div className="mb-3">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {t('blast.database')}: <span className="font-medium">{databaseInfo.name}</span>
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {formatExactDateTime(job.created_at)}
          </p>
        </div>
        
        {isInProgress && (
          <div className="mt-3">
            <BlastProgress 
              status={displayStatus}
              completionPercent={completionPercent}
            />
          </div>
        )}
        
        <div className="mt-3 text-right">
          <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">
            {normalizedStatus === 'completed' ? t('blast.viewResults') : t('blast.viewStatus')} →
          </span>
        </div>
      </div>
    </Link>
  );
};

export default BlastJobCard;