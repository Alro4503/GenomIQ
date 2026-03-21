'use client';

import React from 'react';
import { useTranslation } from '@/context/TranslationProvider';

const LanguageSwitcher: React.FC = () => {
  const { language, changeLanguage, t } = useTranslation();

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
        {t('common.language')}:
      </span>
      <select
        value={language}
        onChange={(e) => changeLanguage(e.target.value as 'en' | 'es')}
        className="block text-sm rounded-md border-neutral-300 dark:border-neutral-700 
          bg-white dark:bg-neutral-800 text-neutral-900 dark:text-white 
          focus:ring-[#55A63F] focus:border-[#55A63F]"
      >
        <option value="en">{t('common.languageEn')}</option>
        <option value="es">{t('common.languageEs')}</option>
      </select>
    </div>
  );
};

export default LanguageSwitcher;