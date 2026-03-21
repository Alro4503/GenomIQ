import React, { useRef, useEffect, useState } from 'react';
import { useTranslation } from '@/context/TranslationProvider';

interface SynchronizedSequenceViewProps {
  sequences: Array<{name: string, content: string}>;
  consensusSequence?: string;
}

const SynchronizedSequenceView: React.FC<SynchronizedSequenceViewProps> = ({ 
  sequences,
  consensusSequence
}) => {
  const { t } = useTranslation();
  const containerRef = useRef<HTMLDivElement>(null);
  const sequenceRefs = useRef<Array<HTMLDivElement | null>>([]);
  const positionMarkerRef = useRef<HTMLDivElement>(null);
  const scrolling = useRef(false);
  const [scrollPosition, setScrollPosition] = useState(0);
  const [maxScroll, setMaxScroll] = useState(0);
  const [showControls, setShowControls] = useState(false);

  // Inicializar el array de refs para cada secuencia
  useEffect(() => {
    // Crear un array del tamaño adecuado para todas las secuencias + consenso
    sequenceRefs.current = Array(sequences.length + (consensusSequence ? 1 : 0)).fill(null);
  }, [sequences.length, consensusSequence]);

  // Calcular el ancho máximo de desplazamiento
  useEffect(() => {
    if (sequences.length === 0 || !containerRef.current) return;
    
    // Encontrar el contenedor de secuencia y calcular el ancho
    const container = sequenceRefs.current[0]?.parentElement;
    if (!container) return;
    
    const containerWidth = container.clientWidth - 200; // Restar el ancho del nombre
    const sequenceWidth = sequences[0].content.length * 16; // Estimar ancho basado en el número de caracteres
    const newMaxScroll = Math.max(0, sequenceWidth - containerWidth + 40); // Añadir padding
    
    setMaxScroll(newMaxScroll);
    setShowControls(newMaxScroll > 0);
  }, [sequences]);

  // Función para sincronizar el desplazamiento
  const synchronizeScroll = (scrollLeft: number) => {
    if (scrolling.current) return;
    
    scrolling.current = true;
    
    // Actualizar todos los contenedores de secuencias
    sequenceRefs.current.forEach(ref => {
      if (ref) {
        ref.scrollLeft = scrollLeft;
      }
    });
    
    // Actualizar los marcadores de posición si existen
    if (positionMarkerRef.current) {
      positionMarkerRef.current.scrollLeft = scrollLeft;
    }
    
    // Actualizar la posición de desplazamiento para el slider
    setScrollPosition(scrollLeft);
    
    scrolling.current = false;
  };

  // Manejar eventos de desplazamiento desde cualquier contenedor de secuencia
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (scrolling.current) return;
    synchronizeScroll(e.currentTarget.scrollLeft);
  };

  // Manejar el control de desplazamiento maestro
  const handleMasterScroll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPosition = parseInt(e.target.value, 10);
    synchronizeScroll(newPosition);
  };

  // Botones de navegación de salto
  const jump = (direction: 'left' | 'right') => {
    const jumpAmount = 200; // Píxeles a saltar
    const newPosition = direction === 'left' 
      ? Math.max(0, scrollPosition - jumpAmount)
      : Math.min(maxScroll, scrollPosition + jumpAmount);
    
    synchronizeScroll(newPosition);
  };

  // Función para colorear la secuencia según las propiedades de los aminoácidos
  const renderColoredSequence = (sequence: string) => {
    const colorMap: Record<string, string> = {
      // Hidrofílicos
      'R': 'bg-blue-200 dark:bg-blue-800/50',
      'K': 'bg-blue-200 dark:bg-blue-800/50',
      'D': 'bg-blue-200 dark:bg-blue-800/50',
      'E': 'bg-blue-200 dark:bg-blue-800/50',
      'N': 'bg-blue-200 dark:bg-blue-800/50',
      'Q': 'bg-blue-200 dark:bg-blue-800/50',
      'S': 'bg-blue-200 dark:bg-blue-800/50',
      'T': 'bg-blue-200 dark:bg-blue-800/50',
      'H': 'bg-blue-200 dark:bg-blue-800/50',

      // Hidrofóbicos
      'A': 'bg-red-200 dark:bg-red-800/50',
      'V': 'bg-red-200 dark:bg-red-800/50',
      'L': 'bg-red-200 dark:bg-red-800/50',
      'I': 'bg-red-200 dark:bg-red-800/50',
      'M': 'bg-red-200 dark:bg-red-800/50',
      'G': 'bg-red-200 dark:bg-red-800/50',

      // Aromáticos
      'F': 'bg-purple-200 dark:bg-purple-800/50',
      'Y': 'bg-purple-200 dark:bg-purple-800/50',
      'W': 'bg-purple-200 dark:bg-purple-800/50',

      // Especiales
      'C': 'bg-purple-200 dark:bg-purple-800/50',
      'P': 'bg-purple-200 dark:bg-purple-800/50',
      '-': 'bg-gray-200 dark:bg-gray-700/50',
    };

    return (
      <div className="whitespace-nowrap">
        {Array.from(sequence).map((char, index) => (
          <span
            key={index}
            className={`inline-block text-center w-4 ${colorMap[char] || ''}`}
          >
            {char}
          </span>
        ))}
      </div>
    );
  };

  // Agregar marcadores de posición cada 10 caracteres
  const renderPositionMarkers = () => {
    if (!sequences.length) return null;
    
    const sequenceLength = sequences[0].content.length;
    const markers = [];
    
    for (let i = 0; i < sequenceLength; i += 10) {
      markers.push(
        <span 
          key={i} 
          className="inline-block text-center w-40 text-xs text-gray-500" 
          style={{ position: 'absolute', left: `${i * 16}px` }}
        >
          {i + 10}
        </span>
      );
    }
    
    return (
      <div className="whitespace-nowrap mb-2 relative h-4 overflow-hidden">
        {markers}
      </div>
    );
  };

  // Asignar una referencia para cada secuencia
  const setSequenceRef = (el: HTMLDivElement | null, index: number) => {
    sequenceRefs.current[index] = el;
  };

  return (
    <div className="relative">
      {/* Indicadores de posición */}
      {showControls && (
        <div className="mb-1 pl-48 overflow-hidden">
          <div 
            className="relative overflow-x-hidden"
            ref={positionMarkerRef}
          >
            {renderPositionMarkers()}
          </div>
        </div>
      )}
      
      {/* Control de desplazamiento maestro */}
      {showControls && (
        <div className="flex items-center mb-3 mt-2">
          <button 
            onClick={() => jump('left')}
            className="p-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50"
            aria-label="Scroll left"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          
          <div className="flex-1 mx-2">
            <input
              type="range"
              value={scrollPosition}
              min={0}
              max={maxScroll}
              onChange={handleMasterScroll}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
              aria-label="Master scroll control"
            />
          </div>
          
          <button 
            onClick={() => jump('right')}
            className="p-1 rounded-md bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-800/50"
            aria-label="Scroll right"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {/* Contenedor para todas las secuencias */}
      <div ref={containerRef} className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4">
        {/* Secuencias */}
        {sequences.map((sequence, index) => (
          <div key={index} className="mb-4">
            <div className="flex">
              <div className="text-purple-600 dark:text-purple-400 w-48 flex-shrink-0 font-mono pr-2 border-r border-gray-200 dark:border-gray-700">
                {sequence.name}
              </div>
              <div 
                className="overflow-x-auto font-mono text-sm pl-2 sequence-container"
                ref={(el) => setSequenceRef(el, index)}
                onScroll={handleScroll}
                data-sequence-index={index}
              >
                {renderColoredSequence(sequence.content)}
              </div>
            </div>
          </div>
        ))}
        
        {/* Secuencia de consenso si se proporciona */}
        {consensusSequence && (
          <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div className="flex">
              <div className="text-purple-600 dark:text-purple-400 w-48 flex-shrink-0 font-mono pr-2 border-r border-gray-200 dark:border-gray-700">
                {t('alignment.consensusSequence')}
              </div>
              <div 
                className="overflow-x-auto font-mono text-sm pl-2 sequence-container"
                ref={(el) => setSequenceRef(el, sequences.length)}
                onScroll={handleScroll}
                data-sequence-index={sequences.length}
              >
                {renderColoredSequence(consensusSequence)}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Texto de ayuda */}
      {showControls && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          {t('alignment.scrollHint', { defaultValue: 'Use the slider above to navigate through the sequences. All sequences will scroll together.' })}
        </div>
      )}

      {/* Estilos adicionales para el desplazamiento sincronizado */}
      <style jsx>{`
        .sequence-container {
          scrollbar-width: thin;
          scrollbar-color: rgba(139, 92, 246, 0.5) rgba(0, 0, 0, 0.1);
        }
        
        .sequence-container::-webkit-scrollbar {
          height: 8px;
        }
        
        .sequence-container::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 4px;
        }
        
        .sequence-container::-webkit-scrollbar-thumb {
          background-color: rgba(139, 92, 246, 0.5);
          border-radius: 4px;
        }
        
        .sequence-container::-webkit-scrollbar-thumb:hover {
          background-color: rgba(139, 92, 246, 0.7);
        }
      `}</style>
    </div>
  );
};

export default SynchronizedSequenceView;