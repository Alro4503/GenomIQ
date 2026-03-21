import { useTranslation } from '@/context/TranslationProvider';
import CustomInput from '../translation/CustomRadioCheckbox';

interface VisualizationOptionsProps {
  settings: {
    representation: string;
    colorScheme: string;
    backgroundColor: string;
    spin: boolean;
    showLabels: boolean;
  };
  onChange: (setting: string, value: any) => void;
  disabled: boolean;
}

const VisualizationOptions = ({
  settings,
  onChange,
  disabled
}: VisualizationOptionsProps) => {
  const { t } = useTranslation();

  const representations = [
    { value: 'cartoon', label: t('visualization.repCartoon') },
    { value: 'ribbon', label: t('visualization.repRibbon') },
    { value: 'licorice', label: t('visualization.repLicorice') },
    { value: 'ball_and_stick', label: t('visualization.repBallAndStick') },
    { value: 'spacefill', label: t('visualization.repSpacefill') },
    { value: 'backbone', label: t('visualization.repBackbone') }
  ];

  // Enhanced color scheme options
  const colorSchemes = [
    { value: 'chainid', label: t('visualization.colorChain') },
    { value: 'restype', label: t('visualization.colorResidue') },
    { value: 'element', label: t('visualization.colorElement') },
    { value: 'secondary_structure', label: t('visualization.colorStructure') },
    // New color schemes
    { value: 'residueindex', label: t('visualization.colorResidueIndex') },
    { value: 'hydrophobicity', label: t('visualization.colorHydrophobicity') },
    { value: 'electrostatic', label: t('visualization.colorElectrostatic') },
    { value: 'bfactor', label: t('visualization.colorBFactor') },
    { value: 'rainbow', label: t('visualization.colorRainbow') },
    { value: 'spectral', label: t('visualization.colorSpectral') }
  ];

  const backgroundColors = [
    { value: '#ffffff', label: t('visualization.bgWhite') },
    { value: '#000000', label: t('visualization.bgBlack') },
    { value: '#f0f0f0', label: t('visualization.bgGray') }
  ];
  
  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
      <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">
        {t('visualization.optionsTitle')}
      </h3>
      
      <div className="space-y-5">
        {/* Representation */}
        <div>
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('visualization.representationLabel')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {representations.map((rep) => (
              <CustomInput
                key={rep.value}
                type="radio"
                checked={settings.representation === rep.value}
                onChange={() => onChange('representation', rep.value)}
                disabled={disabled}
                label={rep.label}
                name="representation"
              />
            ))}
          </div>
        </div>
        
        {/* Color Scheme */}
        <div>
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('visualization.colorSchemeLabel')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {colorSchemes.map((scheme) => (
              <CustomInput
                key={scheme.value}
                type="radio"
                checked={settings.colorScheme === scheme.value}
                onChange={() => onChange('colorScheme', scheme.value)}
                disabled={disabled}
                label={scheme.label}
                name="colorScheme"
              />
            ))}
          </div>
        </div>
        
        {/* Background Color */}
        <div>
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('visualization.backgroundLabel')}
          </label>
          <div className="flex space-x-4">
            {backgroundColors.map((bg) => (
              <button
                key={bg.value}
                type="button"
                onClick={() => onChange('backgroundColor', bg.value)}
                disabled={disabled}
                className={`
                  w-8 h-8 rounded-full border-2 transition-all
                  ${settings.backgroundColor === bg.value 
                    ? 'border-purple-500 ring-2 ring-purple-200 dark:ring-purple-900' 
                    : 'border-gray-300 dark:border-gray-600'
                  }
                  ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                style={{ backgroundColor: bg.value }}
                aria-label={bg.label}
              />
            ))}
          </div>
        </div>
        
        {/* Additional Options */}
        <div className="pt-2">
          <CustomInput
            type="checkbox"
            checked={settings.spin}
            onChange={() => onChange('spin', !settings.spin)}
            disabled={disabled}
            label={t('visualization.optionSpin')}
          />
        </div>
        
        <div>
          <CustomInput
            type="checkbox"
            checked={settings.showLabels}
            onChange={() => onChange('showLabels', !settings.showLabels)}
            disabled={disabled}
            label={t('visualization.optionLabels')}
          />
        </div>
      </div>
    </div>
  );
};

export default VisualizationOptions;