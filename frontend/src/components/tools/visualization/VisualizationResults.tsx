import { useTranslation } from '@/context/TranslationProvider';
import StructureViewer from './StructureViewer';

interface VisualizationResultsProps {
  pdbData: string | null;
  settings: {
    representation: string;
    colorScheme: string;
    backgroundColor: string;
    spin: boolean;
    showLabels: boolean;
  };
  isLoading: boolean;
  error: string | null;
}

const VisualizationResults = ({
  pdbData,
  settings,
  isLoading,
  error
}: VisualizationResultsProps) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all h-full">
      <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">
        {t('visualization.resultsTitle')}
      </h3>
      
      <div className="min-h-96 flex items-center justify-center">
        {isLoading ? (
          <div className="text-center p-6">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-purple-500 border-r-transparent mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              {t('visualization.loading')}
            </p>
          </div>
        ) : error ? (
          <div className="text-center p-6 text-red-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{error}</p>
          </div>
        ) : !pdbData ? (
          <div className="text-center p-6 text-gray-500 dark:text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p>{t('visualization.noResults')}</p>
          </div>
        ) : (
          <div className="w-full h-full">
            <StructureViewer pdbData={pdbData} settings={settings} />
          </div>
        )}
      </div>
      
      {pdbData && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {t('visualization.controls')}
          </h4>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <li>{t('visualization.controlRotate')}</li>
            <li>{t('visualization.controlZoom')}</li>
            <li>{t('visualization.controlPan')}</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default VisualizationResults;