import { useTranslation } from '@/context/TranslationProvider';
import CustomInput from './CustomRadioCheckbox';

interface TranslationOptionsProps {
  sequenceType: 'DNA' | 'RNA';
  readingFrame: number;
  includeAllFrames: boolean;
  onChange: (option: { [key: string]: any }) => void;
  disabled: boolean;
}

const TranslationOptions = ({
  sequenceType,
  readingFrame,
  includeAllFrames,
  onChange,
  disabled
}: TranslationOptionsProps) => {
  const { t } = useTranslation();

  return (
    <div className="mb-4 sm:mb-6 space-y-4 sm:space-y-5">
      <div>
        <label className="block text-sm font-medium mb-2 sm:mb-3 text-gray-700 dark:text-gray-300">
          {t('translation.sequenceTypeLabel')}
        </label>
        <div className="flex space-x-6">
          <CustomInput
            type="radio"
            checked={sequenceType === 'DNA'}
            onChange={() => onChange({ sequenceType: 'DNA' })}
            disabled={disabled}
            label="DNA"
            name="sequenceType"
          />
          <CustomInput
            type="radio"
            checked={sequenceType === 'RNA'}
            onChange={() => onChange({ sequenceType: 'RNA' })}
            disabled={disabled}
            label="RNA"
            name="sequenceType"
          />
        </div>
      </div>

      <div id="reading-frame-container">
        <label className="block text-sm font-medium mb-2 sm:mb-3 text-gray-700 dark:text-gray-300">
          {t('translation.readingFrameLabel')}
        </label>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          {[0, 1, 2].map((frame) => (
            <CustomInput
              key={`frame-${frame}`}
              type="radio"
              checked={readingFrame === frame}
              onChange={() => onChange({ readingFrame: frame })}
              disabled={disabled || includeAllFrames}
              label={`${t('translation.frame')} ${frame + 1}`}
              name="readingFrame"
            />
          ))}
        </div>
      </div>

      <div>
        <CustomInput
          type="checkbox"
          checked={includeAllFrames}
          onChange={() => {
            onChange({ includeAllFrames: !includeAllFrames });
          }}
          disabled={disabled}
          label={t('translation.includeAllFrames')}
        />
      </div>
    </div>
  );
};

export default TranslationOptions;