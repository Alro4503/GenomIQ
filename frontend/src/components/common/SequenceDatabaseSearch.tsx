import { useState, useEffect, useRef } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { MagnifyingGlassIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import sequenceDatabaseService from '@/services/sequence/sequenceDatabaseService';

interface SequenceDatabaseSearchProps {
  onSequenceSelected: (sequence: string, name: string, metadata: any) => void;
  inputId: string;
  toolContext?: string;
}

// Database types to search
type DatabaseType = 'nucleotide' | 'protein' | 'all';

interface SearchResult {
  id: string;
  name: string;
  organism: string;
  length: number;
  type: 'dna' | 'rna' | 'protein';
  preview: string;
}

const SequenceDatabaseSearch: React.FC<SequenceDatabaseSearchProps> = ({ 
  onSequenceSelected, 
  inputId,
  toolContext = 'general'
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [databaseType, setDatabaseType] = useState<DatabaseType>('all');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Ref para el contenedor de resultados para posicionarlo correctamente en móviles
  const resultsContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  // Añadir listener para cerrar los resultados cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsContainerRef.current && 
        !resultsContainerRef.current.contains(event.target as Node) &&
        inputRef.current && 
        !inputRef.current.contains(event.target as Node)
      ) {
        setResults([]);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const performSearch = async () => {
    if (query.length < 3) return;
    
    setIsSearching(true);
    setError(null);

    try {
      const results = await sequenceDatabaseService.searchSequences(query, databaseType);
      
      let filteredResults = results;
      
      if (toolContext === 'blast') {
        console.log(`Using ${toolContext} context to optimize sequence search results`);
      }
      
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
      
      // Fetch the full sequence
      const sequence = await sequenceDatabaseService.fetchSequence(
        result.id, 
        result.type === 'protein' ? 'protein' : 'dna'
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
    <div className="mt-2 relative">
      {/* Database type selector - mejor disposición en móviles */}
      <div className="flex flex-wrap gap-2 mb-2">
        <button
          onClick={() => setDatabaseType('nucleotide')}
          className={`px-2 py-1 text-xs rounded-md ${
            databaseType === 'nucleotide' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          DNA/RNA
        </button>
        <button
          onClick={() => setDatabaseType('protein')}
          className={`px-2 py-1 text-xs rounded-md ${
            databaseType === 'protein' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          {t('alignment.protein')}
        </button>
        <button
          onClick={() => setDatabaseType('all')}
          className={`px-2 py-1 text-xs rounded-md ${
            databaseType === 'all' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
        >
          {t('alignment.allDatabases')}
        </button>
      </div>
      
      {/* Barra de búsqueda - mejor adaptación en móviles */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlassIcon className="h-4 w-4 text-purple-500" />
          </div>
          <input
            ref={inputRef}
            id={`sequence-search-${inputId}`}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('alignment.searchPlaceholder') || 'e.g. BRCA1, insulin, NM_007294, P04637...'}
            className="pl-10 w-full py-2 rounded-md border bg-white dark:bg-neutral-800 border-purple-300 dark:border-purple-700 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            data-sequence-input-id={inputId}
          />
        </div>
        <button
          onClick={performSearch}
          disabled={isSearching || query.length < 3}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            isSearching || query.length < 3
              ? 'bg-purple-400 dark:bg-purple-700 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 dark:hover:bg-purple-500'
          } text-white transition-colors sm:w-auto w-full`}
        >
          {isSearching ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin mx-auto" />
          ) : (
            t('alignment.search')
          )}
        </button>
      </div>
      
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
      
      {/* Results dropdown - mejorado para móviles */}
      {results.length > 0 && (
        <div 
          ref={resultsContainerRef}
          className="mt-2 max-h-60 overflow-y-auto rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-neutral-800 shadow-lg z-10 w-full absolute left-0 right-0"
        >
          <ul className="divide-y divide-gray-200 dark:divide-gray-700">
            {results.map((result) => (
              <li 
                key={result.id} 
                className="p-3 hover:bg-purple-50 dark:hover:bg-purple-900/20 cursor-pointer"
                onClick={() => handleResultSelect(result)}
              >
                <div className="flex flex-wrap justify-between gap-1">
                  <div className="font-medium text-purple-600 dark:text-purple-400 truncate max-w-full sm:max-w-[70%]">
                    {result.name}
                  </div>
                  <div className="text-xs text-gray-500 ml-auto">
                    {result.type.toUpperCase()}
                  </div>
                </div>
                
                <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                  {result.organism}
                </div>
                
                <div className="flex flex-wrap justify-between mt-1 gap-1">
                  <div className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate max-w-[75%]">
                    {result.preview}...
                  </div>
                  <div className="text-xs text-gray-500 ml-auto">
                    {result.length} {result.type === 'protein' ? 'aa' : 'bp'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default SequenceDatabaseSearch;