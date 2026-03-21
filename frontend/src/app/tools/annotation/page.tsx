'use client';

import { useTranslation } from '@/context/TranslationProvider';
import { useState, useEffect } from 'react';
import ToolHeader from '@/components/ui/ToolHeader';
import { TagIcon, MagnifyingGlassIcon, SparklesIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import SequenceInput from '@/components/tools/annotation/SequenceInput';
import AnnotationOptions from '@/components/tools/annotation/AnnotationOptions';
import AnnotationResults from '@/components/tools/annotation/AnnotationResults';
import { AnnotationSettings, AnnotationFeature } from '@/types/annotation';
import { annotateSequence } from '@/services/annotation/annotationService';
import FloatingChat from '@/components/chat/FloatingChat';
import ToolPageWrapper from '@/components/tools/ToolPageWrapper';
import AISequenceSearch from '@/components/tools/annotation/AISequenceSearch';
import AnnotationSequenceSearch from '@/components/tools/annotation/AnnotationSequenceSearch';
import FeaturesTable from '@/components/tools/annotation/FeaturesTable';
import SeqVizViewer from '@/components/tools/annotation/SeqVizViewer';

// Main content component
const AnnotationContent = () => {
    const { t } = useTranslation();
    const [sequence, setSequence] = useState<string>('');
    const [sequenceId, setSequenceId] = useState<string>('');
    const [settings, setSettings] = useState<AnnotationSettings>({
        sequenceType: 'protein',
        database: 'uniprot',
        showFeatures: {
            domains: true,
            motifs: true,
            modifications: true,
            variants: true,
        },
    });
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [results, setResults] = useState<AnnotationFeature[] | null>(null);
    const [retrievedSequence, setRetrievedSequence] = useState<string>('');
    const [showIdAiSearch, setShowIdAiSearch] = useState(false);
    const [showDatabaseSearch, setShowDatabaseSearch] = useState(false);
    const [viewMode, setViewMode] = useState<'visual' | 'table'>('visual');
    
    // Tool context for floating chat
    const toolContext = {
        name: 'annotation',
        displayName: t('tools.annotation')
    };

    // Handle setting changes
    const handleSettingsChange = (setting: string, value: any) => {
        if (setting.includes('.')) {
            const [parent, child] = setting.split('.');

            if (parent === 'showFeatures') {
                setSettings((prev) => ({
                    ...prev,
                    showFeatures: {
                        ...prev.showFeatures,
                        [child]: value,
                    },
                }));
            } else {
                console.warn(`Unexpected nested setting: ${setting}`);
            }
        } else {
            setSettings((prev) => ({
                ...prev,
                [setting]: value,
            }));
        }
    };

    // Handle sequence analysis
    const handleAnnotateSequence = async () => {
        if (!sequence.trim() && !sequenceId.trim()) {
            setError(t('annotation.errorEmptyInput'));
            return;
        }

        setIsLoading(true);
        setError(null);
        setResults(null);
        setRetrievedSequence(''); // Reset retrieved sequence

        try {
            // Call annotation service
            const response = await annotateSequence(
                sequence.trim() || null,
                sequenceId.trim() || null,
                settings
            );

            // Handle features and sequence
            const features = Array.isArray(response) ? response : response.features;
            setResults(features);

            // Update sequence if received from backend
            if (response.sequence) {
                setRetrievedSequence(response.sequence);
                if (!sequence && response.sequence) {
                    setSequence(response.sequence);
                }
            }

            if (features.length === 0) {
                setError(t('annotation.noFeaturesFound'));
            }
        } catch (err: any) {
            console.error('Error during annotation:', err);
            setError(err.message || t('annotation.errorGeneric'));
        } finally {
            setIsLoading(false);
        }
    };

    // Handle AI ID search result
    const handleIdFound = async (result: { sequence?: string, id?: string, name?: string }) => {
        try {
            if (result.id) {
                setSequenceId(result.id);
            }
            
            if (result.sequence) {
                setSequence(result.sequence);
            }
            
            // Hide search UI
            setShowIdAiSearch(false);
        } catch (error) {
            console.error('Error handling ID search:', error);
        }
    };
    
    // Handle database sequence search results
    const handleDatabaseSequenceSelected = (sequence: string, name: string, metadata: any) => {
        console.log(`Sequence selected from database: ${name} (${sequence.length} bases/residues), type: ${metadata.type}`);
        
        // Update sequence content
        setSequence(sequence);
        
        // If there's an ID available in the metadata, set it too
        if (metadata.id) {
            setSequenceId(metadata.id);
        }
        
        // Hide search interface
        setShowDatabaseSearch(false);
    };

    // Toggle AI search and hide Database search
    const toggleAiSearch = () => {
        setShowIdAiSearch(!showIdAiSearch);
        if (!showIdAiSearch) {
            setShowDatabaseSearch(false);
        }
    };

    // Toggle Database search and hide AI search
    const toggleDatabaseSearch = () => {
        setShowDatabaseSearch(!showDatabaseSearch);
        if (!showDatabaseSearch) {
            setShowIdAiSearch(false);
        }
    };

    // Determine which sequence to use for visualization
    const sequenceToDisplay = retrievedSequence || sequence;
    const sequenceLength = sequenceToDisplay.length ||
        (results && results.length > 0 ?
            Math.max(...results.map(f => f.end)) + 10 :
            100);

    return (
        <div className="px-6 py-8 mx-auto max-w-7xl">
            <div className="mb-6">
                <div className="flex items-center mb-2">
                    <TagIcon className="h-8 w-8 text-purple-500 mr-3" />
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
                        {t('tools.annotation')}
                    </h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                    {t('tools.annotationDesc')}
                </p>
            </div>

            {/* Search and Input Section */}
            <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md mt-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
                    <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
                        {t('annotation.sequenceSearch')}
                    </h3>
                    
                    <div className="flex space-x-2">
                        <button
                            onClick={toggleAiSearch}
                            className={`inline-flex items-center p-2 rounded-md ${
                                showIdAiSearch 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-gray-100 dark:bg-neutral-700 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/20'
                            } transition-colors`}
                            title={t('annotation.aiSearch')}
                        >
                            <SparklesIcon className="h-5 w-5" />
                        </button>
                        
                        <button
                            onClick={toggleDatabaseSearch}
                            className={`inline-flex items-center p-2 rounded-md ${
                                showDatabaseSearch 
                                ? 'bg-purple-600 text-white' 
                                : 'bg-gray-100 dark:bg-neutral-700 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/20'
                            } transition-colors`}
                            title={t('annotation.databaseSearch')}
                        >
                            <MagnifyingGlassIcon className="h-5 w-5" />
                        </button>
                    </div>
                </div>
                
                {/* AI Search component for ID (conditional) */}
                {showIdAiSearch && (
                    <div className="mb-4">
                        <AISequenceSearch 
                            onSequenceFound={handleIdFound} 
                            inputType="id"
                            placeholderText={t('annotation.searchIdPlaceholder')}
                            isDisabled={isLoading}
                        />
                    </div>
                )}
                
                {/* Database search component (conditional) */}
                {showDatabaseSearch && (
                    <div className="mb-4">
                        <AnnotationSequenceSearch 
                            onSequenceSelected={handleDatabaseSequenceSelected}
                            inputId="main-search"
                            sequenceType={settings.sequenceType}
                        />
                    </div>
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <SequenceInput
                        sequence={sequence}
                        onSequenceChange={setSequence}
                        sequenceId={sequenceId}
                        onSequenceIdChange={setSequenceId}
                        sequenceType={settings.sequenceType}
                        isLoading={isLoading}
                        onSubmit={handleAnnotateSequence}
                    />
                    
                    <AnnotationOptions
                        settings={settings}
                        onChange={handleSettingsChange}
                        disabled={isLoading}
                    />
                </div>
            </div>

            {/* Results Section - only shown when results exist */}
            {(isLoading || error || results) && (
                <div className="mt-8">
                    <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 sm:p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-3 sm:gap-0">
                            <h3 className="font-semibold text-lg text-gray-800 dark:text-white">
                                {t('annotation.resultsTitle')}
                            </h3>
                            
                            {results && results.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                    <div className="flex bg-gray-100 dark:bg-neutral-800 p-1 rounded-lg">
                                        <button
                                            type="button"
                                            onClick={() => setViewMode('visual')}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                                                ${viewMode === 'visual' 
                                                ? 'bg-purple-600 text-white shadow' 
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                                        >
                                            {t('annotation.visualView')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setViewMode('table')}
                                            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors
                                                ${viewMode === 'table' 
                                                ? 'bg-purple-600 text-white shadow' 
                                                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-white'}`}
                                        >
                                            {t('annotation.tableView')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {isLoading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
                                    <p className="mt-4 text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
                                </div>
                            </div>
                        ) : error ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="text-center max-w-lg">
                                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">{t('annotation.errorTitle')}</h3>
                                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{error}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {viewMode === 'visual' && results && (
                                    <div className="overflow-x-auto">
                                        <SeqVizViewer 
                                            features={results} 
                                            sequenceLength={sequenceLength} 
                                            sequenceType={settings.sequenceType}
                                            sequence={sequenceToDisplay}
                                        />
                                    </div>
                                )}
                                
                                {viewMode === 'table' && results && (
                                    <div className="overflow-x-auto">
                                        <FeaturesTable features={results} />
                                    </div>
                                )}
                                
                                {results && results.length > 0 && (
                                    <div className="mt-6">
                                        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            {t('annotation.legend')}
                                        </h4>
                                        <div className="flex flex-wrap gap-3">
                                            {Array.from(new Set(results.map(r => r.type))).map(type => {
                                                // Use a single purple color for all features
                                                const color = '#9333EA';
                                                return (
                                                    <div key={type} className="flex items-center">
                                                        <div 
                                                            className="w-4 h-4 rounded-sm mr-1" 
                                                            style={{ backgroundColor: color }}
                                                        ></div>
                                                        <span className="text-xs text-gray-700 dark:text-gray-300">
                                                            {t(`annotation.feature${type.charAt(0).toUpperCase() + type.slice(1)}`)}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Debug information */}
            {sequenceId && retrievedSequence && (
                <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/10 rounded-lg border border-purple-200 dark:border-purple-800">
                    <p className="text-sm text-purple-800 dark:text-purple-300">
                        {t('annotation.sequenceRetrieved')} ({retrievedSequence.length} {settings.sequenceType === 'protein' ? 'aa' : 'bp'})
                    </p>
                </div>
            )}

            {/* Floating chat */}
            <FloatingChat toolContext={toolContext} />
        </div>
    );
};

// Main page with route protection
export default function AnnotationPage() {
    return (
        <ToolPageWrapper>
            <AnnotationContent />
        </ToolPageWrapper>
    );
}