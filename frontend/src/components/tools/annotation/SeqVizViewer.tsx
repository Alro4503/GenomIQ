import { useTranslation } from '@/context/TranslationProvider';
import { useEffect, useState, useRef } from 'react';
import { AnnotationFeature } from '@/types/annotation';
import SeqViz from 'seqviz';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface SeqVizViewerProps {
  features: AnnotationFeature[];
  sequenceLength: number;
  sequenceType: 'dna' | 'protein';
  sequence?: string;
}

// Convert our annotations to SeqViz expected format
const convertToSeqVizAnnotation = (feature: AnnotationFeature) => {
  return {
    name: feature.name,
    start: feature.start,
    end: feature.end,
    direction: 1, // Default direction (forward)
    color: feature.color || undefined,
    // Additional metadata
    type: feature.type,
    ...(feature.description && { description: feature.description }),
    ...(feature.score !== undefined && { score: feature.score }),
    ...(feature.source && { source: feature.source })
  };
};

// Color palette for different feature types
const featureTypeColors = {
  domain: '#3B82F6',    // Blue
  motif: '#EF4444',     // Red
  modification: '#10B981', // Green
  variant: '#F59E0B'    // Amber
};

const SeqVizViewer: React.FC<SeqVizViewerProps> = ({
  features,
  sequenceLength,
  sequenceType,
  sequence
}) => {
  const { t } = useTranslation();
  const [showCircular, setShowCircular] = useState<boolean>(false);
  const [showLinear, setShowLinear] = useState<boolean>(true);
  const [seqVizAnnotations, setSeqVizAnnotations] = useState<any[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Generate a placeholder sequence if none is provided
  const getSequence = () => {
    if (sequence) return sequence;
    
    // Create a sample sequence based on type and length
    const template = sequenceType === 'protein' 
      ? 'ACDEFGHIKLMNPQRSTVWY'  // 20 standard amino acids
      : 'ACGT';  // 4 standard nucleotides
    
    let result = '';
    const length = sequenceLength > 0 ? sequenceLength : 100;
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * template.length);
      result += template[randomIndex];
    }
    
    return result;
  };
  
  // Change default view based on screen size
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        // On mobile, default to linear view only
        setShowCircular(false);
        setShowLinear(true);
      } else {
        // On larger screens, we could show both
        setShowCircular(true);
        setShowLinear(true);
      }
    };
    
    // Set initial state
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Ensure we have a valid sequence
  const sequenceStr = getSequence();
  
  // Apply colors based on feature type and convert to SeqViz format
  useEffect(() => {
    if (features && features.length > 0) {
      // Apply colors based on feature type if not already assigned
      const coloredFeatures = features.map(feature => ({
        ...feature,
        color: feature.color || featureTypeColors[feature.type] || '#9333EA' // Default to purple if type not found
      }));
      
      const annotations = coloredFeatures.map(convertToSeqVizAnnotation);
      setSeqVizAnnotations(annotations);
    }
  }, [features]);
  
  // Display both viewers if there's no preference indicated
  const isCircularVisible = showCircular;
  const isLinearVisible = showLinear;
  
  // Toggle view modes
  const toggleCircular = () => setShowCircular(!showCircular);
  const toggleLinear = () => setShowLinear(!showLinear);

  // Render error message if no sequence
  if (!sequenceStr) {
    return (
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        <div className="bg-gray-50 dark:bg-neutral-800 p-3">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {t('annotation.visualizationError') || 'Visualization Error'}
          </h4>
        </div>
        <div className="p-6 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            {t('annotation.noSequenceData') || 'No sequence data available for visualization.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-neutral-800 p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {sequenceType === 'protein' ? t('annotation.proteinVisualization') : t('annotation.dnaVisualization')}
        </h4>
        
        <div className="flex space-x-3">
          <button
            onClick={toggleCircular}
            className={`px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors
              ${showCircular 
                ? 'bg-purple-600 text-white' 
                : 'bg-white dark:bg-neutral-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600'}`}
          >
            {t('annotation.circularView') || 'Circular View'}
          </button>
          
          <button
            onClick={toggleLinear}
            className={`px-2.5 py-1.5 text-sm font-medium rounded-md transition-colors
              ${showLinear 
                ? 'bg-purple-600 text-white' 
                : 'bg-white dark:bg-neutral-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600'}`}
          >
            {t('annotation.linearView') || 'Linear View'}
          </button>
        </div>
      </div>
      
      <div 
        className={`${!isCircularVisible && !isLinearVisible ? 'h-20 flex items-center justify-center' : ''}`}
        ref={containerRef}
      >
        {!isCircularVisible && !isLinearVisible ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            {t('annotation.selectViewMode') || 'Please select at least one view mode.'}
          </p>
        ) : (
          <div className="w-full" style={{ height: '350px', minHeight: '300px', overflow: 'hidden' }}>
            <SeqViz
              name={sequenceType === 'protein' ? 'Protein Sequence' : 'DNA Sequence'}
              seq={sequenceStr}
              annotations={seqVizAnnotations}
              viewer={isCircularVisible && isLinearVisible ? 'both' : isCircularVisible ? 'circular' : 'linear'}
              showComplement={sequenceType === 'dna'}
              style={{ height: '100%', width: '100%' }}
              zoom={{
                linear: 0.5, // Slightly more zoomed out for mobile
                circular: 0.6
              }}
              colors={[
                '#3B82F6', // Blue
                '#EF4444', // Red
                '#10B981', // Green
                '#F59E0B', // Amber
                '#6366F1', // Indigo
                '#EC4899', // Pink
                '#14B8A6', // Teal
                '#F97316', // Orange
                '#8B5CF6', // Violet
                '#9333EA'  // Purple
              ]}
              onSelection={(selection) => {
                console.log('Selection:', selection);
                // You can expand this to handle selection events
              }}
            />
          </div>
        )}
      </div>
      
      <div className="p-3 bg-gray-50 dark:bg-neutral-800 border-t border-gray-200 dark:border-gray-700 flex items-start sm:items-center text-xs text-gray-500 dark:text-gray-400">
        <InformationCircleIcon className="h-4 w-4 mr-1 flex-shrink-0 mt-0.5 sm:mt-0" />
        <p>
          {t('annotation.seqvizHelp') || 'Hover over features to see details. Use the mouse wheel to zoom in/out. Click and drag to select regions.'}
        </p>
      </div>
    </div>
  );
};

export default SeqVizViewer;