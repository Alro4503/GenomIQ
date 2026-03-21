'use client';

import { useTranslation } from '@/context/TranslationProvider';
import { useEffect, useState } from 'react';
import ToolCard from '@/components/tools/ToolCard';
import Sidebar from '@/components/tools/Sidebar';
import {
  BeakerIcon,
  ArrowPathIcon,
  DocumentTextIcon,
  CubeIcon,
  TagIcon
} from '@heroicons/react/24/outline';

interface Tool {
  id: string;
  name: string;
  displayName: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  requiresSequence: boolean;
  supportedSequenceTypes: string[];
  url: string;
}

export default function ToolsPage() {
  const { t } = useTranslation();
  const [tools, setTools] = useState<Tool[]>([]);
  const [filteredTools, setFilteredTools] = useState<Tool[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [categories, setCategories] = useState<string[]>([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    // Define bioinformatics tools here directly
    const bioinformaticsTools: Tool[] = [
      {
        id: '1',
        name: 'blast',
        displayName: t('tools.blast') || 'BLAST',
        description: t('tools.blastDesc') || 'Basic Local Alignment Search Tool',
        icon: <BeakerIcon className="h-8 w-8 text-purple-500" />,
        category: 'Search',
        requiresSequence: true,
        supportedSequenceTypes: ['DNA', 'RNA', 'Protein'],
        url: '/tools/blast',
      },
      {
        id: '2',
        name: 'alignment',
        displayName: t('tools.alignment') || 'Sequence Alignment',
        description: t('tools.alignmentDesc') || 'Align multiple sequences',
        icon: <ArrowPathIcon className="h-8 w-8 text-purple-500" />,
        category: 'Analysis',
        requiresSequence: true,
        supportedSequenceTypes: ['DNA', 'RNA', 'Protein'],
        url: '/tools/alignment',
      },
      {
        id: '3',
        name: 'translation',
        displayName: t('tools.translation') || 'Translation',
        description: t('tools.translationDesc') || 'Convert DNA/RNA to protein',
        icon: <DocumentTextIcon className="h-8 w-8 text-purple-500" />,
        category: 'Conversion',
        requiresSequence: true,
        supportedSequenceTypes: ['DNA', 'RNA'],
        url: '/tools/translation',
      },
      {
        id: '4',
        name: 'visualization',
        displayName: t('tools.visualization') || 'Visualization',
        description: t('tools.visualizationDesc') || 'Visualize molecular structures',
        icon: <CubeIcon className="h-8 w-8 text-purple-500" />,
        category: 'Visualization',
        requiresSequence: true,
        supportedSequenceTypes: ['Protein', 'DNA'],
        url: '/tools/visualization',
      },
      {
        id: '5',
        name: 'annotation',
        displayName: t('tools.annotation') || 'Annotation',
        description: t('tools.annotationDesc') || 'Annotate sequences with features',
        icon: <TagIcon className="h-8 w-8 text-purple-500" />,
        category: 'Analysis',
        requiresSequence: true,
        supportedSequenceTypes: ['DNA', 'Protein'],
        url: '/tools/annotation',
      },
    ];

    setTools(bioinformaticsTools);
    
    // Extraer categorías únicas
    const uniqueCategories = Array.from(
      new Set(bioinformaticsTools.map((tool) => tool.category))
    );
    setCategories(uniqueCategories);
    
    // Inicialmente mostrar todas las herramientas
    setFilteredTools(bioinformaticsTools);
  }, [t]);

  // Filtrar herramientas por categoría seleccionada
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    
    if (category === 'All') {
      setFilteredTools(tools);
    } else {
      setFilteredTools(tools.filter(tool => tool.category === category));
    }
  };
  
  // Función para manejar el toggle del sidebar en desktop
  const toggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  // Función para abrir el sidebar en móvil
  const toggleMobileSidebar = () => {
    setMobileSidebarOpen(!mobileSidebarOpen);
  };

  // Función para cerrar el sidebar en móvil
  const closeMobileSidebar = () => {
    setMobileSidebarOpen(false);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar de escritorio */}
      <Sidebar 
        categories={categories} 
        onCategoryChange={handleCategoryChange} 
        selectedCategory={selectedCategory} 
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
      />
      
      {/* Sidebar para móvil */}
      <Sidebar 
        categories={categories} 
        onCategoryChange={handleCategoryChange} 
        selectedCategory={selectedCategory}
        isMobile={true}
        isOpen={mobileSidebarOpen}
        onClose={closeMobileSidebar}
      />
      
      {/* Contenido principal */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Botones de control en móvil */}
        <div className="md:hidden fixed top-20 left-4 z-20 flex space-x-2">
          <button
            onClick={toggleMobileSidebar}
            className="p-2 rounded-full hover:bg-white dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-md"
            aria-label={t('tools.expandSidebar')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
        
        <div className="px-6 py-8 mx-auto max-w-7xl w-full flex-grow">
          <h1 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white md:mt-0 mt-10">
            {selectedCategory === 'All' 
              ? t('tools.title') || 'All Tools'
              : `${selectedCategory} ${t('tools.tools') || 'Tools'}`}
          </h1>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTools.map((tool) => (
              <div key={tool.id} className="h-full flex">
                <ToolCard tool={tool} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}