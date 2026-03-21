'use client';

import React from 'react';
import { useTranslation } from '@/context/TranslationProvider';

const LoadingScreen: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-white dark:bg-neutral-900 z-50">
      <div className="flex flex-col items-center">
        <div className="w-12 h-12 rounded-full animate-spin border-2 border-solid border-[#55A63F] border-t-transparent mb-4"></div>
      </div>
    </div>
  );
};

export default LoadingScreen;