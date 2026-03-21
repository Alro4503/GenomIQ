import { useTranslation } from '@/context/TranslationProvider';
import { useState, useRef } from 'react';
import { ArrowPathIcon, SparklesIcon, ClipboardIcon, DocumentIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface SequenceInputProps {
  sequence: string;
  onSequenceChange: (value: string) => void;
  sequenceId: string;
  onSequenceIdChange: (value: string) => void;
  sequenceType: 'dna' | 'protein';
  isLoading: boolean;
  onSubmit: () => void;
}

const SequenceInput = ({
  sequence,
  onSequenceChange,
  sequenceId,
  onSequenceIdChange,
  sequenceType,
  isLoading,
  onSubmit
}: SequenceInputProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasteSuccess, setPasteSuccess] = useState(false);
  
  // Generate a unique ID for this input
  const inputId = useRef(`annotation-input-${Date.now()}`).current;

  const handlePaste = () => {
    navigator.clipboard.readText().then(
      (clipText) => {
        // Clean the sequence string by removing spaces and line breaks
        const cleanedText = clipText.replace(/[\s\n\r]/g, '');
        onSequenceChange(cleanedText);
        
        // Show success indicator briefly
        setPasteSuccess(true);
        setTimeout(() => setPasteSuccess(false), 2000);
      },
      (err) => {
        console.error('Failed to read clipboard: ', err);
      }
    );
  };

  const handleClear = () => {
    onSequenceChange('');
    onSequenceIdChange('');
  };

  const validateAndSubmit = () => {
    if ((sequence.trim() || sequenceId.trim()) && !isLoading) {
      onSubmit();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        const content = event.target.result as string;
        processInput(content);
      }
    };
    reader.readAsText(file);
  };

  const processInput = (content: string) => {
    // Check if the input looks like FASTA format
    if (content.trim().startsWith('>')) {
      try {
        // Parse FASTA
        const lines = content.split('\n');
        const headerLine = lines.find(line => line.startsWith('>'));
        const header = headerLine ? headerLine.substring(1).trim() : '';
        const sequenceContent = lines
          .filter(line => !line.startsWith('>') && line.trim().length > 0)
          .join('')
          .trim();

        // Update the sequence name if we found a valid header
        if (header) {
          // Try to extract ID from the header (common formats)
          const idMatch = header.match(/^(\S+)/);
          if (idMatch && idMatch[1]) {
            onSequenceIdChange(idMatch[1]);
          }
        }

        // Update sequence content
        onSequenceChange(sequenceContent.replace(/[\s\n\r]/g, ''));
      } catch (err) {
        console.error('Error parsing FASTA:', err);
      }
    } else {
      // Assume it's just a raw sequence, remove whitespace
      const cleanedSequence = content.replace(/\s+/g, '');
      onSequenceChange(cleanedSequence);
    }
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 sm:p-5 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
      <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">
        {t('annotation.sequenceInput')}
      </h3>
      
      <div className="space-y-4">
        {/* Accession ID input */}
        <div>
          <div className="flex justify-between items-center">
            <label htmlFor="sequence-id" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              {t('annotation.sequenceIdLabel')}
            </label>
          </div>
          
          <div className="mt-1 relative rounded-md shadow-sm">
            <input
              type="text"
              id="sequence-id"
              value={sequenceId}
              onChange={(e) => onSequenceIdChange(e.target.value)}
              disabled={isLoading}
              placeholder={t('annotation.sequenceIdPlaceholder')}
              className="block w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 
                      bg-white dark:bg-neutral-800 rounded-md 
                      text-neutral-700 dark:text-neutral-300 
                      focus:ring-purple-500 focus:border-purple-500"
            />
          </div>
          
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('annotation.sequenceIdHelp')}
          </p>
        </div>
        
        {/* OR divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="px-2 bg-white dark:bg-neutral-900 text-sm text-gray-500 dark:text-gray-400">
              {t('annotation.or')}
            </span>
          </div>
        </div>
        
        {/* Sequence input */}
        <div>
          <div className="flex justify-between items-center">
            <label htmlFor="sequence" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
              {sequenceType === 'protein' ? t('annotation.proteinSequenceLabel') : t('annotation.dnaSequenceLabel')}
            </label>
            
            <div className="flex space-x-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors"
                title={t('annotation.uploadFile')}
              >
                <DocumentIcon className="h-5 w-5" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".fasta,.fa,.txt"
                className="hidden"
                onChange={handleFileUpload}
              />

              <button
                onClick={handlePaste}
                className="text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-300 transition-colors"
                title={t('translation.paste')}
              >
                <ClipboardIcon className="h-5 w-5" />
              </button>
              
              <button
                onClick={handleClear}
                className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                disabled={isLoading || (!sequence && !sequenceId)}
                title={t('translation.clearButton')}
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
          
          <div className="mt-1">
            <textarea
              id="sequence"
              value={sequence}
              onChange={(e) => onSequenceChange(e.target.value.replace(/[\s\n\r]/g, ''))}
              disabled={isLoading}
              rows={6}
              placeholder={
                sequenceType === 'protein'
                  ? t('annotation.proteinSequencePlaceholder')
                  : t('annotation.dnaSequencePlaceholder')
              }
              className="block w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 
                        bg-white dark:bg-neutral-800 rounded-md 
                        text-neutral-700 dark:text-neutral-300 
                        focus:ring-purple-500 focus:border-purple-500 font-mono text-sm"
            />
          </div>
          
          <div className="flex justify-between mt-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {sequence.length} {t('translation.characters')}
            </p>

            {pasteSuccess && (
              <p className="text-xs text-green-500 animate-pulse">
                {t('annotation.pasteDone') || 'Pasted successfully'}
              </p>
            )}
          </div>
        </div>
      </div>
      
      {/* Submit button */}
      <div className="mt-6">
        <button
          type="button"
          onClick={validateAndSubmit}
          disabled={isLoading || (!sequence.trim() && !sequenceId.trim())}
          className={`w-full px-4 sm:px-6 py-2 sm:py-3 text-base font-medium rounded-md transition-colors flex items-center justify-center
            ${isLoading ? 'bg-purple-300 dark:bg-purple-800/50 text-gray-100 dark:text-gray-400 opacity-60' : 
            (!sequence.trim() && !sequenceId.trim()) ? 
              'bg-purple-300 dark:bg-purple-800/50 text-gray-100 dark:text-gray-400 opacity-60' : 
              'bg-purple-600 hover:bg-purple-700 text-white'}`}
        >
          {isLoading ? (
            <>
              <ArrowPathIcon className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" />
              {t('common.loading')}
            </>
          ) : (
            t('annotation.annotateButton')
          )}
        </button>
      </div>
    </div>
  );
};

export default SequenceInput;