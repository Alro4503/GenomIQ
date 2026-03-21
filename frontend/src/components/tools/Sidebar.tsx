'use client';

import { useTranslation } from '@/context/TranslationProvider';
import { useState, useEffect } from 'react';
import { 
  BeakerIcon, 
  ArrowPathIcon, 
  DocumentTextIcon, 
  CubeIcon, 
  TagIcon,
  FunnelIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface SidebarProps {
  categories: string[];
  onCategoryChange: (category: string) => void;
  selectedCategory: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobile?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  categories, 
  onCategoryChange, 
  selectedCategory,
  collapsed = false,
  onToggleCollapse,
  isMobile = false,
  isOpen = true,
  onClose
}) => {
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(collapsed);

  useEffect(() => {
    setIsCollapsed(collapsed);
  }, [collapsed]);

  const handleToggle = () => {
    if (onToggleCollapse) {
      onToggleCollapse();
    } else {
      setIsCollapsed(!isCollapsed);
    }
  };

  const handleCategorySelect = (category: string) => {
    onCategoryChange(category);
    if (isMobile && onClose) {
      onClose();
    }
  };

  // Mapeo de categorías para traducción
  const getCategoryTranslation = (category: string): string => {
    const translationMap: Record<string, string> = {
      'All': 'tools.categories.all',
      'Search': 'tools.categories.search',
      'Analysis': 'tools.categories.analysis',
      'Conversion': 'tools.categories.conversion',
      'Visualization': 'tools.categories.visualization'
    };

    const translationKey = translationMap[category];
    return translationKey ? t(translationKey) || category : category;
  };

  const categoryIcons: Record<string, JSX.Element> = {
    'All': <FunnelIcon className="h-5 w-5" />,
    'Search': <BeakerIcon className="h-5 w-5" />,
    'Analysis': <ArrowPathIcon className="h-5 w-5" />,
    'Conversion': <DocumentTextIcon className="h-5 w-5" />,
    'Visualization': <CubeIcon className="h-5 w-5" />
  };

  if (isMobile && !isOpen) {
    return null;
  }

  // Modificamos las clases del contenedor principal
  const containerClasses = isMobile
    ? "fixed inset-0 z-30 pt-16 md:hidden" // Modal para móvil
    : `h-auto min-h-0 border-r border-gray-200 dark:border-neutral-800 transition-all ${isCollapsed ? 'w-16' : 'w-64'} bg-white dark:bg-neutral-900 flex flex-col hidden md:flex`; // Desktop

  // Clases para el sidebar contenido
  const sidebarClasses = isMobile
    ? "relative w-4/5 max-w-xs bg-white dark:bg-neutral-900 h-[calc(100vh-4rem)] overflow-y-auto"
    : "w-full flex flex-col";

  return (
    <div className={containerClasses}>
      {/* Overlay para móvil */}
      {isMobile && (
        <div 
          className="absolute inset-0 bg-black bg-opacity-50"
          onClick={onClose}
        ></div>
      )}
      
      <div className={sidebarClasses}>
        {/* Cabecera */}
        <div className="p-4 flex items-center justify-between border-b border-gray-200 dark:border-neutral-800">
          {(!isCollapsed || isMobile) && (
            <h2 className="text-xl font-semibold text-purple-600 dark:text-purple-400">
              {t('tools.categoriesName')}
            </h2>
          )}
          {isMobile ? (
            <button 
              onClick={onClose}
              className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-gray-400"
              aria-label={t('common.close') || "Cerrar"}
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          ) : (
            <button 
              onClick={handleToggle}
              className={`p-1 rounded-md hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500 dark:text-gray-400 ${isCollapsed ? 'mx-auto' : ''}`}
              aria-label={isCollapsed ? t('common.expand') || 'Expandir' : t('common.collapse') || 'Colapsar'}
            >
              {isCollapsed ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              )}
            </button>
          )}
        </div>
        
        {/* Lista de categorías */}
        <div className="py-4 px-3">
          <ul className="space-y-2">
            {['All', ...categories].map((category) => (
              <li key={category} className="flex justify-center">
                <button
                  onClick={() => handleCategorySelect(category)}
                  className={`flex items-center justify-center w-full ${isCollapsed && !isMobile ? 'p-2 mx-auto' : 'p-2'} rounded-lg transition-colors
                    ${selectedCategory === category 
                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' 
                      : 'hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-700 dark:text-gray-300'}`}
                >
                  <div className={`flex items-center justify-center ${isCollapsed ? '' : ''}`}>
                    {categoryIcons[category] || <TagIcon className="h-5 w-5" />}
                  </div>
                  {(!isCollapsed || isMobile) && (
                    <span className="ml-3 text-left whitespace-nowrap">
                      {getCategoryTranslation(category)}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;