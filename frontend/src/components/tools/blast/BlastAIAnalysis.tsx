import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { SparklesIcon, ArrowPathIcon, ArrowUturnLeftIcon, ClockIcon } from '@heroicons/react/24/outline';
import { BlastResults } from '@/types/blast';
import blastAnalysisService from '@/services/blast/blastAnalysisService';
import { useChatWebSocket } from '@/context/ChatWebSocketContext';

interface BlastAIAnalysisProps {
  results: BlastResults;
}

const BlastAIAnalysis: React.FC<BlastAIAnalysisProps> = ({ results }) => {
  const { t, language } = useTranslation();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analysisDuration, setAnalysisDuration] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const analysisContainerRef = useRef<HTMLDivElement>(null);
  const [typewriterContent, setTypewriterContent] = useState<string>('');
  const [cursorVisible, setCursorVisible] = useState<boolean>(true);

  // Manejo de WebSocket para streaming
  const { 
    connected: wsConnected, 
    sendStreamMessage, 
    isStreaming,
    streamingMessage,
    streamingTools 
  } = useChatWebSocket();

  // Formatear texto con negritas y estructura de párrafos
  const formatText = (text: string): string => {
    // Eliminar etiquetas de recomendaciones de herramientas
    const withoutTags = text.replace(/\[TOOL:(blast|alignment|translation|visualization|annotation)\]/gi, '');
    
    // Formatear negritas
    let formattedText = withoutTags.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Formatear párrafos conservando la estructura
    formattedText = formattedText.replace(/\n\n+/g, '</p><p>');
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    // Asegurar que todo el contenido está encapsulado en párrafos
    if (!formattedText.startsWith('<p>')) {
      formattedText = '<p>' + formattedText;
    }
    if (!formattedText.endsWith('</p>')) {
      formattedText = formattedText + '</p>';
    }
    
    return formattedText;
  };

  // Efecto para sincronizar con el streaming del WebSocket
  useEffect(() => {
    // Actualizar el contenido local cuando cambia el mensaje de streaming
    if (isStreaming) {
      setTypewriterContent(streamingMessage);
    } else if (typewriterContent && !analysis) {
      // Cuando termina el streaming, guardar el contenido como análisis final
      setAnalysis(formatText(typewriterContent));
      setTypewriterContent('');
      setIsAnalyzing(false);
    }
  }, [isStreaming, streamingMessage, analysis, typewriterContent]);

  // Efecto para parpadear el cursor
  useEffect(() => {
    if (isStreaming) {
      const cursorInterval = setInterval(() => {
        setCursorVisible(prev => !prev);
      }, 500);
      
      return () => clearInterval(cursorInterval);
    }
  }, [isStreaming]);

  // Iniciar temporizador para la duración del análisis
  useEffect(() => {
    if (isAnalyzing) {
      setAnalysisDuration(0);
      timerRef.current = setInterval(() => {
        setAnalysisDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isAnalyzing]);

  // Hacer scroll al análisis cuando se actualiza
  useEffect(() => {
    if (analysisContainerRef.current && (typewriterContent || analysis)) {
      analysisContainerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [typewriterContent, analysis]);

  // Construir el prompt para análisis de BLAST
  const constructBlastAnalysisPrompt = (results: BlastResults): string => {
    const hitCount = results.summary?.hit_count || 0;
    const hits = results.summary?.hits || [];
    const topHits = hits.slice(0, 5);
    
    // Utilizamos estos valores si están disponibles como propiedades adicionales
    // Añadimos una aserción de tipo para evitar errores de TypeScript
    const extendedResults = results as any;
    const database = extendedResults.database || 'Not specified';
    const program = extendedResults.program || 'Not specified';
    
    const language_suffix = language === 'es' 
      ? 'IMPORTANTE: Responde completamente en español.' 
      : 'IMPORTANT: Respond completely in English.';
    
    return `
As a bioinformatics expert, analyze this BLAST search result:

Details:
- Hit count: ${hitCount}
- Database: ${database}
- Program: ${program}

Top hits:
${topHits.map((hit, i) => 
  `${i+1}. "${hit.title}" (E-value: ${hit.evalue || 'N/A'}, Bit score: ${hit.bit_score || 'N/A'}, Identity: ${hit.identity || 'N/A'})`
).join('\n')}

Please provide:
1. Overall significance of these matches
2. Interpretation of the E-values and confidence levels
3. Functional implications of the matches
4. Recommendations for further analysis

Make your analysis detailed, informative, and scientifically accurate. 
Format important points, keywords and section titles using markdown **bold** syntax. 
Use double line breaks (\\n\\n) between paragraphs for better readability.
Ensure each section is clearly separated with proper paragraph spacing.
${language_suffix}

DO NOT include any tool recommendations in the format [TOOL:name].
`;
  };

  // Función para analizar los resultados (versión tradicional, fallback)
  const analyzeResults = async () => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null); // Limpiar análisis anterior
    setTypewriterContent(''); // Limpiar contenido de streaming

    try {
      // Usar el servicio para analizar los resultados
      const analysisText = await blastAnalysisService.analyzeBlastResults(results, language);
      setAnalysis(formatText(analysisText));
    } catch (err) {
      console.error('AI analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Función para analizar los resultados con streaming
  const analyzeResultsWithStreaming = async () => {
    // Reiniciar estados
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setTypewriterContent('');

    try {
      if (!wsConnected) {
        // Fallback al método tradicional si WebSocket no está disponible
        console.log('WebSocket no disponible, usando método tradicional');
        await analyzeResults();
        return;
      }

      // Construir prompt para BLAST
      const prompt = constructBlastAnalysisPrompt(results);
      
      // Usar WebSocket para streaming
      await sendStreamMessage(prompt, undefined, 'blast');
      
      // El resto se manejará a través de los efectos que escuchan cambios en isStreaming y streamingMessage
    } catch (err) {
      console.error('Streaming error:', err);
      setError(err instanceof Error ? err.message : 'Streaming failed');
      setIsAnalyzing(false);
    }
  };

  // Formatear tiempo de análisis
  const formatAnalysisTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };
  
  // Procesar el texto actual para visualización durante streaming
  const processStreamContent = (content: string): string => {
    // Convertir Markdown a HTML básico
    let processedContent = content;
    
    // Procesar negritas
    processedContent = processedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Reemplazar los saltos de línea con <br> para streaming
    processedContent = processedContent.replace(/\n/g, '<br>');
    
    return processedContent;
  };
  
  return (
    <div className="mt-6" ref={analysisContainerRef}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
          {t('blast.aiAnalysis') || 'AI Analysis'}
        </h3>
        
        {!analysis && !isAnalyzing && !isStreaming ? (
          <button
            onClick={analyzeResultsWithStreaming}
            className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium
              bg-purple-600 hover:bg-purple-700 dark:hover:bg-purple-500
              text-white transition-colors shadow-sm"
          >
            <SparklesIcon className="h-4 w-4 mr-2" />
            {t('blast.analyzeWithAI') || 'Analyze with AI'}
          </button>
        ) : (
          <button
            onClick={analyzeResultsWithStreaming}
            disabled={isAnalyzing || isStreaming}
            className={`inline-flex items-center px-4 py-2 rounded-md text-sm font-medium
              ${(isAnalyzing || isStreaming) 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-gray-600 hover:bg-gray-700 dark:hover:bg-gray-500'}
              text-white transition-colors shadow-sm`}
          >
            {isAnalyzing || isStreaming ? (
              <>
                <ArrowPathIcon className="h-4 w-4 mr-2 animate-spin" />
                {t('blast.analyzing') || 'Analyzing...'}
              </>
            ) : (
              <>
                <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
                {t('blast.regenerateAnalysis') || 'Regenerate Analysis'}
              </>
            )}
          </button>
        )}
      </div>

      {(isAnalyzing || isStreaming) && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 sm:p-6 mb-4">
          <div className="flex items-center space-x-3 mb-3">
            {isStreaming ? (
              <SparklesIcon className="h-6 w-6 text-purple-500 animate-pulse" />
            ) : (
              <ArrowPathIcon className="h-6 w-6 text-purple-500 animate-spin" />
            )}
            <div>
              <p className="text-purple-600 dark:text-purple-300 font-medium">
                {isStreaming 
                  ? (t('blast.generatingStreamAnalysis') || 'Generating analysis in real-time...')
                  : (t('blast.generatingAnalysis') || 'Generating analysis of BLAST results...')}
              </p>
              <div className="flex items-center mt-1 text-xs text-purple-500 dark:text-purple-400">
                <ClockIcon className="h-3 w-3 mr-1" />
                <span>{formatAnalysisTime(analysisDuration)}</span>
              </div>
            </div>
          </div>
          
          {isStreaming && typewriterContent && (
            <div className="bg-white dark:bg-gray-800 rounded-md p-3 mt-2 overflow-y-auto max-h-96 text-sm">
              <div 
                className="prose dark:prose-dark max-w-none text-gray-800 dark:text-gray-200"
              >
                <div style={{ display: "inline" }}>
                  <span
                    dangerouslySetInnerHTML={{ 
                      __html: processStreamContent(typewriterContent) 
                    }} 
                  />
                  {/* Cursor inline con espacio reservado para evitar saltos de layout */}
                  <span className="inline-block" style={{ width: cursorVisible ? 'auto' : '0', overflow: 'hidden', minWidth: '1px' }}>
                    {cursorVisible && <span className="animate-pulse">▌</span>}
                    {!cursorVisible && <span style={{ opacity: 0 }}>▌</span>}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400">
          <p className="font-medium">{t('blast.analysisError') || 'Analysis Error'}</p>
          <p className="mt-1">{error}</p>
          <button
            onClick={analyzeResultsWithStreaming}
            className="mt-3 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            {t('blast.retryAnalysis') || 'Retry Analysis'}
          </button>
        </div>
      )}

      {analysis && !isAnalyzing && !isStreaming && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 sm:p-6">
          <div className="flex items-start">
            <SparklesIcon className="h-6 w-6 text-purple-500 mt-1 flex-shrink-0" />
            <div className="ml-4 w-full">
              <h4 className="font-medium text-purple-700 dark:text-purple-300 mb-2">
                {t('blast.analysisResults') || 'Analysis Results'}
              </h4>
              
              <div 
                className="prose dark:prose-dark max-w-none text-gray-700 dark:text-gray-300 text-sm"
                dangerouslySetInnerHTML={{ 
                  __html: analysis
                }}
              />
              
              <div className="mt-4 text-xs text-purple-600 dark:text-purple-400">
                {t('blast.aiDisclaimer') || 'This analysis is generated by AI and should be interpreted alongside the raw BLAST results.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BlastAIAnalysis;