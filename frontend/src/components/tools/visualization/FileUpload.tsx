import { useTranslation } from '@/context/TranslationProvider';
import { useState, useRef } from 'react';
import { ArrowUpTrayIcon } from '@heroicons/react/24/outline';
import CustomInput from '../translation/CustomRadioCheckbox';
import Button from '@/components/ui/Button';
import AIStructureSearch from './AIStructureSearch';

interface FileUploadProps {
  file: File | null;
  onChange: (file: File | null) => void;
  onPDBDataLoaded: (pdbData: string, name: string) => void;
  isLoading: boolean;
  onSubmit: () => void;
  structureType: 'protein' | 'dna';
  onStructureTypeChange: (type: 'protein' | 'dna') => void;
}

const FileUpload = ({
  file,
  onChange,
  onPDBDataLoaded,
  isLoading,
  onSubmit,
  structureType,
  onStructureTypeChange
}: FileUploadProps) => {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [title, setTitle] = useState('');

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFile = e.dataTransfer.files[0];
      validateAndSetFile(newFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const newFile = e.target.files[0];
      validateAndSetFile(newFile);
    }
  };

  const validateAndSetFile = (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdb')) {
      alert(t('visualization.errorInvalidFile'));
      return;
    }
    
    // Set a default title based on the filename
    const fileName = file.name.replace('.pdb', '');
    setTitle(fileName);
    
    onChange(file);
  };

  const handleButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    onChange(null);
    setTitle('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handle structure found by AI
  const handleStructureFound = (pdbData: string, name: string) => {
    // Set title from the AI result
    setTitle(name);
    
    // Create a File object from the PDB data
    const blob = new Blob([pdbData], { type: 'text/plain' });
    const file = new File([blob], `${name}.pdb`, { type: 'text/plain' });
    
    // Update the file state
    onChange(file);
    
    // Also pass the PDB data directly to skip file reading step
    onPDBDataLoaded(pdbData, name);
  };

  const isVisualizeDisabled = !file || isLoading || !title.trim();

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
      <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white">
        {t('visualization.fileUploadLabel')}
      </h3>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-3 text-gray-700 dark:text-gray-300">
          {t('visualization.structureTypeLabel')}
        </label>
        <div className="flex space-x-6">
          <CustomInput
            type="radio"
            checked={structureType === 'protein'}
            onChange={() => onStructureTypeChange('protein')}
            disabled={isLoading}
            label={t('visualization.typeProtein')}
            name="structureType"
          />
          <CustomInput
            type="radio"
            checked={structureType === 'dna'}
            onChange={() => onStructureTypeChange('dna')}
            disabled={isLoading}
            label={t('visualization.typeDNA')}
            name="structureType"
          />
        </div>
      </div>
      
      {/* AI Structure Search - New Section */}
      <AIStructureSearch 
        onStructureFound={handleStructureFound}
        disabled={isLoading}
      />
      
      <div className="mt-4 flex items-center">
        <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
        <span className="mx-2 text-xs text-gray-500 dark:text-gray-400">{t('common.or')}</span>
        <div className="flex-grow border-t border-gray-300 dark:border-gray-700"></div>
      </div>
      
      {file && (
        <div className="mt-4">
          <label htmlFor="title" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
            {t('visualization.titleLabel')}
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-700 
                      bg-neutral-100 dark:bg-neutral-800 rounded-md 
                      text-neutral-700 dark:text-neutral-300 
                      focus:ring-purple-500 focus:border-purple-500"
            placeholder={t('visualization.titlePlaceholder')}
            disabled={isLoading}
          />
        </div>
      )}
      
      <div
        className={`
          mt-4 relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-all duration-200 ease-in-out
          ${dragActive ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/10' : 'border-gray-300 dark:border-gray-600'}
          ${isLoading ? 'opacity-60 cursor-not-allowed' : 'hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={isLoading ? undefined : handleButtonClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdb"
          onChange={handleFileChange}
          disabled={isLoading}
        />
        
        <div className="space-y-2">
          <ArrowUpTrayIcon className="h-10 w-10 mx-auto text-gray-400 dark:text-gray-500" />
          
          <div className="text-gray-600 dark:text-gray-400">
            {file ? (
              <div className="py-1">
                <p className="font-medium text-purple-600 dark:text-purple-400">{file.name}</p>
                <p className="text-xs">{(file.size / 1024).toFixed(2)} KB</p>
              </div>
            ) : (
              <div>
                <p className="font-medium text-sm">{t('visualization.dragAndDrop')}</p>
                <p className="text-xs">{t('visualization.supportedFormats')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      <div className="mt-4 flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
        <button
          onClick={onSubmit}
          disabled={isVisualizeDisabled}
          className={`px-6 py-2 font-medium rounded-md transition-colors w-full
            ${isVisualizeDisabled 
              ? 'bg-purple-300 dark:bg-purple-800/50 text-gray-100 dark:text-gray-400 opacity-60' 
              : 'bg-purple-600 hover:bg-purple-700 text-white'}`}
        >
          {isLoading ? t('common.loading') : t('visualization.visualizeButton')}
        </button>
        
        {file && (
          <button
            onClick={handleClear}
            disabled={isLoading}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 
                    dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 
                    font-medium rounded-md transition-colors w-full sm:w-auto"
          >
            {t('common.cancel')}
          </button>
        )}
      </div>
    </div>
  );
};

export default FileUpload;