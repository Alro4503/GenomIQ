import React from 'react';
import { useTranslation } from '@/context/TranslationProvider';

interface LoadingProps {
  step: 'loading' | 'aligning' | 'processing';
  method: string;
}

const AlignmentLoading: React.FC<LoadingProps> = ({ step, method }) => {
  const { t } = useTranslation();
  
  // Determine the loading message based on the current step
  const getMessage = () => {
    switch (step) {
      case 'loading':
        return t('alignment.loadingModules', { method: method.toUpperCase() });
      case 'aligning':
        return t('alignment.performingAlignment', { method: method.toUpperCase() });
      case 'processing':
        return t('alignment.processingResults');
      default:
        return t('alignment.working');
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center p-4 sm:p-8">
      <div className="relative w-16 h-16 mb-4">
        {/* DNA helix animation with purple styling */}
        <div className="absolute w-full h-full border-t-4 border-purple-500 rounded-full animate-spin"></div>
        <div className="absolute w-full h-full border-l-4 border-purple-300 rounded-full animate-spin" style={{ animationDuration: '1.5s' }}></div>
      </div>
      
      <div className="text-center">
        <p className="font-medium text-gray-700 dark:text-gray-300 mb-2">
          {getMessage()}
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {t('alignment.patience')}
        </p>
      </div>
      
      {/* Progress steps - más responsivo con mejor espaciado en móviles */}
      <div className="flex flex-wrap justify-center items-center mt-6 px-2 w-full">
        <Step
          active={step === 'loading'}
          completed={step === 'aligning' || step === 'processing'}
          label={t('alignment.stepLoading')}
        />
        <div className="w-4 sm:w-8 h-0.5 mx-1 bg-gray-200 dark:bg-gray-700"></div>
        <Step
          active={step === 'aligning'}
          completed={step === 'processing'}
          label={t('alignment.stepAligning')}
        />
        <div className="w-4 sm:w-8 h-0.5 mx-1 bg-gray-200 dark:bg-gray-700"></div>
        <Step
          active={step === 'processing'}
          completed={false}
          label={t('alignment.stepProcessing')}
        />
      </div>
    </div>
  );
};

interface StepProps {
  active: boolean;
  completed: boolean;
  label: string;
}

const Step: React.FC<StepProps> = ({ active, completed, label }) => {
  return (
    <div className="flex flex-col items-center my-1">
      <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center 
        ${active ? 'bg-purple-500 text-white' : 
          completed ? 'bg-purple-600 text-white' : 
          'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'}`}>
        {completed ? (
          <svg className="w-3 h-3 sm:w-5 sm:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span>{active ? '•••' : ''}</span>
        )}
      </div>
      <span className={`text-xs mt-1 ${active ? 'text-purple-600 dark:text-purple-400 font-medium' : 
        'text-gray-500 dark:text-gray-400'}`}>
        {label}
      </span>
    </div>
  );
};

export default AlignmentLoading;