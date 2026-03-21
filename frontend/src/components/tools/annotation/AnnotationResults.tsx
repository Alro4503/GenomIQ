import { useTranslation } from '@/context/TranslationProvider';
import { useEffect, useState } from 'react';
import { AnnotationFeature } from '@/types/annotation';
import SeqVizViewer from './SeqVizViewer';
import FeaturesTable from './FeaturesTable';
import { ArrowPathIcon, TableCellsIcon, ChartBarIcon } from '@heroicons/react/24/outline';

interface AnnotationResultsProps {
  results: AnnotationFeature[] | null;
  isLoading: boolean;
  error: string | null;
  sequenceLength: number;
  sequenceType: 'dna' | 'protein';
  sequence?: string;
}

const AnnotationResults = ({
  results,
  isLoading,
  error,
  sequenceLength,
  sequenceType,
  sequence
}: AnnotationResultsProps) => {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');
  const [featureTypes, setFeatureTypes] = useState<Set<string>>(new Set());
  
  // Extraer tipos de características únicos para la leyenda
  useEffect(() => {
    if (results) {
      const types = new Set<string>();
      results.forEach(result => {
        types.add(result.type);
      });
      setFeatureTypes(types);
    }
  }, [results]);

  // Calcular la longitud efectiva de la secuencia
  const effectiveSequenceLength = sequence?.length || sequenceLength || 
    (results && results.length > 0 ? Math.max(...results.map(f => f.end)) + 10 : 100);
  
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
          {t('annotation.resultsTitle')}
        </h3>
        
        {results && results.length > 0 && (
          <div className="flex bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => setViewMode('visual')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center
                ${viewMode === 'visual' 
                  ? 'bg-white dark:bg-neutral-700 text-gray-800 dark:text-white shadow' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
            >
              <ChartBarIcon className="h-4 w-4 mr-1" />
              {t('annotation.visualView')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center
                ${viewMode === 'table' 
                  ? 'bg-white dark:bg-neutral-700 text-gray-800 dark:text-white shadow' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
            >
              <TableCellsIcon className="h-4 w-4 mr-1" />
              {t('annotation.tableView')}
            </button>
          </div>
        )}
      </div>
      
      <div className="min-h-96">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <ArrowPathIcon className="animate-spin h-10 w-10 mx-auto text-purple-500" />
              <p className="mt-4 text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
            </div>
          </div>
        ) : error ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-lg">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{t('annotation.errorTitle')}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error}</p>
            </div>
          </div>
        ) : !results ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-lg">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{t('annotation.noResultsTitle')}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('annotation.noResultsDesc')}</p>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-lg">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600 dark:text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{t('annotation.noFeaturesTitle')}</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t('annotation.noFeaturesDesc')}</p>
            </div>
          </div>
        ) : (
          <div>
            {viewMode === 'visual' ? (
              <SeqVizViewer
                features={results} 
                sequenceLength={effectiveSequenceLength} 
                sequenceType={sequenceType}
                sequence={sequence}
              />
            ) : (
              <FeaturesTable features={results} />
            )}
          </div>
        )}
      </div>
      
      {results && results.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('annotation.legend')}
          </h4>
          <div className="flex flex-wrap gap-3">
            {Array.from(featureTypes).map(type => {
              // Use purple color for all feature types
              const color = '#9333EA';
              return (
                <div key={type} className="flex items-center">
                  <div 
                    className="w-4 h-4 rounded-sm mr-1" 
                    style={{ backgroundColor: color }}
                  ></div>
                  <span className="text-xs text-gray-700 dark:text-gray-300">
                    {t(`annotation.feature${type.charAt(0).toUpperCase() + type.slice(1)}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {results && results.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('annotation.whatNext')}
          </h4>
          <ul className="text-xs text-gray-600 dark:text-gray-400 list-disc pl-5 space-y-1">
            <li>{t('annotation.nextStep1')}</li>
            <li>{t('annotation.nextStep2')}</li>
            <li>{t('annotation.nextStep3')}</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default AnnotationResults;