import React, { useState } from 'react';
import { MagnifyingGlassIcon, ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

// Define types for props
interface Region {
  start: number;
  end: number;
}

interface ConservedRegionsProps {
  regions: Region[];
  consensusSequence: string;
  t: (key: string, options?: any) => string;
}

const ConservedRegions: React.FC<ConservedRegionsProps> = ({ regions, consensusSequence, t }) => {
  const [expandedRegion, setExpandedRegion] = useState<number | null>(null);
  const [zoomedRegion, setZoomedRegion] = useState<number | null>(null);

  if (!regions || regions.length === 0) return null;

  const toggleExpand = (index: number) => {
    setExpandedRegion(expandedRegion === index ? null : index);
  };

  const toggleZoom = (index: number) => {
    setZoomedRegion(zoomedRegion === index ? null : index);
  };

  // Function to get more context around a region
  const getRegionWithContext = (start: number, end: number, context: number = 10) => {
    const contextStart = Math.max(0, start - context);
    const contextEnd = Math.min(consensusSequence.length - 1, end + context);
    
    return {
      before: consensusSequence.substring(contextStart, start),
      region: consensusSequence.substring(start, end + 1),
      after: consensusSequence.substring(end + 1, contextEnd + 1),
      positions: {
        beforeStart: contextStart + 1,
        regionStart: start + 1,
        regionEnd: end + 1,
        afterEnd: contextEnd + 1
      }
    };
  };

  // Get residue counts for a given region
  const getResidueStats = (sequence: string) => {
    const counts: Record<string, number> = {};
    
    for (const char of sequence) {
      if (char === '-') continue; // Skip gaps
      counts[char] = (counts[char] || 0) + 1;
    }
    
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1]) // Sort by frequency, high to low
      .slice(0, 5); // Return top 5 most frequent residues
  };

  return (
    <div className="mt-6">
      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {t('alignment.conservedRegions')}
      </h4>
      <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-4">
        <div className="max-h-72 overflow-y-auto pr-2 space-y-3">
          {regions.map((region, index) => {
            const regionSequence = consensusSequence.substring(region.start, region.end + 1);
            const isExpanded = expandedRegion === index;
            const isZoomed = zoomedRegion === index;
            const context = getRegionWithContext(region.start, region.end);
            
            return (
              <div 
                key={index} 
                className={`border rounded-lg transition-all ${
                  isExpanded 
                    ? 'border-purple-300 dark:border-purple-600 bg-white dark:bg-neutral-900' 
                    : 'border-gray-200 dark:border-gray-700'
                }`}
              >
                {/* Header row with basic info */}
                <div 
                  className="p-3 flex items-center justify-between cursor-pointer"
                  onClick={() => toggleExpand(index)}
                >
                  <div className="flex items-center space-x-2">
                    {isExpanded ? (
                      <ChevronDownIcon className="h-4 w-4 text-purple-500" />
                    ) : (
                      <ChevronRightIcon className="h-4 w-4 text-purple-500" />
                    )}
                    <span className="text-purple-600 dark:text-purple-400 font-medium">
                      {t('alignment.regionPositions', {
                        start: (region.start + 1).toString(),
                        end: (region.end + 1).toString()
                      })}
                    </span>
                    <span className="text-gray-500 dark:text-gray-400 text-xs">
                      ({regionSequence.length} {t('alignment.residues')})
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      className="p-1 rounded-md text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleZoom(index);
                      }}
                      title={t('alignment.examineRegion')}
                      aria-label={t('alignment.examineRegion')}
                    >
                      <MagnifyingGlassIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                
                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1">
                    <div className="font-mono text-sm bg-neutral-50 dark:bg-neutral-800 p-2 rounded overflow-x-auto">
                      <span className="text-gray-500 dark:text-gray-400">
                        {regionSequence}
                      </span>
                    </div>
                    
                    {/* Residue statistics */}
                    <div className="mt-3">
                      <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                        {t('alignment.topResidues')}
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {getResidueStats(regionSequence).map(([residue, count], i) => (
                          <span 
                            key={i}
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300"
                          >
                            {residue}: {count}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Zoomed view with context */}
                {isZoomed && (
                  <div className="px-3 pb-3 pt-1 border-t border-gray-200 dark:border-gray-700">
                    <h5 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                      {t('alignment.regionContext')}
                    </h5>
                    
                    <div className="font-mono text-sm overflow-x-auto whitespace-nowrap bg-white dark:bg-neutral-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                      <div className="text-xs text-gray-400 mb-1 flex">
                        <span className="w-16 flex-none"></span>
                        <span className="flex-grow">
                          <span className="inline-block" style={{marginLeft: '0px'}}>{context.positions.beforeStart}</span>
                          <span className="inline-block" style={{marginLeft: `${context.before.length * 8}px`}}>{context.positions.regionStart}</span>
                          <span className="inline-block" style={{marginLeft: `${context.region.length * 8 - 20}px`}}>{context.positions.regionEnd}</span>
                        </span>
                      </div>
                      
                      <div className="flex">
                        <span className="w-16 flex-none text-gray-500">Context:</span>
                        <span>
                          <span className="text-gray-400">{context.before}</span>
                          <span className="bg-purple-200 dark:bg-purple-800/50 px-1 text-purple-900 dark:text-purple-100">{context.region}</span>
                          <span className="text-gray-400">{context.after}</span>
                        </span>
                      </div>
                      
                      <div className="mt-2 text-right">
                        <button
                          onClick={() => toggleZoom(index)}
                          className="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          {t('alignment.closeDetail')}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ConservedRegions;