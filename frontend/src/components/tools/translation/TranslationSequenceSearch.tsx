import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import sequenceDatabaseService from '@/services/sequence/sequenceDatabaseService';

interface TranslationSequenceSearchProps {
  onSequenceSelected: (sequence: string, name: string, metadata: any) => void;
  inputId: string;
}

// Database types to search (limited to nucleotide only)
type DatabaseType = 'dna' | 'rna';

interface SearchResult {
  id: string;
  name: string;
  organism: string;
  length: number;
  type: 'dna' | 'rna';
  preview: string;
}

const TranslationSequenceSearch: React.FC<TranslationSequenceSearchProps> = ({ 
  onSequenceSelected, 
  inputId
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [databaseType, setDatabaseType] = useState<DatabaseType>('dna');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Perform search as user types with debounce
  useEffect(() => {
    if (query.length < 3) {
      setResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch();
    }, 300); // 300ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, databaseType]);

  const performSearch = async () => {
    if (query.length < 3) return;
    
    setIsSearching(true);
    setError(null);

    try {
      // Call service to search sequences - we use 'nucleotide' for both DNA and RNA
      const serviceResults = await sequenceDatabaseService.searchSequences(query, 'nucleotide');
      
      // Convert service results to our local SearchResult type and filter by DNA/RNA
      const filteredResults: SearchResult[] = serviceResults
        .filter(result => 
          (databaseType === 'dna' && result.type === 'dna') || 
          (databaseType === 'rna' && result.type === 'rna')
        )
        .map(result => ({
          id: result.id,
          name: result.name,
          organism: result.organism,
          length: result.length,
          type: result.type === 'dna' ? 'dna' : 'rna',
          preview: result.preview
        }));
      
      setResults(filteredResults.slice(0, 5)); // Limit to top 5
    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultSelect = async (result: SearchResult) => {
    try {
      setIsSearching(true);
      
      // Fetch the full sequence - make sure to pass the correct type
      // The service expects 'dna' instead of differentiating between 'dna' and 'rna'
      // So we map our internal type to the service's expected type
      const databaseType = result.type === 'rna' ? 'rna' : 'dna';
      const sequence = await sequenceDatabaseService.fetchSequence(
        result.id, 
        databaseType
      );
      
      // Call the provided callback with the full sequence
      onSequenceSelected(
        sequence,
        result.name,
        {
          id: result.id,
          organism: result.organism,
          type: result.type
        }
      );
      
      // Clear search
      setQuery('');
      setResults([]);
    } catch (err) {
      console.error('Error fetching sequence:', err);
      setError(err instanceof Error ? err.message : 'Failed to retrieve sequence');
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.length >= 3 && !isSearching) {
      performSearch();
    }
  };

  return (
    <div className="mt-2">
      <div className="flex gap-2 mb-2">
        <div className="flex space-x-2">
          <button
            onClick={() => setDatabaseType('dna')}
            className={`px-2 py-1 text-xs rounded-md ${
              databaseType === 'dna' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            DNA
          </button>
          <button
            onClick={() => setDatabaseType('rna')}
            className={`px-2 py-1 text-xs rounded-md ${
              databaseType === 'rna' 
                ? 'bg-purple-600 text-white' 
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            RNA
          </button>
        </div>
      </div>
      
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-4 w-4 text-purple-500" />
          </div>
          <input
            id={`sequence-search-${inputId}`}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('translation.searchPlaceholder') || "Search for DNA/RNA sequences..."}
            className="pl-10 w-full py-2 rounded-md border bg-white dark:bg-neutral-800 border-purple-300 dark:border-purple-700 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            data-sequence-input-id={inputId}
          />
        </div>
        <button
          onClick={performSearch}
          disabled={isSearching || query.length < 3}
          className={`px-3 py-2 rounded-md text-sm font-medium w-full sm:w-auto ${
            isSearching || query.length < 3
              ? 'bg-purple-400 dark:bg-purple-700 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 dark:hover:bg-purple-500'
          } text-white transition-colors`}
        >
          {isSearching ? (
            <ArrowPathIcon className="h-4 w-4 mx-auto sm:mx-0 animate-spin" />
          ) : (
            t('translation.search') || "Search"
          )}
        </button>
      </div>
      
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
      
      {/* Results dropdown */}
      {results.length > 0 && (
        <div className="mt-2 max-h-60 overflow-y-auto rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-neutral-800 shadow-lg z-10">
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {results.map((result) => (
              <li 
                key={result.id} 
                className="p-2 sm:p-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer"
                onClick={() => handleResultSelect(result)}
              >
                <div className="flex flex-col sm:flex-row sm:justify-between">
                  <div className="font-medium text-sm text-purple-600 dark:text-purple-400 truncate">{result.name}</div>
                  <div className="text-xs text-gray-500 mt-1 sm:mt-0">{result.type.toUpperCase()}</div>
                </div>
                <div className="text-xs text-gray-700 dark:text-gray-300 mt-1">{result.organism}</div>
                <div className="flex flex-col sm:flex-row sm:justify-between mt-1">
                  <div className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">{result.preview}...</div>
                  <div className="text-xs text-gray-500 mt-0.5 sm:mt-0">{result.length} bp</div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default TranslationSequenceSearch;