import { useState } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { MagnifyingGlassIcon, ArrowPathIcon, CheckCircleIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import sequenceDatabaseService from '@/services/sequence/sequenceDatabaseService';

interface AnnotationSequenceSearchProps {
  onSequenceSelected: (sequence: string, name: string, metadata: any) => void;
  inputId: string;
  sequenceType: 'dna' | 'protein';
}

interface SearchResult {
  id: string;
  name: string;
  organism: string;
  length: number;
  type: 'dna' | 'rna' | 'protein';
  preview: string;
  sequence?: string;
}

const AnnotationSequenceSearch: React.FC<AnnotationSequenceSearchProps> = ({ 
  onSequenceSelected, 
  inputId,
  sequenceType
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Determine the database type based on sequenceType prop
  const databaseType = sequenceType === 'protein' ? 'protein' : 'nucleotide';

  const performSearch = async () => {
    if (query.length < 3) {
      setError('Please enter at least 3 characters to search');
      return;
    }
    
    setIsSearching(true);
    setError(null);
    setResults([]);

    try {
      console.log(`Searching for: "${query}" in ${databaseType} databases`);
      
      const serviceResults = await sequenceDatabaseService.searchSequences(query, databaseType);
      
      // Filter and convert results
      const filteredResults: SearchResult[] = serviceResults
        .filter(result => 
          (sequenceType === 'protein' && result.type === 'protein') || 
          (sequenceType === 'dna' && (result.type === 'dna' || result.type === 'rna'))
        )
        .map(result => ({
          id: result.id,
          name: result.name,
          organism: result.organism,
          length: result.length,
          type: result.type,
          preview: result.preview,
          sequence: result.sequence // Incluir secuencia completa si está disponible
        }));
      
      setResults(filteredResults.slice(0, 10)); // Limit to top 10
      
      if (filteredResults.length === 0) {
        setError('No sequences found matching your search');
      }
      
      console.log(`Search completed: found ${filteredResults.length} results`);
      
    } catch (err) {
      console.error('Search error:', err);
      setError('Search failed. Please try again.');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleResultSelect = async (result: SearchResult) => {
    try {
      setSelectedResult(result);
      setIsLoading(true);
      setError(null);

      let sequence = result.sequence; // Usar secuencia del resultado si está disponible
      
      // Solo hacer fetch si no tenemos la secuencia completa
      if (!sequence) {
        console.log(`No full sequence in search result, attempting to fetch ${result.id}`);
        try {
          sequence = await sequenceDatabaseService.fetchSequence(result.id, result.type);
        } catch (fetchError) {
          console.error('Failed to fetch sequence:', fetchError);
          throw new Error(`Sequence data for "${result.name}" is not available. This may be a metadata-only entry.`);
        }
      } else {
        console.log(`Using full sequence from search results for ${result.id} (${sequence.length} characters)`);
      }

      if (!sequence || sequence.length === 0) {
        throw new Error(`No sequence data available for "${result.name}"`);
      }
      
      console.log(`Successfully got sequence for ${result.id} (${sequence.length} characters)`);
      
      // Call the callback with the sequence
      onSequenceSelected(sequence, result.name, {
        id: result.id,
        organism: result.organism,
        type: result.type
      });
      
      // Clear search after successful selection
      setQuery('');
      setResults([]);
      setSelectedResult(null);
      setError(null);
      
    } catch (err) {
      console.error('Error getting sequence:', err);
      setError(err instanceof Error ? err.message : 'Failed to retrieve sequence');
      setSelectedResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.length >= 3 && !isSearching) {
      performSearch();
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <div className="mt-2">
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
            placeholder={`Search for ${sequenceType === 'protein' ? 'protein' : 'DNA/RNA'} sequences...`}
            className="pl-10 w-full py-2 rounded-md border bg-white dark:bg-neutral-800 border-purple-300 dark:border-purple-700 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            disabled={isSearching}
          />
        </div>
        <button
          onClick={performSearch}
          disabled={isSearching || query.length < 3}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            isSearching || query.length < 3
              ? 'bg-purple-400 dark:bg-purple-700 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 dark:hover:bg-purple-500'
          } text-white transition-colors`}
        >
          {isSearching ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            'Search'
          )}
        </button>
      </div>
      
      {error && (
        <div className="mt-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
            <button
              onClick={clearError}
              className="text-red-400 hover:text-red-600 dark:hover:text-red-300 ml-2"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>
      )}
      
      {/* Database indicators */}
      <div className="mt-2 mb-3 overflow-x-auto">
        <div className="flex space-x-2 flex-nowrap">
          <div className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${databaseType === 'protein' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            UniProt
          </div>
          <div className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${databaseType === 'protein' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            Pfam
          </div>
          <div className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${databaseType === 'nucleotide' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            GenBank
          </div>
          <div className={`px-3 py-1 text-xs rounded-full whitespace-nowrap ${databaseType === 'protein' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}`}>
            Prosite
          </div>
        </div>
      </div>
      
      {/* Loading indicator */}
      {isSearching && (
        <div className="mt-2 flex items-center justify-center py-4 bg-purple-50 dark:bg-purple-900/10 rounded-lg">
          <ArrowPathIcon className="h-5 w-5 animate-spin text-purple-500 mr-2" />
          <span className="text-sm text-purple-600 dark:text-purple-400">
            Searching biological databases...
          </span>
        </div>
      )}
      
      {/* Results */}
      {results.length > 0 && (
        <div className="mt-3 space-y-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Found {results.length} sequences
          </p>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.map((result) => {
              const isCurrentlySelected = selectedResult?.id === result.id;
              const hasFullSequence = !!result.sequence;
              
              return (
                <div 
                  key={result.id} 
                  className={`p-3 border rounded-lg cursor-pointer transition-all
                    ${isCurrentlySelected 
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50 dark:hover:bg-purple-900/10'
                    }`}
                  onClick={() => handleResultSelect(result)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-purple-600 dark:text-purple-400 truncate">
                        {result.name}
                      </div>
                      <div className="text-sm text-gray-700 dark:text-gray-300 truncate">
                        {result.organism}
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <div className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate max-w-[60%]">
                          {result.preview}...
                        </div>
                        <div className="text-xs text-gray-500">
                          {result.length.toLocaleString()} {result.type === 'protein' ? 'aa' : 'bp'}
                        </div>
                      </div>
                      {/* Indicador de disponibilidad de secuencia */}
                      <div className="mt-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          hasFullSequence 
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' 
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
                        }`}>
                          {hasFullSequence ? '✓ Full sequence available' : '⚠ Will attempt fetch'}
                        </span>
                      </div>
                    </div>
                    <div className="ml-2 flex-shrink-0">
                      <div className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                        {result.type.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  
                  {isCurrentlySelected && isLoading && (
                    <div className="mt-2 flex items-center justify-center py-1">
                      <ArrowPathIcon className="h-4 w-4 animate-spin text-purple-500 mr-2" />
                      <span className="text-xs text-purple-600 dark:text-purple-400">
                        {hasFullSequence ? 'Processing sequence...' : 'Fetching sequence...'}
                      </span>
                    </div>
                  )}
                  
                  {isCurrentlySelected && !isLoading && !error && (
                    <div className="mt-2 flex items-center justify-center py-1">
                      <CheckCircleIcon className="h-4 w-4 text-green-500 mr-2" />
                      <span className="text-xs text-green-600 dark:text-green-400">
                        Sequence selected
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* No results message */}
      {!isSearching && query.length >= 3 && results.length === 0 && !error && (
        <div className="mt-3 text-center py-4 text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <MagnifyingGlassIcon className="h-6 w-6 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No sequences found matching your search</p>
          <p className="text-xs mt-1">Try a different search term or use the direct sequence input</p>
        </div>
      )}
    </div>
  );
};

export default AnnotationSequenceSearch;