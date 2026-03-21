import { useTranslation } from '@/context/TranslationProvider';
import { useRef, useState } from 'react';
import { DocumentArrowUpIcon, SparklesIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import TranslationSequenceSearch from './TranslationSequenceSearch';

interface SequenceInputProps {
  value: string;
  onChange: (value: string) => void;
  isLoading: boolean;
}

const SequenceInput = ({ value, onChange, isLoading }: SequenceInputProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showAiSearch, setShowAiSearch] = useState(false);
  const [showDatabaseSearch, setShowDatabaseSearch] = useState(false);
  
  // Generate a unique ID for this input
  const inputId = useRef(`translation-input-${Date.now()}`).current;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      processInput(content);
    };
    reader.readAsText(file);
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      processInput(text);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  const processInput = (content: string) => {
    // Check if the input looks like FASTA format
    if (content.trim().startsWith('>')) {
      try {
        // Parse FASTA
        const lines = content.split('\n');
        const sequenceContent = lines
          .filter(line => !line.startsWith('>') && line.trim().length > 0)
          .join('')
          .trim();

        // Update sequence content
        onChange(sequenceContent);
      } catch (err) {
        console.error('Error parsing FASTA:', err);
      }
    } else {
      // Assume it's just a raw sequence, remove whitespace
      const cleanedSequence = content.replace(/\s+/g, '');
      onChange(cleanedSequence);
    }
  };

  const handleSequenceFound = (foundSequence: string, name?: string) => {
    console.log(`Sequence found by AI search: ${name || 'unnamed'} (${foundSequence.length} bases/residues)`);
    
    // Update the sequence in the parent component
    onChange(foundSequence);
    
    // Hide the search interfaces after finding a sequence
    setShowAiSearch(false);
    setShowDatabaseSearch(false);
    
    return true; // Success indicator
  };
  
  const handleDatabaseSequenceSelected = (sequence: string, name: string, metadata: any) => {
    console.log(`Sequence selected from database: ${name} (${sequence.length} bases/residues), type: ${metadata.type}`);
    
    // Update the sequence in the parent component
    onChange(sequence);
    
    // Hide the search interfaces
    setShowDatabaseSearch(false);
    setShowAiSearch(false);
    
    return true;
  };

  return (
    <div className="mb-4 sm:mb-6">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <h3 className="font-semibold text-base sm:text-lg text-gray-800 dark:text-white">
          {t('translation.sequenceInputLabel')}
        </h3>
        
        <div className="flex space-x-2">
          {/* Database search button */}
          <button
            onClick={() => {
              setShowDatabaseSearch(!showDatabaseSearch);
              setShowAiSearch(false);
            }}
            className="text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 transition-colors flex items-center"
            aria-label={t('translation.searchDatabase') || "Search Database"}
            title={t('translation.searchDatabase') || "Search Database"}
          >
            <MagnifyingGlassIcon className="h-5 w-5 mr-1" />
          </button>
        </div>
      </div>
      
      <div className="relative">
        <textarea
          id="sequence-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={isLoading}
          placeholder={t('translation.sequenceInputPlaceholder') || "Paste your DNA or RNA sequence here..."}
          className="w-full h-36 sm:h-48 min-h-36 p-2 sm:p-3 border border-neutral-200 dark:border-neutral-700 outline-none ring-0 appearance-none
                    bg-neutral-100 dark:bg-neutral-800 rounded-md text-neutral-700 dark:text-neutral-300
                    focus:ring-purple-500 focus:border-purple-500 dark:focus:border-purple-500 dark:focus:ring-purple-500
                    disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:cursor-not-allowed
                    font-mono text-xs sm:text-sm resize-y overflow-auto"
        />
        <div className="absolute bottom-2 sm:bottom-3 right-2 sm:right-3 text-xs text-gray-500 dark:text-gray-400">
          {value.replace(/\s/g, '').length} {t('translation.characters')}
        </div>
      </div>
      
      {/* Database search component (conditional) */}
      {showDatabaseSearch && (
        <TranslationSequenceSearch 
          onSequenceSelected={handleDatabaseSequenceSelected}
          inputId={inputId}
        />
      )}
      
      <div className="flex flex-col sm:flex-row sm:justify-between mt-2">
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 sm:mb-0">
          {t('translation.sequenceInputHelp') || "Enter DNA or RNA sequence to translate into protein."}
        </p>
        
        <div className="flex justify-center sm:justify-end space-x-3 text-xs">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-purple-600 dark:text-purple-400 hover:underline flex items-center"
          >
            <DocumentArrowUpIcon className="h-3 w-3 mr-1" />
            {t('translation.uploadFile') || "Upload file"}
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
            className="text-purple-600 dark:text-purple-400 hover:underline"
          >
            {t('translation.paste') || "Paste"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SequenceInput;