import { useTranslation } from '@/context/TranslationProvider';
import { useState, useEffect } from 'react';
import CustomInput from '../translation/CustomRadioCheckbox';
import { 
  BlastProgram, 
  BlastProgramInfo, 
  BlastDatabase, 
  BlastDatabaseInfo, 
  getCompatibleDatabases,
  isCompatible
} from '@/types/blast';

interface BlastOptionsProps {
  options: {
    program: BlastProgram;
    database: BlastDatabase;
    evalue: number;
    maxHits: number;
    useRemoteApi: boolean;
  };
  onChange: (key: string, value: any) => void;
  disabled: boolean;
}

const BlastOptions = ({
  options,
  onChange,
  disabled
}: BlastOptionsProps) => {
  const { t } = useTranslation();
  const [compatibleDatabases, setCompatibleDatabases] = useState<BlastDatabase[]>([]);

  // Actualizar bases de datos compatibles cuando cambia el programa
  useEffect(() => {
    const databases = getCompatibleDatabases(options.program);
    setCompatibleDatabases(databases);
    
    // Si la base de datos actual no es compatible, cambiar a la primera compatible
    if (!isCompatible(options.program, options.database) && databases.length > 0) {
      onChange('database', databases[0]);
    }
  }, [options.program]);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
      <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">
        {t('blast.optionsTitle')}
      </h3>
      
      <div className="space-y-5">
        {/* Programa BLAST */}
        <div>
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('blast.programLabel')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(BlastProgramInfo).map(([program, info]) => (
              <CustomInput
                key={program}
                type="radio"
                checked={options.program === program}
                onChange={() => onChange('program', program)}
                disabled={disabled}
                label={`${info.name}: ${info.description}`}
                name="blastProgram"
              />
            ))}
          </div>
        </div>
        
        {/* Base de datos */}
        <div>
          <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
            {t('blast.databaseLabel')}
          </label>
          <div className="grid grid-cols-2 gap-3">
            {compatibleDatabases.map(db => (
              <CustomInput
                key={db}
                type="radio"
                checked={options.database === db}
                onChange={() => onChange('database', db)}
                disabled={disabled}
                label={BlastDatabaseInfo[db].name}
                name="blastDatabase"
              />
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {BlastDatabaseInfo[options.database]?.description}
          </p>
        </div>
        
        {/* Valor E */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('blast.evalueLabel')}
          </label>
          <select
            value={options.evalue}
            onChange={(e) => onChange('evalue', parseFloat(e.target.value))}
            disabled={disabled}
            className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 
                     bg-neutral-100 dark:bg-neutral-800 rounded-md 
                     text-neutral-700 dark:text-neutral-300 
                     focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="10">10</option>
            <option value="1">1</option>
            <option value="0.1">0.1</option>
            <option value="0.01">0.01</option>
            <option value="0.001">0.001</option>
            <option value="0.0001">0.0001</option>
            <option value="0.00001">0.00001</option>
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {t('blast.evalueDescription')}
          </p>
        </div>
        
        {/* Número máximo de hits */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            {t('blast.maxHitsLabel')}
          </label>
          <select
            value={options.maxHits}
            onChange={(e) => onChange('maxHits', parseInt(e.target.value))}
            disabled={disabled}
            className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 
                     bg-neutral-100 dark:bg-neutral-800 rounded-md 
                     text-neutral-700 dark:text-neutral-300 
                     focus:ring-purple-500 focus:border-purple-500"
          >
            <option value="10">10</option>
            <option value="25">25</option>
            <option value="50">50</option>
            <option value="100">100</option>
            <option value="250">250</option>
            <option value="500">500</option>
          </select>
        </div>
        
        {/* Opción de API remota */}
        <div className="pt-2">
          <CustomInput
            type="checkbox"
            checked={options.useRemoteApi}
            onChange={() => onChange('useRemoteApi', !options.useRemoteApi)}
            disabled={disabled}
            label={t('blast.useRemoteApi')}
          />
          <p className="mt-1 ml-6 text-xs text-gray-500 dark:text-gray-400">
            {t('blast.remoteApiDescription')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default BlastOptions;