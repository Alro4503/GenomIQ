'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { Sequence } from '@/types/alignment';
import { XMarkIcon, DocumentArrowUpIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import SequenceDatabaseSearch from '../../common/SequenceDatabaseSearch';

interface SequenceInputProps {
  sequence: Sequence;
  onChange: (id: string, field: keyof Sequence, value: string) => void;
  onRemove: (id: string) => void;
  canRemove: boolean;
}

// Object singleton to track updates globally
const sequenceUpdateTracker = {
  pendingUpdates: new Map<string, {timestamp: number, content: string, name?: string}>(),
  
  registerUpdate(id: string, content: string, name?: string) {
    this.pendingUpdates.set(id, {
      timestamp: Date.now(),
      content,
      name
    });
    console.log(`Registered update for sequence ${id}, length: ${content.length}`);
  },
  
  getUpdate(id: string) {
    return this.pendingUpdates.get(id);
  },
  
  clearUpdate(id: string) {
    this.pendingUpdates.delete(id);
  }
};

export default function SequenceInput({
  sequence,
  onChange,
  onRemove,
  canRemove
}: SequenceInputProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showDatabaseSearch, setShowDatabaseSearch] = useState(false);
  
  // Reference for update tracking
  const updateCountRef = useRef<number>(0);

  // Keep a local copy of the sequence content to ensure UI updates properly
  const [localContent, setLocalContent] = useState(sequence.content);

  // Sync local content with props when sequence.content changes
  useEffect(() => {
    setLocalContent(sequence.content);
  }, [sequence.content]);

  // Effect to check registered updates every 100ms
  useEffect(() => {
    const intervalId = setInterval(() => {
      const pendingUpdate = sequenceUpdateTracker.getUpdate(sequence.id);
      if (pendingUpdate) {
        // Check if this component should apply the update
        const textareaElement = document.getElementById(`sequence-textarea-${sequence.id}`);
        if (textareaElement) {
          console.log(`Applying pending update for sequence ${sequence.id}`);
          
          // Update locally
          setLocalContent(pendingUpdate.content);
          
          // Update the parent
          onChange(sequence.id, 'content', pendingUpdate.content);
          
          // Update name if available
          if (pendingUpdate.name) {
            onChange(sequence.id, 'name', pendingUpdate.name);
          }
          
          // Apply visually to textarea
          if (textareaElement instanceof HTMLTextAreaElement) {
            textareaElement.value = pendingUpdate.content;
            
            // Trigger an input event for any other listeners
            const inputEvent = new Event('input', { bubbles: true });
            textareaElement.dispatchEvent(inputEvent);
            
            // Mark as updated with database search
            textareaElement.setAttribute('data-db-filled', 'true');
            textareaElement.setAttribute('data-sequence-length', pendingUpdate.content.length.toString());
            textareaElement.setAttribute('data-updated-at', pendingUpdate.timestamp.toString());
          }
          
          // Clear this update
          sequenceUpdateTracker.clearUpdate(sequence.id);
          
          // Clear errors
          setValidationError(null);
        }
      }
    }, 100);
    
    return () => clearInterval(intervalId);
  }, [sequence.id, onChange]);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      processInput(text);
    } catch (err) {
      console.error('Failed to read clipboard:', err);
    }
  };

  const handleClear = () => {
    onChange(sequence.id, 'content', '');
    setLocalContent(''); // Update local state as well
    setValidationError(null);
  };

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
          onChange(sequence.id, 'name', header);
        }

        // Update sequence content and local state
        onChange(sequence.id, 'content', sequenceContent);
        setLocalContent(sequenceContent);
        setValidationError(null);
      } catch (err) {
        console.error('Error parsing FASTA:', err);
        setValidationError(t('alignment.invalidFasta'));
      }
    } else {
      // Assume it's just a raw sequence, remove whitespace
      const cleanedSequence = content.replace(/\s+/g, '');
      onChange(sequence.id, 'content', cleanedSequence);
      setLocalContent(cleanedSequence); // Update local state
      setValidationError(null);
    }
  };

  const handleSequenceSelected = (foundSequence: string, name: string, metadata: any) => {
    console.log(`handleSequenceSelected called for sequence ID=${sequence.id} with length: ${foundSequence.length}`);
    updateCountRef.current += 1;

    // Ensure the sequence is properly formatted
    const cleanedSequence = foundSequence.replace(/[^A-Za-z]/g, '').toUpperCase();
    
    // Register this update in the global tracker
    sequenceUpdateTracker.registerUpdate(sequence.id, cleanedSequence, name);
    
    // Update local state as well for faster response
    setLocalContent(cleanedSequence);
    
    // Update parent state immediately
    onChange(sequence.id, 'content', cleanedSequence);
    
    // If a name was provided, update it
    if (name) {
      onChange(sequence.id, 'name', name);
    }
    
    // Hide the database search UI
    setShowDatabaseSearch(false);
    setValidationError(null);

    return true; // Success indicator
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-700 p-4">
      <div className="flex justify-between items-center mb-2">
        <input
          type="text"
          value={sequence.name}
          onChange={(e) => onChange(sequence.id, 'name', e.target.value)}
          className="font-medium bg-transparent border-b border-transparent hover:border-purple-500 focus:border-purple-500 focus:outline-none p-1 text-gray-800 dark:text-white"
          aria-label={t('alignment.sequenceName')}
        />

        <div className="flex items-center space-x-2">
          {/* Database search button */}
          <button
            onClick={() => setShowDatabaseSearch(!showDatabaseSearch)}
            className="text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            aria-label={t('alignment.searchDatabase')}
            title={t('alignment.searchDatabase')}
            data-sequence-id={sequence.id}
          >
            <MagnifyingGlassIcon className="h-5 w-5" />
          </button>

          {/* Remove button (if allowed) */}
          {canRemove && (
            <button
              onClick={() => onRemove(sequence.id)}
              className="text-gray-500 hover:text-purple-500"
              aria-label={t('alignment.removeSequence')}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <textarea
        id={`sequence-textarea-${sequence.id}`}
        value={localContent}
        onChange={(e) => {
          setLocalContent(e.target.value);
          onChange(sequence.id, 'content', e.target.value);
          setValidationError(null);
        }}
        className={`w-full h-24 p-3 border outline-none ring-0 appearance-none
                  bg-neutral-100 dark:bg-neutral-800 rounded-md text-neutral-700 dark:text-neutral-300
                  focus:ring-purple-500 focus:border-purple-500 dark:focus:border-purple-500 dark:focus:ring-purple-500
                  font-mono text-sm resize-none
                  ${validationError ? 'border-red-500 dark:border-red-500' : 'border-neutral-200 dark:border-neutral-700'}`}
        placeholder={t('alignment.sequencePlaceholder')}
        data-sequence-id={sequence.id}
      />

      {validationError && (
        <p className="mt-1 text-xs text-red-500">{validationError}</p>
      )}

      {/* Database search component (conditional) */}
      {showDatabaseSearch && (
        <SequenceDatabaseSearch 
          onSequenceSelected={handleSequenceSelected} 
          inputId={sequence.id} 
        />
      )}

      <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
        <span>{localContent.replace(/\s/g, '').length} {t('translation.characters')}</span>

        <div className="flex space-x-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-purple-600 dark:text-purple-400 hover:underline flex items-center"
          >
            <DocumentArrowUpIcon className="h-3 w-3 mr-1" />
            {t('alignment.uploadFile')}
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
            {t('alignment.paste')}
          </button>

          <button
            onClick={handleClear}
            className="text-purple-600 dark:text-purple-400 hover:underline"
          >
            {t('translation.clearButton')}
          </button>
        </div>
      </div>
    </div>
  );
}