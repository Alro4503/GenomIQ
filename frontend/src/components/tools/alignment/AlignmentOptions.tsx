import { useTranslation } from '@/context/TranslationProvider';
import { AlignmentParams } from '@/types/alignment';
import { useState } from 'react';
import CustomInput from '@/components/tools/translation/CustomRadioCheckbox';

interface AlignmentOptionsProps {
  params: AlignmentParams;
  onChange: (params: AlignmentParams) => void;
}

const AlignmentOptions = ({ params, onChange }: AlignmentOptionsProps) => {
  const { t } = useTranslation();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleParamChange = (param: keyof AlignmentParams, value: any) => {
    onChange({
      ...params,
      [param]: value
    });
  };

  const algorithms = [
    { value: 'clustal', label: t('alignment.clustal') },
    { value: 'muscle', label: t('alignment.muscle') },
    { value: 'mafft', label: t('alignment.mafft') }
  ];

  const substitutionMatrices = [
    { value: 'BLOSUM62', label: 'BLOSUM62' },
    { value: 'BLOSUM45', label: 'BLOSUM45' },
    { value: 'BLOSUM80', label: 'BLOSUM80' },
    { value: 'PAM250', label: 'PAM250' },
    { value: 'PAM30', label: 'PAM30' }
  ];

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
      <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">
        {t('alignment.alignmentOptions')}
      </h3>
      
      <div className="space-y-5">
        {/* Alignment Method */}
        <div>
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('alignment.methodLabel')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
            {algorithms.map((algorithm) => (
              <CustomInput
                key={algorithm.value}
                type="radio"
                checked={params.method === algorithm.value}
                onChange={() => handleParamChange('method', algorithm.value)}
                label={algorithm.label}
                name="alignmentMethod"
              />
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-purple-600 dark:text-purple-400 hover:underline flex items-center"
        >
          {showAdvanced ? t('alignment.hideAdvanced') : t('alignment.showAdvanced')}
          <svg
            className={`ml-1 h-4 w-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        
        {showAdvanced && (
          <>
            {/* Substitution Matrix */}
            <div>
              <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
                {t('alignment.matrixLabel')}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                {substitutionMatrices.map((matrix) => (
                  <CustomInput
                    key={matrix.value}
                    type="radio"
                    checked={params.substitutionMatrix === matrix.value}
                    onChange={() => handleParamChange('substitutionMatrix', matrix.value)}
                    label={matrix.label}
                    name="substitutionMatrix"
                  />
                ))}
              </div>
            </div>
            
            {/* Gap Open Penalty */}
            <div>
              <label htmlFor="gapOpenPenalty" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                {t('alignment.gapOpenPenaltyLabel')} ({params.gapOpenPenalty})
              </label>
              <input
                id="gapOpenPenalty"
                type="range"
                min="1"
                max="20"
                step="0.5"
                value={params.gapOpenPenalty}
                onChange={(e) => handleParamChange('gapOpenPenalty', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
                style={{ color: "#8B5CF6" }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1</span>
                <span>20</span>
              </div>
            </div>
            
            {/* Gap Extension Penalty */}
            <div>
              <label htmlFor="gapExtensionPenalty" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                {t('alignment.gapExtPenaltyLabel')} ({params.gapExtensionPenalty})
              </label>
              <input
                id="gapExtensionPenalty"
                type="range"
                min="0.1"
                max="5"
                step="0.1"
                value={params.gapExtensionPenalty}
                onChange={(e) => handleParamChange('gapExtensionPenalty', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-50"
                style={{ color: "#8B5CF6" }}
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.1</span>
                <span>5</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AlignmentOptions;