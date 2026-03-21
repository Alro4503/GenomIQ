'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import aiSequenceService from '@/services/sequence/aiSequenceService';
import sequenceRequestManager from '@/services/sequence/sequenceRequestManager';
import React from 'react';

interface AISequenceSearchProps {
  onSequenceFound: (result: { sequence?: string, id?: string, name?: string }) => void;
  inputType: 'id' | 'sequence';
  placeholderText?: string;
  isDisabled?: boolean;
}

// Global tracker for pending requests
const pendingRequests = new Map<string, boolean>();

const AISequenceSearch: React.FC<AISequenceSearchProps> = ({ 
  onSequenceFound, 
  inputType,
  placeholderText,
  isDisabled = false
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [isGlobalSearchActive, setIsGlobalSearchActive] = useState(false);

  // Check periodically if there's a global search active
  useEffect(() => {
    const checkGlobalStatus = () => {
      // Check if any request is active using the request manager
      setIsGlobalSearchActive(sequenceRequestManager.hasActiveRequest());
    };

    // Check immediately
    checkGlobalStatus();

    // Check every 500ms
    const intervalId = setInterval(checkGlobalStatus, 500);

    return () => clearInterval(intervalId);
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    // Check if a search is already active using the request manager
    if (sequenceRequestManager.hasActiveRequest()) {
      setError(t('annotation.waitingForOtherSearch') || 'Please wait for the current search to complete');
      return;
    }
    
    setIsSearching(true);
    setError(null);
    setSearchStatus(t('annotation.askingAI'));
    
    try {
      // Use the dedicated service to search for sequence or ID
      const result = await aiSequenceService.searchSequence(query, inputType);
      
      if (result && (result.sequence || result.id)) {
        console.log(`AISequenceSearch: Found ${inputType === 'id' ? 'ID' : 'sequence'} result`, result);
        
        setSearchStatus(t('annotation.sequenceFound'));
        
        // Call the callback with the result
        onSequenceFound(result);
        
        // Clear the query to allow new search
        setQuery('');
        
        // Set timeout to clear success message
        setTimeout(() => {
          setSearchStatus(null);
        }, 3000);
      } else {
        setError(t('annotation.noResultsFound'));
      }
    } catch (err) {
      console.error(`Error in AI search for ${inputType}:`, err);
      setError(t('annotation.aiSearchError'));
    } finally {
      setIsSearching(false);
    }
  };

  // Handle Enter key in the search field
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim() && !isSearching && !isGlobalSearchActive) {
      handleSearch();
    }
  };

  // Search is blocked if component is searching or a global search is active
  const isSearchBlocked = isSearching || isGlobalSearchActive || isDisabled;

  return (
    <div className="mt-2">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SparklesIcon className="h-4 w-4 text-purple-500" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholderText || t('annotation.aiSearchPlaceholder')}
            className={`pl-10 w-full py-2 rounded-md border ${
              isSearchBlocked ? 'bg-gray-100 dark:bg-neutral-700' : 'bg-white dark:bg-neutral-800'
            } border-purple-300 dark:border-purple-700 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
            data-input-type={inputType}
            disabled={isSearchBlocked}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={isSearchBlocked || !query.trim()}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            isSearchBlocked || !query.trim()
              ? 'bg-purple-400 dark:bg-purple-700 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 dark:hover:bg-purple-500'
          } text-white transition-colors`}
        >
          {isSearching ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            t('annotation.aiSearch')
          )}
        </button>
      </div>
      
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
      
      {isSearching && (
        <p className="mt-1 text-xs text-purple-500 animate-pulse">
          {t('annotation.aiSearching')}
        </p>
      )}
      
      {!isSearching && isGlobalSearchActive && (
        <p className="mt-1 text-xs text-orange-500">
          {t('annotation.waitingForOtherSearch') || 'Please wait for the current search to complete'}
        </p>
      )}
      
      {!isSearching && !isGlobalSearchActive && searchStatus && (
        <p className="mt-1 text-xs text-green-500">
          {searchStatus}
        </p>
      )}
    </div>
  );
};

export default AISequenceSearch;