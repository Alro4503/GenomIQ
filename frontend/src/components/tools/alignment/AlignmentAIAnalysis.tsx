import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { SparklesIcon, ArrowPathIcon, ArrowUturnLeftIcon, ClockIcon } from '@heroicons/react/24/outline';
import { AlignmentResult } from '@/types/alignment';
import alignmentAnalysisService from '@/services/alignment/alignmentAnalysisService';
import { useChatWebSocket } from '@/context/ChatWebSocketContext';

interface AlignmentAIAnalysisProps {
  result: AlignmentResult;
}

const AlignmentAIAnalysis: React.FC<AlignmentAIAnalysisProps> = ({ result }) => {
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

  // Función mejorada para formatear texto con Markdown
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

  // Efecto para animar el cursor parpadeante
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

  // Construir el prompt para análisis de alineamiento
  const constructAlignmentAnalysisPrompt = (alignmentResult: AlignmentResult): string => {
    const sequenceCount = alignmentResult.alignedSequences.length;
    const sequenceNames = alignmentResult.alignedSequences.map(seq => seq.name).join(', ');
    const alignmentLength = alignmentResult.alignedSequences[0]?.content.length || 0;
    
    const language_suffix = language === 'es' 
      ? 'IMPORTANTE: Responde completamente en español.' 
      : 'IMPORTANT: Respond completely in English.';
    
    return `
As a bioinformatics expert, analyze this multiple sequence alignment:

Details:
- Method: ${alignmentResult.method}
- Sequences: ${sequenceCount} (${sequenceNames})
- Alignment length: ${alignmentLength} 
- Alignment score: ${alignmentResult.alignmentScore}%
- Conserved regions: ${alignmentResult.conservedRegions.length}

Please provide:
1. Biological significance of this alignment
2. Key patterns and motifs identified
3. Functional implications of conserved regions
4. Evolutionary insights from the alignment
5. Recommendations for further analysis

Make your analysis detailed, informative, and scientifically accurate. 
Format important points, keywords and section titles using markdown **bold** syntax. 
Use double line breaks (\\n\\n) between paragraphs for better readability.
Ensure each section is clearly separated with proper paragraph spacing.
${language_suffix}

DO NOT include any tool recommendations in the format [TOOL:name].
`;
  };

  // Función para analizar los resultados (fallback al método tradicional)
  const analyzeAlignment = async () => {
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null); // Limpiar análisis anterior
    setTypewriterContent(''); // Limpiar contenido de streaming

    try {
      // Usar el servicio para analizar los resultados
      const analysisText = await alignmentAnalysisService.analyzeAlignment(result, language);
      setAnalysis(formatText(analysisText));
    } catch (err) {
      console.error('AI analysis error:', err);
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Función para analizar los resultados con streaming
  const analyzeWithStreaming = async () => {
    // Reiniciar estados
    setIsAnalyzing(true);
    setError(null);
    setAnalysis(null);
    setTypewriterContent('');
    
    try {
      if (!wsConnected) {
        // Fallback al método tradicional si WebSocket no está disponible
        console.log('WebSocket no disponible, usando método tradicional');
        await analyzeAlignment();
        return;
      }

      // Construir prompt para análisis de alineamiento
      const prompt = constructAlignmentAnalysisPrompt(result);
      
      // Usar WebSocket para streaming
      await sendStreamMessage(prompt, undefined, 'alignment');
      
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
          {t('alignment.aiAnalysis')}
        </h3>
        
        {!analysis && !isAnalyzing && !isStreaming ? (
          <button
            onClick={analyzeWithStreaming}
            className="inline-flex items-center px-4 py-2 rounded-md text-sm font-medium
              bg-purple-600 hover:bg-purple-700 dark:hover:bg-purple-500
              text-white transition-colors shadow-sm"
          >
            <SparklesIcon className="h-4 w-4 mr-2" />
            {t('alignment.analyzeWithAI')}
          </button>
        ) : (
          <button
            onClick={analyzeWithStreaming}
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
                {t('alignment.analyzing') || 'Analyzing...'}
              </>
            ) : (
              <>
                <ArrowUturnLeftIcon className="h-4 w-4 mr-2" />
                {t('alignment.regenerateAnalysis') || 'Regenerate Analysis'}
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
                  ? (t('alignment.generatingStreamAnalysis') || 'Generating analysis in real-time...')
                  : (t('alignment.generatingAnalysis') || 'Generating analysis...')}
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
          <p className="font-medium">{t('alignment.analysisError') || 'Analysis Error'}</p>
          <p className="mt-1">{error}</p>
          <button
            onClick={analyzeWithStreaming}
            className="mt-3 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            {t('alignment.retryAnalysis') || 'Retry Analysis'}
          </button>
        </div>
      )}

      {analysis && !isAnalyzing && !isStreaming && (
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start">
            <SparklesIcon className="h-6 w-6 text-purple-500 mt-1 flex-shrink-0 mb-3 sm:mb-0" />
            <div className="sm:ml-4 w-full">
              <h4 className="font-medium text-purple-700 dark:text-purple-300 mb-2">
                {t('alignment.analysisResults') || 'Analysis Results'}
              </h4>
              
              <div 
                className="prose dark:prose-dark max-w-none text-gray-700 dark:text-gray-300 text-sm"
                dangerouslySetInnerHTML={{ 
                  __html: analysis
                }}
              />
              
              <div className="mt-4 text-xs text-purple-600 dark:text-purple-400">
                {t('alignment.aiDisclaimer') || 'This analysis is generated by AI and should be interpreted alongside the alignment results.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlignmentAIAnalysis;