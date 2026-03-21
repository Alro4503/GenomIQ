'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslation } from '@/context/TranslationProvider';
import SequenceInput from '@/components/tools/blast/SequenceInput';
import BlastOptions from '@/components/tools/blast/BlastOptions';
import BlastResults from '@/components/tools/blast/BlastResults';
import BlastJobHistory from '@/components/tools/blast/BlastJobHistory';
import BlastProgress from '@/components/tools/blast/BlastProgress';
import { BlastJob, BlastProgram, BlastDatabase, BlastResults as BlastResultsType } from '@/types/blast';
import blastService from '@/services/blast/blastService';
import FloatingChat from '@/components/chat/FloatingChat';
import ToolPageWrapper from '@/components/tools/ToolPageWrapper';

// Inline icon components
const RefreshIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 2v6h-6"></path>
    <path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path>
    <path d="M3 22v-6h6"></path>
    <path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path>
  </svg>
);

const WarningIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
    <line x1="12" y1="9" x2="12" y2="13"></line>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

// Create a BlastContent component for the main content
const BlastContent = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  // Estado para el jobId de la URL
  const [jobIdFromUrl, setJobIdFromUrl] = useState<number | null>(null);

  // Estado para entrada de secuencia
  const [sequence, setSequence] = useState<string>('');

  // Estado para opciones de BLAST
  const [options, setOptions] = useState({
    program: 'blastn' as BlastProgram,
    database: 'nt' as BlastDatabase,
    evalue: 0.01,
    maxHits: 10,
    useRemoteApi: true
  });

  // Estado para trabajos BLAST
  const [blastJobs, setBlastJobs] = useState<BlastJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<BlastJob | null>(null);
  const [jobsLoading, setJobsLoading] = useState<boolean>(false);

  // Estado para resultados
  const [results, setResults] = useState<BlastResultsType | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [statusPollingInterval, setStatusPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // Estado para progreso de la búsqueda
  const [jobStatus, setJobStatus] = useState<string>('');
  const [completionPercent, setCompletionPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Estado para controlar cuándo se está en medio de un refresco de resultados
  const [fetchingResults, setFetchingResults] = useState<boolean>(false);

  // WebSocket para actualizaciones en tiempo real
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Constante para longitud máxima recomendada de secuencia
  const MAX_RECOMMENDED_LENGTH = 10000;

  // NUEVO: Estado para mostrar el formulario automáticamente después de enviar una búsqueda
  const [showFormAfterSubmit, setShowFormAfterSubmit] = useState<boolean>(false);

  // Referencias para evitar dependencias circulares en useEffect
  const resultsRef = useRef(results);
  const selectedJobRef = useRef(selectedJob);
  const jobStatusRef = useRef(jobStatus);
  const statusPollingIntervalRef = useRef(statusPollingInterval);
  const fetchingResultsRef = useRef(fetchingResults);
  const errorRef = useRef(error);

  // Crear el toolContext para FloatingChat
  const toolContext = {
    name: 'blast',
    displayName: t('tools.blast')
  };

  // Función auxiliar para verificar si un job está en progreso
  const isJobInProgress = (job: BlastJob): boolean => {
    const statusStr = String(job.status).toLowerCase();
    return ['pending', 'running', 'queued', 'starting', 'submitting', 'downloading'].includes(statusStr);
  };

  // Función auxiliar para verificar si hay algún job en progreso
  const hasJobInProgress = (): boolean => {
    return blastJobs.some(job => isJobInProgress(job));
  };

  // Resto de código existente...
  // Actualizar referencias cuando cambien los estados
  useEffect(() => {
    resultsRef.current = results;
  }, [results]);

  useEffect(() => {
    selectedJobRef.current = selectedJob;
  }, [selectedJob]);

  useEffect(() => {
    jobStatusRef.current = jobStatus;
  }, [jobStatus]);

  useEffect(() => {
    statusPollingIntervalRef.current = statusPollingInterval;
  }, [statusPollingInterval]);

  useEffect(() => {
    fetchingResultsRef.current = fetchingResults;
  }, [fetchingResults]);

  useEffect(() => {
    errorRef.current = error;
  }, [error]);

  // Actualizar la lista de trabajos cuando cambia el estado del trabajo
  useEffect(() => {
    // Si hay un trabajo seleccionado y el estado ha cambiado a completado, actualizar la lista
    if (selectedJob && (jobStatus === 'completed' || jobStatus === 'complete')) {
      fetchBlastJobs();

      // Si no tenemos resultados, intentar obtenerlos
      if (!results && !fetchingResults && !error) {
        fetchResults(selectedJob.id);
      }
    }
  }, [jobStatus, selectedJob, results, fetchingResults, error]);

  // Actualización periódica de la lista de trabajos
  useEffect(() => {
    // Actualizar lista de trabajos cada 30 segundos mientras haya un trabajo en progreso
    const interval = setInterval(() => {
      if (selectedJob &&
        !['completed', 'complete', 'failed', 'error', 'timeout'].includes(
          String(jobStatus).toLowerCase())) {
        fetchBlastJobs();
      }
    }, 30 * 1000); // 30 segundos

    return () => clearInterval(interval);
  }, [selectedJob, jobStatus]);

  // Cargar trabajo de la URL al inicio
  useEffect(() => {
    const jobId = searchParams.get('jobId');
    if (jobId) {
      const numericJobId = parseInt(jobId, 10);
      if (!isNaN(numericJobId)) {
        setJobIdFromUrl(numericJobId);
      }
    }
  }, [searchParams]);

  // Cargar trabajos al inicio
  useEffect(() => {
    fetchBlastJobs();
  }, []);

  // Cargar trabajo específico si viene en la URL
  useEffect(() => {
    if (jobIdFromUrl) {
      fetchBlastJob(jobIdFromUrl);
    }
  }, [jobIdFromUrl]);

  // Efecto de limpieza para WebSocket y polling
  useEffect(() => {
    return () => {
      stopStatusPolling();
      closeWebSocket();
    };
  }, []);

  // Efecto para manejar actualizaciones de estado
  useEffect(() => {
    if (!selectedJob) return;

    const jobStatusStr = String(selectedJob.status).toLowerCase();
    const isTerminalState = ['completed', 'complete', 'failed', 'error', 'timeout'].includes(jobStatusStr);

    // Si está en estado terminal, asegurarnos de tener resultados
    if (isTerminalState) {
      if ((jobStatusStr === 'completed' || jobStatusStr === 'complete') && !results && !fetchingResults && !error) {
        fetchResults(selectedJob.id);
      }
      stopStatusPolling();
      closeWebSocket();
      return;
    }

    // Para estados no terminales, configurar monitoreo
    if (selectedJob.use_remote_api) {
      initializeWebSocket(selectedJob.id);
    } else {
      startStatusPolling(selectedJob.id);
    }
  }, [selectedJob, results, fetchingResults, error]);

  // Función para obtener todos los trabajos BLAST
  const fetchBlastJobs = async () => {
    try {
      setJobsLoading(true);
      const jobs = await blastService.getJobs();

      // Actualizar los jobs en el estado
      setBlastJobs(jobs);

      // Si hay un trabajo seleccionado, actualizar su estado en el componente
      if (selectedJob) {
        const updatedSelectedJob = jobs.find(job => job.id === selectedJob.id);
        if (updatedSelectedJob && updatedSelectedJob.status !== selectedJob.status) {
          setSelectedJob(updatedSelectedJob);

          // Si el trabajo ha cambiado a completado y no tenemos resultados aún
          if ((updatedSelectedJob.status === 'completed' || updatedSelectedJob.status === 'complete') &&
            !resultsRef.current && !fetchingResultsRef.current && !errorRef.current) {
            fetchResults(updatedSelectedJob.id);
          }
        }
      }
    } catch (err: any) {
      console.error('Error al obtener trabajos BLAST:', err);
      // No mostrar error aquí para no bloquear la interfaz
    } finally {
      setJobsLoading(false);
    }
  };

  // Función para obtener un trabajo BLAST específico
  const fetchBlastJob = async (jobId: number) => {
    try {
      setIsLoading(true);
      setError(null);

      // Obtener información del trabajo
      const job = await blastService.getJob(jobId);
      setSelectedJob(job);

      // MODIFICADO: Si el job está en progreso, mostrar formulario también
      const jobStatusStr = String(job.status).toLowerCase();
      if (isJobInProgress(job)) {
        setShowFormAfterSubmit(true);
      } else {
        setShowFormAfterSubmit(false);
      }

      // Comprobar el estado del trabajo y actuar en consecuencia
      if (job.status === 'completed' || job.status === 'complete') {
        // Actualizamos el estado
        setJobStatus('completed');
        setCompletionPercent(100);
        // Y obtenemos los resultados si no los tenemos
        if (!resultsRef.current && !fetchingResultsRef.current) {
          fetchResults(jobId);
        }
      } else {
        // Si no está completado, actualizar el estado
        try {
          const statusResponse = await blastService.getJobStatus(jobId);
          updateJobStatus(statusResponse);

          // Iniciar el monitoreo apropiado para este trabajo
          if (!['completed', 'complete', 'failed', 'error', 'timeout'].includes(jobStatusStr)) {
            if (job.use_remote_api) {
              initializeWebSocket(job.id);
            } else {
              startStatusPolling(job.id);
            }
          }
        } catch (statusErr) {
          console.error(`Error al obtener estado del trabajo ${jobId}:`, statusErr);
          // Iniciar monitoreo de todos modos para reintentar
          if (job.use_remote_api) {
            initializeWebSocket(job.id);
          } else {
            startStatusPolling(job.id);
          }
        }
      }
    } catch (err: any) {
      console.error(`Error al obtener trabajo BLAST ${jobId}:`, err);
      setError(err.message || t('blast.errorFetchingJob'));
    } finally {
      setIsLoading(false);
    }
  };

  // Función para obtener resultados
  const fetchResults = async (jobId: number) => {
    // Evitar solicitudes duplicadas
    if (fetchingResultsRef.current) return;

    try {
      setFetchingResults(true);
      setIsLoading(true);
      setError(null);

      const response = await blastService.getResults(jobId);
      setResults(response.results);
      setJobStatus('completed');
      setCompletionPercent(100);
      setStatusMessage(t('blast.searchCompleted'));
      // Actualizar la lista de trabajos cuando se completa
      fetchBlastJobs();
    } catch (err: any) {
      console.error(`Error al obtener resultados BLAST ${jobId}:`, err);
      setError(err.message || t('blast.errorFetchingResults'));
    } finally {
      setIsLoading(false);
      setFetchingResults(false);
    }
  };

  // MODIFICADO: Función para enviar una nueva búsqueda BLAST
  const submitBlastSearch = async () => {
    try {
      // Validación básica - debe haber una secuencia
      const trimmedSequence = sequence.trim();
      if (!trimmedSequence) {
        setError(t('blast.errorEmptySequence'));
        return;
      }

      // Limpiar secuencia de espacios y saltos de línea
      const cleanSequence = trimmedSequence.replace(/\s+/g, '').toUpperCase();

      // Validar longitud mínima después de limpiar
      if (cleanSequence.length < 10) {
        setError(t('blast.errorSequenceTooShort') || 'La secuencia debe tener al menos 10 caracteres válidos');
        return;
      }

      // Limpiamos posibles errores anteriores
      setError(null);

      // Iniciamos el proceso de búsqueda
      setIsLoading(true);
      setResults(null);

      // Preparar datos para la búsqueda
      const outputFormat: "xml" | "json" | "tabular" = "xml";

      const blastData = {
        sequence: cleanSequence, // Usar secuencia limpia
        program: options.program,
        database: options.database,
        evalue: options.evalue,
        max_hits: options.maxHits,
        output_format: outputFormat,
        use_remote_api: options.useRemoteApi
      };

      console.log('Enviando datos BLAST:', {
        ...blastData,
        sequence: `${cleanSequence.substring(0, 50)}... (${cleanSequence.length} chars)`
      });

      // Detener cualquier conexión o polling previo
      stopStatusPolling();
      closeWebSocket();

      // Enviar búsqueda
      const job = await blastService.createSearch(blastData);

      // Actualizar estado
      setSelectedJob(job);

      // NUEVO: Mostrar formulario automáticamente después de enviar
      setShowFormAfterSubmit(true);

      // Actualizar lista de trabajos
      fetchBlastJobs();

      // Actualizar URL para incluir el jobId
      router.push(`/tools/blast?jobId=${job.id}`);

      // Inicializar monitoreo con WebSocket preferentemente
      if (options.useRemoteApi) {
        // Para API remota, el WebSocket es mejor para actualizaciones en tiempo real
        initializeWebSocket(job.id);
      } else {
        // Para procesamiento local, polling es más adecuado
        startStatusPolling(job.id);
      }

      setJobStatus('pending');
      setCompletionPercent(0);
      setStatusMessage(t('blast.searchSubmitted'));

      // NUEVO: Limpiar el textarea de secuencia después de enviar
      setSequence('');
    } catch (err: any) {
      console.error('Error al enviar búsqueda BLAST:', err);

      // Verificar si es un error de longitud de secuencia
      if (err.message && err.message.includes('sequence')) {
        if (err.message.toLowerCase().includes('must be at least') ||
          err.message.toLowerCase().includes('debe tener al menos')) {
          setError(t('blast.errorSequenceTooShort') ||
            'La secuencia debe tener al menos 10 caracteres');
        } else {
          setError(err.message);
        }
      } else {
        setError(err.message || t('blast.errorSubmittingSearch'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Función para eliminar un trabajo
  const deleteJob = async (jobId: number) => {
    try {
      await blastService.deleteJob(jobId);

      // Actualizar lista de trabajos
      fetchBlastJobs();

      // Si es el trabajo seleccionado actualmente, resetear
      if (selectedJob && selectedJob.id === jobId) {
        setSelectedJob(null);
        setResults(null);
        setShowFormAfterSubmit(false); // NUEVO: Resetear estado del formulario
        router.push('/tools/blast');
      }
    } catch (err: any) {
      console.error(`Error al eliminar trabajo BLAST ${jobId}:`, err);
      // Mostrar mensaje de error?
    }
  };

  // MODIFICADO: Función para seleccionar un trabajo (con bloqueo)
  const selectJob = (job: BlastJob) => {
    // NUEVO: Bloquear selección si el job está en progreso
    if (isJobInProgress(job)) {
      return; // No hacer nada si el job está en progreso
    }

    // NUEVO: Al seleccionar un job completado, no mostrar formulario
    setShowFormAfterSubmit(false);
    router.push(`/tools/blast?jobId=${job.id}`);
  };

  // Función para actualizar opciones
  const updateOption = (key: string, value: any) => {
    setOptions({
      ...options,
      [key]: value
    });
  };

  // Inicializar WebSocket
  // Inicializar WebSocket
  const initializeWebSocket = (jobId: number) => {
    try {
      // Cerrar conexión existente
      closeWebSocket();

      const clientId = `blast-${jobId}-${Date.now()}`;
      console.log(`Iniciando WebSocket para el trabajo ${jobId} con clientId ${clientId}`);

      // Crear WebSocket con mejor manejo de errores
      let newWs: WebSocket;

      try {
        newWs = blastService.createWebSocketClient(clientId);
      } catch (createError) {
        console.error('Error al crear WebSocket:', createError);
        // Fallback a polling
        startStatusPolling(jobId);
        return null;
      }

      // Establecer un timeout para la conexión WebSocket
      const connectionTimeout = setTimeout(() => {
        console.warn('Timeout de conexión WebSocket, pasando a polling');

        if (newWs) {
          try {
            // Registramos que estamos cerrando para evitar efectos secundarios
            console.log('Cerrando WebSocket por timeout');
            newWs.onclose = null; // Evitar recursión
            newWs.close();
          } catch (e) {
            console.error("Error al cerrar WebSocket por timeout:", e);
          }
        }

        setWs(null);
        // Iniciar polling como método de respaldo
        startStatusPolling(jobId);
      }, 5000); // 5 segundos para establecer conexión

      // Configurar eventos WebSocket
      newWs.onopen = (event) => {
        console.log('Conexión WebSocket establecida correctamente');
        clearTimeout(connectionTimeout); // Limpiar timeout

        // Una vez que se establece la conexión, enviamos los detalles del trabajo
        const userId = localStorage.getItem('userId') || '0';
        try {
          console.log(`Enviando datos iniciales al WebSocket: job_id=${jobId}, client_id=${clientId}`);
          newWs.send(JSON.stringify({
            user_id: userId,
            job_id: jobId,
            client_id: clientId
          }));
        } catch (sendError) {
          console.error('Error al enviar mensaje inicial al WebSocket:', sendError);

          // Cerrar WebSocket por el error
          try {
            newWs.close();
          } catch (e) {
            console.error("Error al cerrar WebSocket tras error de envío:", e);
          }

          setWs(null);
          // Fallback a polling
          startStatusPolling(jobId);
        }
      };

      newWs.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          console.log('Mensaje WebSocket recibido:', data);

          // Actualizar estados independientemente de si ya tenemos resultados
          if (data.type === 'status') {
            setJobStatus(data.status || '');
            setCompletionPercent(data.completion_percent || 0);
            setStatusMessage(data.message || '');

            // Verificar si ha completado
            if (data.status === 'completed' || data.status === 'COMPLETED') {
              // Si viene con resultados, establecerlos directamente
              if (data.results) {
                setResults(data.results);
                setJobStatus('completed');
                setCompletionPercent(100);
              } else if (!resultsRef.current && !fetchingResultsRef.current) {
                // Si no, buscarlos explícitamente si no los tenemos ya
                fetchResults(jobId);
              }

              // Cerrar monitorización
              closeWebSocket();
              stopStatusPolling();

              // Actualizar lista de trabajos
              fetchBlastJobs();
            }
          } else if (data.type === 'results') {
            setResults(data.results);
            setJobStatus('completed');
            setCompletionPercent(100);
            closeWebSocket();
            stopStatusPolling();
            // Actualizar lista de trabajos cuando se completa
            fetchBlastJobs();
          } else if (data.type === 'error') {
            setError(data.message || 'Error desconocido');
            closeWebSocket();
            stopStatusPolling();
            // Actualizar lista de trabajos cuando hay error
            fetchBlastJobs();
          }
        } catch (e) {
          console.error('Error al procesar mensaje WebSocket:', e);
        }
      };

      newWs.onerror = (error) => {
        console.error('Error de WebSocket:', error);
        clearTimeout(connectionTimeout); // Limpiar timeout

        // Cerrar WebSocket por el error
        closeWebSocket();

        // Fallback a polling en caso de error con WS
        // Solo iniciar polling si no hay uno activo
        if (!statusPollingIntervalRef.current) {
          console.log('Pasando a polling debido a error de WebSocket');
          startStatusPolling(jobId);
        }
      };

      newWs.onclose = (event) => {
        console.log(`Conexión WebSocket cerrada. Código: ${event.code}, Razón: ${event.reason}, Limpia: ${event.wasClean}`);
        clearTimeout(connectionTimeout); // Limpiar timeout

        // Solo iniciar polling si no hay resultados y el job no está en estado terminal
        const currentResults = resultsRef.current;
        const currentJob = selectedJobRef.current;
        const currentStatus = jobStatusRef.current;

        if (!currentResults && currentJob &&
          !['completed', 'complete', 'failed', 'error', 'timeout'].includes(
            String(currentStatus).toLowerCase()) &&
          !statusPollingIntervalRef.current) {
          // Sólo iniciar polling si el cierre no fue limpio (indicando un problema)
          if (!event.wasClean) {
            console.log('WebSocket cerrado inesperadamente, iniciando polling');
            startStatusPolling(jobId);
          }
        }
      };

      // Establecer el websocket en el estado
      setWs(newWs);
      return newWs;
    } catch (error) {
      console.error('Error general al inicializar WebSocket:', error);
      // Fallback a polling
      startStatusPolling(jobId);
      return null;
    }
  };

  // Cerrar WebSocket
  const closeWebSocket = useCallback(() => {
    if (ws) {
      // Solo cerrar si está abierto o conectando
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        try {
          ws.close();
        } catch (e) {
          console.error("Error al cerrar WebSocket:", e);
        }
      }
      setWs(null);
    }
  }, [ws]);

  // Iniciar polling de estado
  const startStatusPolling = (jobId: number) => {
    // Detener polling existente si hay uno
    stopStatusPolling();

    // Contador de reintentos
    let retryCount = 0;
    const maxRetries = 5;

    // Crear nuevo intervalo
    const interval = setInterval(async () => {
      try {
        // Verificar si el trabajo está en un estado terminal o ya tenemos resultados
        const currentResults = resultsRef.current;
        const currentJob = selectedJobRef.current;
        const currentStatus = jobStatusRef.current;
        const isFetchingResults = fetchingResultsRef.current;

        if (currentResults || isFetchingResults ||
          (currentJob && ['completed', 'complete', 'failed', 'error', 'timeout'].includes(
            String(currentStatus).toLowerCase()))) {
          stopStatusPolling();
          return;
        }

        const statusResponse = await blastService.getJobStatus(jobId);

        // Resetear contador de reintentos si tenemos éxito
        retryCount = 0;

        // Actualizar estado siempre para ver el progreso
        updateJobStatus(statusResponse);

        // Si el trabajo está completo o fallido, detener polling
        if (statusResponse.status === 'completed' || statusResponse.status === 'complete') {
          stopStatusPolling();

          // Solo buscar resultados si no los tenemos ya y no estamos en proceso de obtenerlos
          if (!resultsRef.current && !fetchingResultsRef.current) {
            fetchResults(jobId);
          }

          // Actualizar lista de trabajos cuando se completa
          fetchBlastJobs();
        } else if (statusResponse.status === 'failed' || statusResponse.status === 'error' || statusResponse.status === 'timeout') {
          stopStatusPolling();
          setError(statusResponse.message || t('blast.searchFailed'));
        }
      } catch (err) {
        console.error(`Error al obtener estado del trabajo ${jobId}:`, err);
        retryCount++;

        // Si excedemos el número máximo de reintentos, mostrar un error
        if (retryCount >= maxRetries) {
          console.warn(`Máximo número de reintentos alcanzado para el trabajo ${jobId}`);
          stopStatusPolling();
          setError(t('blast.errorServerUnavailable') ||
            'El servicio BLAST está temporalmente no disponible. Por favor, inténtalo más tarde.');
        }
      }
    }, 3000); // Consultar cada 3 segundos

    setStatusPollingInterval(interval);
    return interval;
  };

  // Detener polling de estado
  const stopStatusPolling = useCallback(() => {
    if (statusPollingInterval) {
      clearInterval(statusPollingInterval);
      setStatusPollingInterval(null);
    }
  }, [statusPollingInterval]);

  // Actualizar estado del trabajo
  const updateJobStatus = (statusData: any) => {
    if (statusData) {
      const status = typeof statusData.status === 'string' ? statusData.status : 'pending';
      setJobStatus(status);
      setCompletionPercent(statusData.completion_percent || 0);
      setStatusMessage(statusData.message || '');
    }
  };

  // MODIFICADO: Función para resetear y empezar una nueva búsqueda
  const startNewSearch = () => {
    setSelectedJob(null);
    setResults(null);
    setError(null);
    setJobStatus('');
    setCompletionPercent(0);
    setStatusMessage('');
    setShowFormAfterSubmit(false); // NUEVO: Resetear estado del formulario
    router.push('/tools/blast');
  };

  // MODIFICADO: Determinar si se debe mostrar el formulario o los resultados
  const showForm = !selectedJob || showFormAfterSubmit;
  const showResults = selectedJob !== null && !showFormAfterSubmit;
  const inProgress = jobStatus && jobStatus !== 'completed' && jobStatus !== 'complete' && jobStatus !== 'failed' && jobStatus !== 'error' && jobStatus !== 'timeout';

  // Verificar si la secuencia es muy larga
  const cleanSequence = sequence.replace(/\s/g, '');
  const isSequenceTooLong = cleanSequence.length > MAX_RECOMMENDED_LENGTH;

  return (
    <div className="container max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('blast.pageTitle')}
          </h1>

          {/* MODIFICADO: Solo mostrar botón "New Search" cuando hay resultados y no hay formulario */}
          {showResults && (
            <button
              onClick={startNewSearch}
              className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900"
            >
              {t('blast.newSearch')}
            </button>
          )}
        </div>

        <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
          {t('blast.pageDescription')}
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Historial de trabajos (siempre visible) */}
          <div className="lg:col-span-1">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
                {t('blast.jobHistoryTitle')}
              </h3>
              <button
                onClick={() => fetchBlastJobs()}
                disabled={jobsLoading}
                className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-md hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-300 dark:hover:bg-purple-800 flex items-center gap-1"
              >
                <RefreshIcon />
                {t('blast.refreshList') || 'Refresh list'}
              </button>
            </div>
            {/* MODIFICADO: Pasar función que verifica si un job está bloqueado */}
            <BlastJobHistory
              jobs={blastJobs}
              isLoading={jobsLoading}
              onSelectJob={selectJob}
              onDeleteJob={deleteJob}
              selectedJobId={selectedJob?.id}
              isJobBlocked={isJobInProgress} // NUEVO: Función para verificar si un job está bloqueado
            />
          </div>

          {/* Área principal: formulario o resultados */}
          <div className="lg:col-span-2 space-y-6">
            {/* NUEVO: Mostrar progreso cuando hay un job en progreso */}
            {inProgress && (
              <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
                <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">
                  {t('blast.searchProgress')}
                </h3>
                <BlastProgress
                  status={jobStatus}
                  completionPercent={completionPercent}
                  message={statusMessage}
                />

              </div>
            )}

            {showForm && (
              <>
                <SequenceInput
                  sequence={sequence}
                  onChange={setSequence}
                  isLoading={isLoading}
                  program={options.program}
                />

                {isSequenceTooLong && (
                  <div className="mt-2 p-3 bg-amber-50 text-amber-700 dark:bg-amber-900 dark:text-amber-300 rounded-md text-sm flex items-start">
                    <span className="mr-2 flex-shrink-0 mt-0.5">
                      <WarningIcon />
                    </span>
                    <span>
                      {t('blast.noteSequenceLong') ||
                        "Has introducido una secuencia muy larga. Las búsquedas BLAST con secuencias extensas pueden tardar considerablemente más tiempo en completarse."}
                    </span>
                  </div>
                )}

                <BlastOptions
                  options={options}
                  onChange={updateOption}
                  disabled={isLoading || hasJobInProgress()} // NUEVO: Deshabilitar si hay job en progreso
                />

                <div className="flex justify-end">
                  <button
                    onClick={submitBlastSearch}
                    disabled={isLoading || !sequence.trim() || hasJobInProgress()} // NUEVO: Deshabilitar si hay job en progreso
                    className={`px-6 py-3 rounded-md text-white font-medium 
                              focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900
                              ${isLoading || !sequence.trim() || hasJobInProgress()
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-700'}`}
                  >
                    {isLoading ? t('blast.searching') : t('blast.submitSearch')}
                  </button>
                </div>

                {/* NUEVO: Mensaje informativo si hay job en progreso */}
                {hasJobInProgress() && !inProgress && (
                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-md">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      {t('blast.jobInProgressWarning') || 'Hay una búsqueda BLAST en progreso. Espera a que termine antes de enviar una nueva búsqueda.'}
                    </p>
                  </div>
                )}
              </>
            )}

            {showResults && (
              <BlastResults
                results={results}
                isLoading={isLoading}
                error={error}
                jobId={selectedJob?.id}
                jobDetails={selectedJob ? {
                  program: selectedJob.program,
                  database: selectedJob.database,
                  createdAt: selectedJob.created_at
                } : undefined}
              />
            )}

            {/* Chat flotante */}
            <FloatingChat toolContext={toolContext} />
          </div>
        </div>
      </div>
    </div>
  );
};

// Modified page component to include ToolPageWrapper
export default function BlastPage() {
  return (
    <ToolPageWrapper>
      <BlastContent />
    </ToolPageWrapper>
  );
}