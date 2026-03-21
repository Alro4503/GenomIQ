'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { CubeIcon } from '@heroicons/react/24/outline';
import dynamic from 'next/dynamic';
import FloatingChat from '@/components/chat/FloatingChat';
import ToolPageWrapper from '@/components/tools/ToolPageWrapper';

// Componentes cargados dinámicamente con ssr: false
const StructureViewer = dynamic(
  () => import('@/components/tools/visualization/StructureViewer'),
  { ssr: false }
);

const VisualizationOptions = dynamic(
  () => import('@/components/tools/visualization/VisualizationOptions'),
  { ssr: false }
);

const VisualizationResults = dynamic(
  () => import('@/components/tools/visualization/VisualizationResults'),
  { ssr: false }
);

// Asegurarse que FileUpload también se carga del lado del cliente
const FileUpload = dynamic(
  () => import('@/components/tools/visualization/FileUpload'),
  { ssr: false }
);

// Componente de contenido principal
const VisualizationContent = () => {
  const { t } = useTranslation();
  const [isMounted, setIsMounted] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pdbData, setPdbData] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [structureType, setStructureType] = useState<'protein' | 'dna'>('protein');
  const [viewerSettings, setViewerSettings] = useState({
    representation: 'cartoon',
    colorScheme: 'chainid',
    backgroundColor: '#ffffff',
    spin: false,
    showLabels: false
  });

  // Contexto de la herramienta para el chat flotante
  const toolContext = {
    name: 'visualization',
    displayName: t('tools.visualization')
  };

  // Esperar a que el componente se monte en el cliente antes de renderizar los componentes dinámicos
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle file change
  const handleFileChange = (newFile: File | null) => {
    setFile(newFile);
    setPdbData(null);
    setError(null);
  };

  // Handle structure type change
  const handleStructureTypeChange = (type: 'protein' | 'dna') => {
    setStructureType(type);
  };

  // Handle settings change
  const handleSettingChange = (setting: string, value: any) => {
    setViewerSettings(prev => ({
      ...prev,
      [setting]: value
    }));
  };
  
  // Handle PDB data loaded directly (from AI search)
  const handlePDBDataLoaded = (data: string, name: string) => {
    setPdbData(data);
    setError(null);
  };

  // Process file
  const processFile = async () => {
    if (!file) {
      setError(t('visualization.errorNoFile'));
      return;
    }

    // If PDB data is already loaded directly from AI, no need to process
    if (pdbData) {
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      // Lee el contenido del archivo como texto
      const content = await file.text();
      
      // Verificar que el contenido parece un archivo PDB válido
      if (!content.includes('ATOM') && !content.includes('HETATM')) {
        throw new Error(t('visualization.errorInvalidPDB'));
      }

      // En lugar de crear un objeto mockData vacío,
      // pasamos directamente el contenido del PDB
      setPdbData(content);
    } catch (err) {
      console.error('Error processing file:', err);
      setError(t('visualization.errorProcessing'));
    } finally {
      setLoading(false);
    }
  };

  // Si aún no está montado, mostrar un estado de carga
  if (!isMounted) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 flex justify-center items-center h-[50vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-2 border-solid border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center mb-2">
          <CubeIcon className="h-8 w-8 text-purple-500 mr-3" />
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            {t('tools.visualization')}
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          {t('tools.visualizationDesc')}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - File Upload & Settings */}
        <div className="lg:col-span-1 space-y-6">
          <FileUpload
            file={file}
            onChange={handleFileChange}
            onPDBDataLoaded={handlePDBDataLoaded}
            isLoading={loading}
            onSubmit={processFile}
            structureType={structureType}
            onStructureTypeChange={handleStructureTypeChange}
          />

          <VisualizationOptions
            settings={viewerSettings}
            onChange={handleSettingChange}
            disabled={loading || !pdbData}
          />
        </div>

        {/* Right Column - Visualization */}
        <div className="lg:col-span-2">
          <VisualizationResults
            pdbData={pdbData}
            settings={viewerSettings}
            isLoading={loading}
            error={error}
          />
        </div>
      </div>

      {/* Chat flotante */}
      <FloatingChat toolContext={toolContext} />
    </div>
  );
};

// Página principal con protección de ruta
export default function VisualizationPage() {
  return (
    <ToolPageWrapper>
      <VisualizationContent />
    </ToolPageWrapper>
  );
}