'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { ArrowPathIcon, PlusIcon } from '@heroicons/react/24/outline';
import { Sequence, AlignmentParams, AlignmentResult as AlignmentResultType } from '@/types/alignment';
import SequenceInput from '@/components/tools/alignment/SequenceInput';
import AlignmentOptions from '@/components/tools/alignment/AlignmentOptions';
import AlignmentResult from '@/components/tools/alignment/AlignmentResult';
import AlignmentLoading from '@/components/tools/alignment/AlignmentLoading';
import { performAlignment } from '@/services/alignment/alignmentService';
import Button from '@/components/ui/ButtonPurple';
import FloatingChat from '@/components/chat/FloatingChat';
import ToolPageWrapper from '@/components/tools/ToolPageWrapper';

// Sistema de seguimiento para secuencias pendientes
// Sistema de seguimiento para secuencias pendientes mejorado con timestamps
const pendingSequencesTracker = {
  // Map para rastrear secuencias pendientes de actualización por ID con timestamps
  pendingSequences: new Map<string, {timestamp: number, query: string}>(),
  
  // Registrar una secuencia como pendiente con timestamp
  register(id: string, query: string = '') {
    const timestamp = Date.now();
    this.pendingSequences.set(id, {timestamp, query});
    console.log(`Secuencia ${id} marcada como pendiente con timestamp ${timestamp}`);
    return timestamp;
  },
  
  // Limpiar una secuencia pendiente (por ID o por ID y timestamp específico)
  clear(id: string, timestamp?: number) {
    const pendingData = this.pendingSequences.get(id);
    
    // Si se proporcionó un timestamp, solo limpiar si coincide
    if (timestamp && pendingData && pendingData.timestamp !== timestamp) {
      console.log(`No se pudo limpiar secuencia ${id}: el timestamp ${timestamp} no coincide con ${pendingData.timestamp}`);
      return false;
    }
    
    this.pendingSequences.delete(id);
    console.log(`Secuencia ${id} ya no está pendiente`);
    return true;
  },
  
  // Verificar si hay secuencias pendientes
  hasPendingSequences() {
    return this.pendingSequences.size > 0;
  },
  
  // Obtener todas las secuencias pendientes
  getPendingSequenceIds() {
    return Array.from(this.pendingSequences.keys());
  },
  
  // Verificar si una secuencia específica está pendiente
  isPending(id: string) {
    return this.pendingSequences.has(id);
  },
  
  // Obtener datos de una secuencia pendiente
  getPendingData(id: string) {
    return this.pendingSequences.get(id);
  }
};

