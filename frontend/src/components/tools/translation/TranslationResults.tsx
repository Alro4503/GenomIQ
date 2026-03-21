import { useTranslation } from '@/context/TranslationProvider';
import { useState } from 'react';
import { DocumentDuplicateIcon, CheckIcon } from '@heroicons/react/24/outline';

interface TranslationResultsProps {
  result: string;
}

const TranslationResults = ({ result }: TranslationResultsProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!result) return;
    
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className="h-full bg-white dark:bg-neutral-900 rounded-xl p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all flex flex-col">
      <div className="flex justify-between items-center mb-3 sm:mb-4">
        <h3 className="font-semibold text-base sm:text-lg text-gray-800 dark:text-white">
          {t('translation.resultsTitle')}
        </h3>
        {result && (
          <button
            onClick={handleCopy}
            className="inline-flex items-center text-xs sm:text-sm text-purple-600 hover:text-purple-800 
                     dark:text-purple-400 dark:hover:text-purple-300"
          >
            {copied ? (
              <>
                <CheckIcon className="h-3 sm:h-4 w-3 sm:w-4 mr-1" />
                {t('translation.copied')}
              </>
            ) : (
              <>
                <DocumentDuplicateIcon className="h-3 sm:h-4 w-3 sm:w-4 mr-1" />
                {t('translation.copyResults')}
              </>
            )}
          </button>
        )}
      </div>

      <div className="flex-grow flex flex-col overflow-hidden">
        <div className="flex-grow relative w-full h-0 min-h-[150px] md:min-h-[300px]">
          <pre className="absolute inset-0 p-2 sm:p-3 border border-neutral-200 dark:border-neutral-700 
                        bg-neutral-100 dark:bg-neutral-800 rounded-md text-neutral-700 dark:text-neutral-300
                        font-mono text-xs sm:text-sm overflow-y-auto break-words whitespace-pre-wrap">
            {result || <span className="text-gray-500 dark:text-gray-400 opacity-75">{t('translation.noResults')}</span>}
          </pre>
        </div>
      </div>

      {result && (
        <div className="mt-3 sm:mt-4">
          <h3 className="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">
            {t('translation.legend')}
          </h3>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5 sm:space-y-1">
            <li><span className="font-mono">*</span> - {t('translation.stopCodon')}</li>
            <li><span className="font-mono">M</span> - {t('translation.startCodon')}</li>
            <li><span className="font-mono">X</span> - {t('translation.unknownAminoAcid')}</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default TranslationResults;