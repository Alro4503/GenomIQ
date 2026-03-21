import { SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import api from '@/services/api';
import { useTranslation } from '@/context/TranslationProvider';
import { useState } from 'react';
import pdbService from '@/services/visualization/pdbService';

interface AIStructureSearchProps {
  onStructureFound: (pdbData: string, name: string) => void;
  disabled?: boolean;
}

const AIStructureSearch: React.FC<AIStructureSearchProps> = ({ onStructureFound, disabled = false }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    
    setIsSearching(true);
    setError(null);
    setSearchStatus(t('visualization.searchingStructure'));
    
    try {
      // Two-step approach: First use AI to identify the protein, then use direct PDB service
      
      // Step 1: Ask AI to identify the proper protein/structure name or ID
      const response = await api.post('/api/chat/ephemeral', {
        message: `Identifica la proteína o estructura: "${query}". Necesito el nombre científico de la proteína o su identificador UniProt/PDB si lo conoces. Responde SOLO con un objeto JSON con los siguientes campos: {"proteinName": "nombre científico de la proteína", "pdbId": "ID del PDB si lo conoces", "uniprotId": "ID de UniProt si lo conoces"}. No incluyas ningún otro texto aparte del JSON.`,
        tool_context: 'visualization'
      });
      
      // Extract the JSON data from the AI response
      const aiResponse = response.data.message;
      const proteinData = extractJSONFromText(aiResponse);
      
      if (!proteinData) {
        throw new Error(t('visualization.aiResponseError'));
      }
      
      // Step 2: Search PDB database using the identified protein
      setSearchStatus(t('visualization.searchingPDB'));
      
      let pdbResults;
      
      // If AI provided a PDB ID directly, use it
      if (proteinData.pdbId && proteinData.pdbId.length >= 4) {
        try {
          // Try to get the specific PDB by ID
          const { data, title } = await pdbService.getPDBById(proteinData.pdbId);
          
          // Call the callback with the downloaded data
          onStructureFound(data, title || `${proteinData.pdbId} - ${proteinData.proteinName || query}`);
          
          // Clear the query and set success status
          setQuery('');
          setSearchStatus(t('visualization.structureFound'));
          
          // Clear status after a few seconds
          setTimeout(() => {
            setSearchStatus(null);
          }, 3000);
          
          return; // Exit early as we've found the structure
        } catch (pdbError) {
          console.error('Error fetching specific PDB:', pdbError);
          // Continue with search if direct ID lookup fails
        }
      }
      
      // Search using protein name or UniProt ID
      const searchTerm = proteinData.uniprotId || 
                        proteinData.proteinName || 
                        proteinData.pdbId || 
                        query;
      
      pdbResults = await pdbService.searchPDB(searchTerm);
      
      if (pdbResults && pdbResults.length > 0) {
        // Get the first (most relevant) result
        const bestMatch = pdbResults[0];
        
        // Download the PDB file
        setSearchStatus(t('visualization.downloadingStructure'));
        const pdbResponse = await fetch(bestMatch.link);
        
        if (!pdbResponse.ok) {
          throw new Error(`Failed to download PDB file: ${pdbResponse.statusText}`);
        }
        
        const pdbData = await pdbResponse.text();
        
        if (!pdbData || pdbData.length < 100) {
          throw new Error('Downloaded PDB file is empty or invalid');
        }
        
        // Set a descriptive name for the structure
        const structureName = bestMatch.title || 
                             `${bestMatch.pdbId} - ${bestMatch.organism || searchTerm}`;
        
        // Call the callback with the downloaded data
        onStructureFound(pdbData, structureName);
        
        // Clear the query and set success status
        setQuery('');
        setSearchStatus(t('visualization.structureFound'));
        
        // Clear status after a few seconds
        setTimeout(() => {
          setSearchStatus(null);
        }, 3000);
      } else {
        throw new Error(t('visualization.noPDBFound'));
      }
    } catch (err) {
      console.error('Error in AI structure search:', err);
      setError(typeof err === 'string' ? err : 
              err instanceof Error ? err.message : 
              t('visualization.searchError'));
    } finally {
      setIsSearching(false);
    }
  };
  
  // Function to handle direct PDB ID input (when user knows the ID)
  const handleDirectPDBLoad = async (pdbId: string) => {
    if (!pdbId || pdbId.length < 4) return;
    
    setIsSearching(true);
    setError(null);
    setSearchStatus(t('visualization.downloadingStructure'));
    
    try {
      // Fetch PDB directly by ID
      const { data, title } = await pdbService.getPDBById(pdbId);
      
      // Call the callback with the downloaded data
      onStructureFound(data, title || `PDB ${pdbId}`);
      
      // Clear the query and set success status
      setQuery('');
      setSearchStatus(t('visualization.structureFound'));
      
      // Clear status after a few seconds
      setTimeout(() => {
        setSearchStatus(null);
      }, 3000);
    } catch (err) {
      console.error(`Error loading PDB ${pdbId}:`, err);
      setError(t('visualization.pdbDownloadError'));
    } finally {
      setIsSearching(false);
    }
  };

  // Extract JSON from AI response text
  const extractJSONFromText = (text: string): any => {
    try {
      // Try to parse the entire text as JSON first
      return JSON.parse(text);
    } catch (e) {
      // If that fails, try to find JSON using regex
      const jsonMatch = text.match(/\{[\s\S]*?\}/g);
      if (jsonMatch && jsonMatch.length > 0) {
        // Try each matched JSON object until we find a valid one
        for (const potentialJson of jsonMatch) {
          try {
            return JSON.parse(potentialJson);
          } catch (innerError) {
            console.error('Failed to parse specific JSON match:', innerError);
            // Continue to next match
          }
        }
      }
      
      // If all parsing attempts fail, try to extract individual properties
      const properties = {
        proteinName: extractProperty(text, 'proteinName'),
        pdbId: extractProperty(text, 'pdbId'),
        uniprotId: extractProperty(text, 'uniprotId')
      };
      
      // If we extracted at least one property, return the object
      if (properties.proteinName || properties.pdbId || properties.uniprotId) {
        return properties;
      }
      
      // If all attempts fail
      console.error('Failed to extract JSON from AI response');
      return null;
    }
  };
  
  // Helper function to extract a property from text
  const extractProperty = (text: string, propertyName: string): string | null => {
    const regex = new RegExp(`"${propertyName}"\\s*:\\s*"([^"]+)"`, 'i');
    const match = text.match(regex);
    return match ? match[1] : null;
  };

  // Handle Enter key in search field
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && query.trim() && !isSearching && !disabled) {
      // Check if the input looks like a PDB ID (4-5 characters, often in format like "1ABC")
      const pdbIdRegex = /^[0-9][a-zA-Z0-9]{3}$/;
      if (pdbIdRegex.test(query.trim())) {
        handleDirectPDBLoad(query.trim());
      } else {
        handleSearch();
      }
    }
  };

  return (
    <div className="mt-4">
      <h4 className="text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
        {t('visualization.aiStructureSearch')}
      </h4>
      
      <div className="flex gap-2">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SparklesIcon className="h-4 w-4 text-purple-500" />
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('visualization.structureSearchPlaceholder')}
            className={`pl-10 w-full py-2 rounded-md border ${
              isSearching || disabled ? 'bg-gray-100 dark:bg-neutral-700' : 'bg-white dark:bg-neutral-800'
            } border-purple-300 dark:border-purple-700 text-sm text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
            disabled={isSearching || disabled}
          />
        </div>
        <button
          onClick={() => {
            // Check if the input looks like a PDB ID (4-5 characters, often in format like "1ABC")
            const pdbIdRegex = /^[0-9][a-zA-Z0-9]{3}$/;
            if (pdbIdRegex.test(query.trim())) {
              handleDirectPDBLoad(query.trim());
            } else {
              handleSearch();
            }
          }}
          disabled={isSearching || disabled || !query.trim()}
          className={`px-3 py-2 rounded-md text-sm font-medium ${
            isSearching || disabled || !query.trim()
              ? 'bg-purple-400 dark:bg-purple-700 cursor-not-allowed'
              : 'bg-purple-600 hover:bg-purple-700 dark:hover:bg-purple-500'
          } text-white transition-colors`}
        >
          {isSearching ? (
            <ArrowPathIcon className="h-4 w-4 animate-spin" />
          ) : (
            t('visualization.searchButton')
          )}
        </button>
      </div>
      
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
        {t('visualization.searchHelp')}
      </p>
      
      {error && (
        <p className="mt-1 text-xs text-red-500">{error}</p>
      )}
      
      {isSearching && (
        <p className="mt-1 text-xs text-purple-500 animate-pulse">
          {searchStatus || t('visualization.searching')}
        </p>
      )}
      
      {!isSearching && searchStatus && (
        <p className="mt-1 text-xs text-green-500">
          {searchStatus}
        </p>
      )}
    </div>
  );
};

export default AIStructureSearch;