// Componente de contenido principal
const AlignmentContent = () => {
  const { t } = useTranslation();
  const [sequences, setSequences] = useState<Sequence[]>([
    { id: '1', name: 'Sequence 1', content: '' },
    { id: '2', name: 'Sequence 2', content: '' }
  ]);
  const [params, setParams] = useState<AlignmentParams>({
    method: 'clustal',
    gapOpenPenalty: 10,
    gapExtensionPenalty: 0.5,
    substitutionMatrix: 'BLOSUM62'
  });
  const [result, setResult] = useState<AlignmentResultType | null>(null);
  const [isAligning, setIsAligning] = useState(false);
  const [alignmentStep, setAlignmentStep] = useState<'loading' | 'aligning' | 'processing'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [moduleError, setModuleError] = useState<string | null>(null);
  
  // Referencia para contar secuencias con AI
  const aiSequencesCount = useRef<number>(0);

  // Contexto de la herramienta para el chat flotante
  const toolContext = {
    name: 'alignment',
    displayName: t('tools.alignment')
  };

  // Preload biowasm modules to check if they're available
  useEffect(() => {
    // Simple check to see if the browser is compatible (WebAssembly support)
    if (typeof WebAssembly === 'undefined') {
      setModuleError(t('alignment.errorNoWebAssembly'));
    }
  }, [t]);

  // Registro de solicitudes de secuencia en curso
  useEffect(() => {
    // Monitorear cambios en el DOM para actualizar secuencias completas
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && 
            mutation.attributeName === 'data-ai-filled' &&
            mutation.target instanceof HTMLElement) {
          
          const target = mutation.target as HTMLElement;
          const sequenceId = target.getAttribute('data-sequence-id') || 
                            target.id.replace('sequence-textarea-', '');
          
          if (sequenceId && target.getAttribute('data-ai-filled') === 'true') {
            aiSequencesCount.current += 1;
            console.log(`Detectada secuencia completada por IA: ${sequenceId}. Total: ${aiSequencesCount.current}`);
            
            // Marcar esta secuencia como completa
            pendingSequencesTracker.clear(sequenceId);
          }
        }
      });
    });
    
    // Configurar observación de atributos en elementos textarea existentes
    document.querySelectorAll('textarea[id^="sequence-textarea-"]').forEach(textarea => {
      observer.observe(textarea, { attributes: true });
    });
    
    return () => observer.disconnect();
  }, []);

  const addSequence = () => {
    setSequences([
      ...sequences,
      {
        id: (sequences.length + 1).toString(),
        name: `Sequence ${sequences.length + 1}`,
        content: ''
      }
    ]);
  };

  const removeSequence = (id: string) => {
    if (sequences.length > 2) {
      setSequences(sequences.filter(seq => seq.id !== id));
      
      // También limpiar cualquier secuencia pendiente si se elimina
      pendingSequencesTracker.clear(id);
    }
  };

  const updateSequence = (id: string, field: keyof Sequence, value: string) => {
    setSequences(
      sequences.map(seq =>
        seq.id === id ? { ...seq, [field]: value } : seq
      )
    );
    
    // Si estamos actualizando el contenido y tiene valor, marcar como completa
    if (field === 'content' && value.trim()) {
      pendingSequencesTracker.clear(id);
    }
  };

  // Mejorada para manejar múltiples solicitudes de secuencias
  const handleRunAlignment = async () => {
    // PASO 1: Verificación para asegurarnos de que no haya secuencias pendientes
    if (pendingSequencesTracker.hasPendingSequences()) {
      const pendingIds = pendingSequencesTracker.getPendingSequenceIds();
      console.log(`Hay secuencias pendientes: ${pendingIds.join(', ')}`);
      
      // Esperar un poco para dar tiempo a que se actualicen
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Volver a verificar después de la espera
      if (pendingSequencesTracker.hasPendingSequences()) {
        setError(t('alignment.waitingForSequences'));
        return;
      }
    }

    // PASO 2: Verificación mejorada para secuencias llenadas por IA
    // Crear una copia de las secuencias para posibles correcciones
    let sequencesToUse = [...sequences];
    let needsUpdate = false;

    // Verificar secuencias marcadas con atributos de datos de la IA
    document.querySelectorAll('[data-ai-filled="true"]').forEach(element => {
      if (element instanceof HTMLTextAreaElement) {
        const sequenceId = element.id.replace('sequence-textarea-', '');
        const actualContent = element.value.trim();

        if (actualContent.length > 0) {
          console.log(`Found AI-filled sequence: ${sequenceId} with length ${actualContent.length}`);

          // Buscar esta secuencia en el estado actual
          const index = sequencesToUse.findIndex(s => s.id === sequenceId);

          // Si encontramos la secuencia y está vacía en el estado pero tiene contenido en el DOM
          if (index >= 0 && !sequencesToUse[index].content.trim()) {
            console.log(`Fixing sequence ${sequenceId}: Empty in state but has content in DOM`);
            sequencesToUse[index].content = actualContent;
            needsUpdate = true;
          }
        }
      }
    });

    // Verificar todos los textareas directamente por si acaso
    document.querySelectorAll('textarea[id^="sequence-textarea-"]').forEach(element => {
      if (element instanceof HTMLTextAreaElement) {
        const sequenceId = element.id.replace('sequence-textarea-', '');
        const actualContent = element.value.trim();

        if (actualContent.length > 0) {
          const index = sequencesToUse.findIndex(s => s.id === sequenceId);

          if (index >= 0 && !sequencesToUse[index].content.trim()) {
            console.log(`Fixing sequence ${sequenceId} using direct textarea check`);
            sequencesToUse[index].content = actualContent;
            needsUpdate = true;
          }
        }
      }
    });

    // Si fue necesario actualizar, hacerlo antes de continuar
    if (needsUpdate) {
      console.log('Updating sequences state with fixes:', sequencesToUse);
      setSequences(sequencesToUse);
    }

    // PASO 3: Validación normal de secuencias
    const validSequences = sequencesToUse.filter(seq => seq.content.trim().length > 0);

    if (validSequences.length < 2) {
      setError(t('alignment.errorNotEnoughSequences'));
      return;
    }

    // PASO 4: Continuar con el proceso normal de alineamiento
    setIsAligning(true);
    setError(null);
    setResult(null);

    try {
      // Progress through alignment steps
      setAlignmentStep('loading');

      // Add a small delay to ensure the loading component renders
      await new Promise(resolve => setTimeout(resolve, 100));

      // Update to aligning step
      setAlignmentStep('aligning');

      // Perform the alignment with las secuencias validadas y corregidas
      const result = await performAlignment(validSequences, params);

      // Update to processing step
      setAlignmentStep('processing');

      // Small delay to show processing step
      await new Promise(resolve => setTimeout(resolve, 500));

      // Set the result
      setResult(result);
    } catch (err) {
      console.error('Alignment error:', err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsAligning(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <ArrowPathIcon className="h-8 w-8 text-purple-500 mr-3" />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            {t('tools.alignment')}
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {t('tools.alignmentDesc')}
        </p>

        {/* WebAssembly Support Warning */}
        {moduleError && (
          <div className="mt-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 text-yellow-800 dark:text-yellow-400">
            <p className="font-medium">{moduleError}</p>
            <p className="mt-1 text-sm">{t('alignment.tryAnotherBrowser')}</p>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Input Sequences */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
          <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">
            {t('alignment.inputSequences')}
          </h3>

          <div className="space-y-4">
            {sequences.map(sequence => (
              <SequenceInput
                key={sequence.id}
                sequence={sequence}
                onChange={updateSequence}
                onRemove={removeSequence}
                canRemove={sequences.length > 2}
              />
            ))}

            {/* Centered Add Button */}
            <div className="flex justify-center mt-4">
              <button
                onClick={addSequence}
                className="w-12 h-12 rounded-full bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center shadow-md transition-all hover:shadow-lg"
                aria-label={t('alignment.addSequence')}
                title={t('alignment.addSequence')}
              >
                <PlusIcon className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Alignment Options */}
        <AlignmentOptions
          params={params}
          onChange={setParams}
        />

        {/* Action Buttons */}
        <div className="flex justify-center">
          <Button
            onClick={handleRunAlignment}
            isLoading={isAligning}
            disabled={isAligning || !!moduleError || pendingSequencesTracker.hasPendingSequences()}
            size="lg"
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isAligning ? t('alignment.aligning') : 
              pendingSequencesTracker.hasPendingSequences() ? t('alignment.waitingForSequences') : 
              t('alignment.runAlignment')}
          </Button>
        </div>

        {/* Loading Indicator */}
        {isAligning && (
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800">
            <AlignmentLoading step={alignmentStep} method={params.method} />
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-400">
            <p className="font-medium">{t('alignment.errorOccurred')}</p>
            <p className="mt-1">{error}</p>
          </div>
        )}

        {/* Results Display */}
        {result && !isAligning && (
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
            <AlignmentResult result={result} />
          </div>
        )}
      </div>

      {/* Chat flotante */}
      <FloatingChat toolContext={toolContext} />
    </div>
  );
};

// Página principal con protección de ruta
export default function AlignmentPage() {
  return (
    <ToolPageWrapper>
      <AlignmentContent />
    </ToolPageWrapper>
  );
}