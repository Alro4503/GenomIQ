import { useTranslation } from '@/context/TranslationProvider';
import { AnnotationSettings } from '@/types/annotation';
import { 
  BeakerIcon, 
  CubeIcon, 
  TagIcon, 
  CodeBracketIcon,
  Square3Stack3DIcon,
  PuzzlePieceIcon,
  AdjustmentsHorizontalIcon,
  VariableIcon
} from '@heroicons/react/24/outline';

interface AnnotationOptionsProps {
  settings: AnnotationSettings;
  onChange: (setting: string, value: any) => void;
  disabled: boolean;
}

const AnnotationOptions = ({
  settings,
  onChange,
  disabled
}: AnnotationOptionsProps) => {
  const { t } = useTranslation();

  // Define databases with their colors - all purple now
  const databases = [
    { value: 'uniprot', label: 'UniProt', description: t('annotation.uniprotDesc'), color: '#9333EA', icon: CubeIcon },
    { value: 'pfam', label: 'Pfam', description: t('annotation.pfamDesc'), color: '#9333EA', icon: BeakerIcon },
    { value: 'prosite', label: 'Prosite', description: t('annotation.prositeDesc'), color: '#9333EA', icon: TagIcon },
    { value: 'genbank', label: 'GenBank', description: t('annotation.genbankDesc'), color: '#9333EA', icon: CodeBracketIcon },
  ];

  // Define feature types with icons
  const featureTypes = [
    { id: 'domains', label: t('annotation.featureDomains'), color: '#9333EA', icon: Square3Stack3DIcon },
    { id: 'motifs', label: t('annotation.featureMotifs'), color: '#9333EA', icon: PuzzlePieceIcon },
    { id: 'modifications', label: t('annotation.featureModifications'), color: '#9333EA', icon: AdjustmentsHorizontalIcon },
    { id: 'variants', label: t('annotation.featureVariants'), color: '#9333EA', icon: VariableIcon },
  ];

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 sm:p-5 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
      <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">
        {t('annotation.optionsTitle')}
      </h3>
      
      <div className="space-y-5">
        {/* Sequence Type */}
        <div>
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('annotation.sequenceTypeLabel')}
          </label>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            <div 
              className={`
                p-2 sm:p-3 border rounded-lg transition-all cursor-pointer text-sm sm:text-base
                ${settings.sequenceType === 'protein' 
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/20'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onClick={() => !disabled && onChange('sequenceType', 'protein')}
            >
              <div className="flex items-center">
                <label className="block font-medium text-gray-700 dark:text-gray-300">
                  {t('annotation.typeProtein')}
                </label>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('annotation.typeProteinDesc') || 'Amino acid sequence (UniProt, Pfam, etc.)'}
              </p>
            </div>
            
            <div 
              className={`
                p-2 sm:p-3 border rounded-lg transition-all cursor-pointer text-sm sm:text-base
                ${settings.sequenceType === 'dna' 
                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/20'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
              onClick={() => !disabled && onChange('sequenceType', 'dna')}
            >
              <div className="flex items-center">
                <label className="block font-medium text-gray-700 dark:text-gray-300">
                  {t('annotation.typeDNA')}
                </label>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t('annotation.typeDNADesc') || 'Nucleotide sequence (GenBank, etc.)'}
              </p>
            </div>
          </div>
        </div>
        
        {/* Database Selection */}
        <div>
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('annotation.databaseLabel')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {databases.map((db) => {
              // Disable incompatible databases based on sequence type
              const isCompatible = (settings.sequenceType === 'protein' && db.value !== 'genbank') || 
                                    (settings.sequenceType === 'dna' && db.value === 'genbank');
              
              return (
                <div 
                  key={db.value}
                  className={`
                    p-2 sm:p-3 border rounded-lg transition-all text-sm sm:text-base
                    ${!isCompatible || disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}
                    ${settings.database === db.value 
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' 
                      : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/20'}
                  `}
                  onClick={() => !disabled && isCompatible && onChange('database', db.value)}
                >
                  <div className="flex items-center">
                    <db.icon className="h-4 w-4 mr-2" style={{ color: '#9333EA' }} />
                    <label className="block font-medium text-gray-700 dark:text-gray-300">
                      {db.label}
                    </label>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 ml-6">
                    {db.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Feature Type Filters */}
        <div>
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('annotation.showFeaturesLabel')}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {featureTypes.map((feature) => (
              <div 
                key={feature.id}
                className={`
                  p-2 sm:p-3 border rounded-lg transition-all cursor-pointer text-sm sm:text-base
                  ${settings.showFeatures[feature.id as keyof typeof settings.showFeatures] 
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' 
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300 dark:hover:border-purple-600 hover:bg-purple-50/20'}
                  ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                onClick={() => !disabled && onChange(`showFeatures.${feature.id}`, !settings.showFeatures[feature.id as keyof typeof settings.showFeatures])}
              >
                <div className="flex items-center">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={settings.showFeatures[feature.id as keyof typeof settings.showFeatures]}
                      onChange={() => onChange(`showFeatures.${feature.id}`, !settings.showFeatures[feature.id as keyof typeof settings.showFeatures])}
                      disabled={disabled}
                      className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                      style={{ accentColor: '#9333EA' }}
                    />
                  </div>
                  <feature.icon className="h-4 w-4 ml-2" style={{ color: '#9333EA' }} />
                  <label className="ml-2 block font-medium text-gray-700 dark:text-gray-300">
                    {feature.label}
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnotationOptions;