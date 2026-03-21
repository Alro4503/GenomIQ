import { useTranslation } from '@/context/TranslationProvider';
import { useState, useEffect, useRef } from 'react';
import { ArrowUpTrayIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { BlastProgram, BlastProgramInfo, validateSequence } from '@/types/blast';
import SequenceDatabaseSearch from '@/components/common/SequenceDatabaseSearch';

interface SequenceInputProps {
  sequence: string;
  onChange: (sequence: string) => void;
  isLoading: boolean;
  program: BlastProgram;
}

const SequenceInput = ({
  sequence,
  onChange,
  isLoading,
  program
}: SequenceInputProps) => {
  const { t } = useTranslation();
  const [dragActive, setDragActive] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);
  const [showDatabaseSearch, setShowDatabaseSearch] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Calcular conteo de caracteres, eliminando espacios en blanco
    setCharCount(sequence.replace(/\s/g, '').length);
    
    // Validar secuencia cuando cambia o cambia el programa
    if (sequence.trim().length > 0) {
      const validation = validateSequence(sequence, program);
      setValidationError(validation.valid ? null : validation.message || null);
    } else {
      setValidationError(null);
    }
  }, [sequence, program]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (isLoading) return;
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      
      // Verificar que sea un archivo de texto
      if (file.type === 'text/plain' || file.name.endsWith('.fasta') || file.name.endsWith('.fa')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          if (event.target?.result) {
            onChange(event.target.result as string);
          }
        };
        reader.readAsText(file);
      } else {
        alert(t('blast.errorInvalidFile'));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isLoading) return;
    
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onChange(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isLoading) return;
    onChange(e.target.value);
  };

  const handlePaste = async () => {
    if (isLoading) return;
    
    try {
      const clipText = await navigator.clipboard.readText();
      onChange(clipText);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  const handleClear = () => {
    if (isLoading) return;
    onChange('');
  };

  // Información sobre el programa BLAST seleccionado
  const programInfo = BlastProgramInfo[program];

  // Determine the query type based on the BLAST program
  const queryType = programInfo?.queryType || 'nucleotide';

  // Handle sequence selection from database search
  const handleSequenceSelected = (foundSequence: string, name: string, metadata: any) => {
    if (foundSequence) {
      // Process the sequence to remove whitespace and ensure it's formatted correctly
      const cleanSequence = foundSequence.replace(/\s+/g, '').toUpperCase();
      onChange(cleanSequence);
      
      // Hide the search UI after a successful search
      setShowDatabaseSearch(false);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
          {t('blast.sequenceInputLabel')}
        </h3>
        
        {/* Database Search button */}
        <button
          onClick={() => setShowDatabaseSearch(!showDatabaseSearch)}
          className="text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
          aria-label={t('blast.searchDatabase') || "Search Database"}
          title={t('blast.searchDatabase') || "Search Database"}
          disabled={isLoading}
        >
          <MagnifyingGlassIcon className="h-5 w-5" />
        </button>
      </div>
      
      {/* Instrucciones */}
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {queryType === 'nucleotide' 
            ? t('blast.enterNucleotideSequence') 
            : t('blast.enterProteinSequence')}
        </p>
      </div>
      
      {/* Database Search component (conditional) */}
      {showDatabaseSearch && (
        <div className="mb-4">
          <SequenceDatabaseSearch 
            onSequenceSelected={handleSequenceSelected} 
            inputId={`blast-${program}`}
            toolContext="blast"
          />
        </div>
      )}
      
      {/* Área de texto para la secuencia */}
      <div className="mb-4">
        <div
          className={`
            relative border-2 rounded-lg 
            transition-all duration-200 ease-in-out
            ${dragActive ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' : 'border-gray-300 dark:border-gray-600'}
            ${isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10'}
            ${validationError ? 'border-red-500' : ''}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <textarea
            ref={textareaRef}
            value={sequence}
            onChange={handleTextChange}
            disabled={isLoading}
            placeholder={queryType === 'nucleotide' 
              ? 'ATGCAGTAGCTAGCTGACTGACTGACTAGCTGATCGA...' 
              : 'METTLYSVALASPYROTRP...'}
            className={`
              w-full px-4 py-3 rounded-lg font-mono text-sm resize-y h-40 min-h-40
              bg-transparent focus:outline-none focus:ring-0
              text-gray-800 dark:text-gray-200
              placeholder-gray-400 dark:placeholder-gray-600
              ${isLoading ? 'cursor-not-allowed' : ''}
            `}
            data-testid="sequence-input"
          />
          
          {/* Contador de caracteres */}
          <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
            {charCount} {t('blast.characters')}
          </div>
          
          {dragActive && !isLoading && (
            <div className="absolute inset-0 bg-purple-100 dark:bg-purple-900/30 bg-opacity-70 flex items-center justify-center rounded-lg">
              <div className="text-center p-4">
                <ArrowUpTrayIcon className="h-10 w-10 mx-auto text-purple-600 dark:text-purple-400" />
                <p className="text-purple-700 dark:text-purple-300 font-medium">
                  {t('blast.dropToUpload')}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Mensaje de error de validación */}
        {validationError && (
          <div className="mt-2 text-sm text-red-500">
            {validationError}
          </div>
        )}
      </div>
      
      {/* Controles de archivo y utilidades */}
      <div className="flex justify-between items-center">
        <label className={`
          inline-flex items-center px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors
          ${isLoading 
            ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed' 
            : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }
        `}>
          <ArrowUpTrayIcon className="h-4 w-4 mr-2" />
          {t('blast.uploadFile')}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".txt,.fasta,.fa"
            onChange={handleFileChange}
            disabled={isLoading}
            data-testid="file-input"
          />
        </label>
        
        <div className="flex space-x-3">
          <button
            onClick={handlePaste}
            disabled={isLoading}
            className="text-purple-600 dark:text-purple-400 hover:underline text-xs"
          >
            {t('blast.paste') || 'Paste'}
          </button>
          
          <button
            onClick={handleClear}
            disabled={isLoading || !sequence}
            className="text-purple-600 dark:text-purple-400 hover:underline text-xs"
          >
            {t('blast.clear') || 'Clear'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SequenceInput;