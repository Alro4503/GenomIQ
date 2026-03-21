'use client';

import { useState } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import SequenceInput from '@/components/tools/translation/SequenceInput';
import TranslationOptions from '@/components/tools/translation/TranslationOptions';
import TranslationResults from '@/components/tools/translation/TranslationResults';
import FloatingChat from '@/components/chat/FloatingChat';
import { translateSequence } from '@/utils/translator';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import ToolPageWrapper from '@/components/tools/ToolPageWrapper';

interface TranslationState {
  inputSequence: string;
  outputSequence: string;
  sequenceType: 'DNA' | 'RNA';
  readingFrame: number;
  includeAllFrames: boolean;
  loading: boolean;
  error: string | null;
}

// Componente principal con el contenido de la herramienta
const TranslationContent = () => {
  const { t } = useTranslation();
  const [state, setState] = useState<TranslationState>({
    inputSequence: '',
    outputSequence: '',
    sequenceType: 'DNA',
    readingFrame: 0,
    includeAllFrames: false,
    loading: false,
    error: null
  });

  // Contexto de la herramienta para el chat flotante
  const toolContext = {
    name: 'translation',
    displayName: t('tools.translation', { defaultValue: 'Traducción de secuencias' })
  };

  const handleSequenceChange = (value: string) => {
    setState(prev => {
      // If the sequence starts switching from a DNA to a potentially RNA sequence
      if (prev.sequenceType === 'DNA' && !prevContainsUracil(prev.inputSequence) && containsUracil(value)) {
        // Auto-switch to RNA if uracil (U) is detected
        return { 
          ...prev, 
          inputSequence: value, 
          sequenceType: 'RNA', 
          error: null 
        };
      }
      return { ...prev, inputSequence: value, error: null };
    });
  };

  // Helper functions to check for uracil in sequences
  const containsUracil = (sequence: string): boolean => {
    return /[Uu]/.test(sequence);
  };

  const prevContainsUracil = (sequence: string): boolean => {
    return /[Uu]/.test(sequence);
  };

  const handleOptionChange = (option: Partial<TranslationState>) => {
    setState(prev => ({ ...prev, ...option, error: null }));
  };

  const validateSequence = (sequence: string, type: 'DNA' | 'RNA'): boolean => {
    if (!sequence.trim()) {
      setState(prev => ({ ...prev, error: t('translation.errorEmptySequence') }));
      return false;
    }

    // Validate sequence characters based on type
    const dnaRegex = /^[ATGCatgc\s]+$/;
    const rnaRegex = /^[AUGCaugc\s]+$/;
    
    const isValid = type === 'DNA' ? dnaRegex.test(sequence) : rnaRegex.test(sequence);
    
    if (!isValid) {
      setState(prev => ({ 
        ...prev, 
        error: type === 'DNA' 
          ? t('translation.errorInvalidDNA') 
          : t('translation.errorInvalidRNA')
      }));
    }
    
    return isValid;
  };

  const handleTranslate = () => {
    try {
      // Clean the sequence (remove whitespace)
      const cleanSequence = state.inputSequence.replace(/\s/g, '');
      
      if (!validateSequence(cleanSequence, state.sequenceType)) {
        return;
      }
      
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      if (state.includeAllFrames) {
        // Translate in all reading frames
        const results: string[] = [];
        for (let frame = 0; frame < 3; frame++) {
          const frameResult = translateSequence(cleanSequence, state.sequenceType, frame);
          results.push(`Frame ${frame + 1}: ${frameResult}`);
        }
        setState(prev => ({ 
          ...prev, 
          outputSequence: results.join('\n\n'), 
          loading: false 
        }));
      } else {
        // Translate in selected reading frame only
        const result = translateSequence(cleanSequence, state.sequenceType, state.readingFrame);
        setState(prev => ({ ...prev, outputSequence: result, loading: false }));
      }
    } catch (err: any) {
      setState(prev => ({ 
        ...prev, 
        error: err.message || t('translation.errorGeneric'), 
        loading: false 
      }));
    }
  };

  const isTranslateDisabled = state.loading || !state.inputSequence.trim();

  return (
    <div className="px-4 sm:px-6 py-6 sm:py-8 mx-auto max-w-7xl h-full">
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center mb-2">
          <DocumentTextIcon className="h-6 w-6 sm:h-8 sm:w-8 text-purple-500 mr-2 sm:mr-3" />
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-white">
            {t('tools.translation')}
          </h1>
        </div>
        <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
          {t('tools.translationDesc')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 min-h-[600px] h-[calc(100vh-200px)]">
        <div className="h-full bg-white dark:bg-neutral-900 rounded-xl p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all flex flex-col">
          <SequenceInput 
            value={state.inputSequence} 
            onChange={handleSequenceChange} 
            isLoading={state.loading}
          />
          
          <TranslationOptions 
            sequenceType={state.sequenceType}
            readingFrame={state.readingFrame}
            includeAllFrames={state.includeAllFrames}
            onChange={handleOptionChange}
            disabled={state.loading}
          />
          
          {state.error && (
            <div className="mt-4 p-2 sm:p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-md text-sm">
              {state.error}
            </div>
          )}
          
          <div className="mt-4 sm:mt-6 flex justify-center mt-auto pt-4">
            <button
              onClick={handleTranslate}
              disabled={isTranslateDisabled}
              className={`px-4 sm:px-6 py-2 font-medium rounded-md transition-colors w-full sm:w-auto max-w-xs
                ${isTranslateDisabled 
                  ? 'bg-purple-300 dark:bg-purple-800/50 text-gray-100 dark:text-gray-400 opacity-60' 
                  : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
            >
              {state.loading ? t('common.loading') : t('translation.translateButton')}
            </button>
          </div>
        </div>
        
        <TranslationResults result={state.outputSequence} />
      </div>
      
      {/* Chat flotante */}
      <FloatingChat toolContext={toolContext} />
    </div>
  );
};

// Página principal con protección de ruta
export default function TranslationPage() {
  return (
    <ToolPageWrapper>
      <TranslationContent />
    </ToolPageWrapper>
  );
}