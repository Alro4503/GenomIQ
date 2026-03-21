import { useState } from 'react';
import { useTranslation } from '@/context/TranslationProvider';
import { AlignmentResult as AlignmentResultType } from '@/types/alignment';
import { DocumentDuplicateIcon, ArrowDownTrayIcon, CheckIcon } from '@heroicons/react/24/outline';
import { Tab } from '@headlessui/react';
import PhylogeneticTree from './PhylogeneticTree';
import AlignmentAIAnalysis from './AlignmentAIAnalysis';
import SynchronizedSequenceView from './SynchronizedSequenceView';
import ConservedRegions from './ConservedRegions';

interface AlignmentResultProps {
  result: AlignmentResultType;
}

const AlignmentResult = ({ result }: AlignmentResultProps) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  const tabOptions = [
    { key: 'alignedSequences', label: t('alignment.resultsAlignedSeq') },
    { key: 'consensusSequence', label: t('alignment.resultsConsensus') },
    { key: 'phylogeneticTree', label: t('alignment.resultsTree') },
    { key: 'statistics', label: t('alignment.resultsStats') }
  ];

  const handleCopy = () => {
    let textToCopy = '';

    if (activeTab === 0) {
      // Format aligned sequences
      textToCopy = result.alignedSequences
        .map(seq => `>${seq.name}\n${seq.content}`)
        .join('\n\n');
    } else if (activeTab === 1) {
      // Format consensus sequence
      textToCopy = `>Consensus\n${result.consensusSequence}`;
    } else if (activeTab === 2) {
      // Copy Newick format
      textToCopy = result.newickTree;
    }

    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleDownload = () => {
    let content = '';
    let filename = '';

    if (activeTab === 0) {
      // Create FASTA format for aligned sequences
      content = result.alignedSequences
        .map(seq => `>${seq.name}\n${seq.content}`)
        .join('\n\n');
      filename = 'aligned_sequences.fasta';
    } else if (activeTab === 1) {
      // Create FASTA format for consensus
      content = `>Consensus\n${result.consensusSequence}`;
      filename = 'consensus_sequence.fasta';
    } else if (activeTab === 2) {
      // Create Newick format for tree
      content = result.newickTree;
      filename = 'phylogenetic_tree.newick';
    } else if (activeTab === 3) {
      // Create JSON format for statistics
      content = JSON.stringify({
        method: result.method,
        score: result.alignmentScore,
        conservedRegions: result.conservedRegions
      }, null, 2);
      filename = 'alignment_statistics.json';
    }

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Rendering functions for each tab
  const renderAlignedSequences = () => (
    <div className="w-full overflow-x-auto">
      {/* Usar nuestro componente sincronizado para mostrar las secuencias alineadas */}
      <SynchronizedSequenceView 
        sequences={result.alignedSequences} 
        consensusSequence={result.consensusSequence}
      />
      
      <div className="mt-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('alignment.colorLegend')}
        </h4>
        <div className="flex flex-wrap gap-3">
          <ColorLegendItem color="bg-blue-200 dark:bg-blue-800/50" text={t('alignment.conservedHydrophilic')} />
          <ColorLegendItem color="bg-red-200 dark:bg-red-800/50" text={t('alignment.conservedHydrophobic')} />
          <ColorLegendItem color="bg-purple-200 dark:bg-purple-800/50" text={t('alignment.conservedAromatic')} />
          <ColorLegendItem color="bg-purple-200 dark:bg-purple-800/50" text={t('alignment.conservedCysteine')} />
          <ColorLegendItem color="bg-purple-200 dark:bg-purple-800/50" text={t('alignment.conservedProline')} />
          <ColorLegendItem color="bg-gray-200 dark:bg-gray-700/50" text={t('alignment.gap')} />
        </div>
      </div>
    </div>
  );

  const renderConsensusSequence = () => (
    <div className="w-full overflow-x-auto">
      {/* Vista de secuencia consenso sincronizada */}
      <SynchronizedSequenceView 
        sequences={[]} 
        consensusSequence={result.consensusSequence}
      />

      {/* Use the new ConservedRegions component */}
      <ConservedRegions
        regions={result.conservedRegions}
        consensusSequence={result.consensusSequence}
        t={t}
      />
    </div>
  );

  const renderPhylogeneticTree = () => (
    <div className="w-full">
      <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3 sm:p-4 overflow-x-auto">
        {/* Wrapper to control tree size responsively */}
        <div className="w-full overflow-auto min-h-[300px] flex justify-center">
          {/* Use our custom PhylogeneticTree component with responsive sizes */}
          <div className="min-w-[320px]">
            <PhylogeneticTree 
              newickString={result.newickTree} 
              width={window.innerWidth < 640 ? 320 : (window.innerWidth < 768 ? 400 : 560)} 
              height={window.innerWidth < 640 ? 280 : 320} 
            />
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
          <p className="mb-2">{t('alignment.newickFormat')}:</p>
          <div className="font-mono text-xs p-2 bg-gray-200 dark:bg-gray-700 rounded-md overflow-x-auto">
            {result.newickTree}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStatistics = () => (
    <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3 sm:p-4 overflow-x-auto">
      <h4 className="font-medium text-gray-800 dark:text-white mb-4">
        {t('alignment.alignmentStatistics')}
      </h4>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <StatItem
          label={t('alignment.method')}
          value={result.method.toUpperCase()}
        />
        <StatItem
          label={t('alignment.score')}
          value={`${result.alignmentScore.toFixed(2)}%`}
        />
        <StatItem
          label={t('alignment.sequenceCount')}
          value={result.alignedSequences.length.toString()}
        />
        <StatItem
          label={t('alignment.alignmentLength')}
          value={result.alignedSequences[0]?.content.length.toString() || '0'}
        />
        <StatItem
          label={t('alignment.conservedRegions')}
          value={result.conservedRegions.length.toString()}
        />
        <StatItem
          label={t('alignment.consensusLength')}
          value={result.consensusSequence.length.toString()}
        />
      </div>

      {/* Gap Analysis */}
      <div className="mt-6 w-full">
        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {t('alignment.gapAnalysis')}
        </h5>
        <div className="overflow-x-auto w-full">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead>
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('alignment.sequence')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('alignment.gapCount')}
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('alignment.gapPercentage')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {result.alignedSequences.map((seq, index) => {
                const gapCount = (seq.content.match(/-/g) || []).length;
                const gapPercentage = (gapCount / seq.content.length) * 100;

                return (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-900'}>
                    <td className="px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
                      {seq.name}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
                      {gapCount}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-800 dark:text-gray-200">
                      {gapPercentage.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Performance Info */}
      <div className="mt-6 bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
        <p className="text-xs text-purple-700 dark:text-purple-300">
          {t('alignment.analysisPerformedWith', { method: result.method.toUpperCase() })}
          <span className="block mt-1">
            {t('alignment.poweredBy')} <a href="https://biowasm.com" target="_blank" rel="noopener noreferrer" className="underline">Biowasm</a>
          </span>
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <h3 className="font-semibold text-lg text-gray-800 dark:text-white">{t('alignment.resultsTitle')}</h3>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleCopy}
            className="inline-flex items-center text-sm py-1 px-2 border border-purple-300 dark:border-purple-600 rounded-md hover:bg-purple-100 dark:hover:bg-purple-800 transition-colors text-purple-700 dark:text-purple-300"
          >
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4 mr-1 text-purple-500" />
                {t('translation.copied')}
              </>
            ) : (
              <>
                <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                {t('translation.copyResults')}
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center text-sm py-1 px-2 border border-purple-300 dark:border-purple-600 rounded-md hover:bg-purple-100 dark:hover:bg-purple-800 transition-colors text-purple-700 dark:text-purple-300"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
            {t('alignment.download')}
          </button>
        </div>
      </div>

      <Tab.Group onChange={setActiveTab}>
        <Tab.List className="flex flex-wrap sm:flex-nowrap space-x-0 sm:space-x-1 space-y-1 sm:space-y-0 rounded-lg bg-gray-100 dark:bg-neutral-800 p-1">
          {tabOptions.map((tab, index) => (
            <Tab
              key={tab.key}
              className={({ selected }) =>
                `w-full sm:w-auto py-2 px-1 sm:px-3 text-xs sm:text-sm font-medium rounded-md focus:outline-none
                ${index > 0 && index % 2 === 0 ? 'sm:ml-1' : ''}
                ${selected
                  ? 'bg-white dark:bg-neutral-700 text-purple-600 dark:text-purple-400 shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-white/[0.5] dark:hover:bg-neutral-700/[0.5]'
                }`
              }
            >
              {tab.label}
            </Tab>
          ))}
        </Tab.List>
        <Tab.Panels className="mt-2">
          <Tab.Panel className="w-full overflow-hidden">{renderAlignedSequences()}</Tab.Panel>
          <Tab.Panel className="w-full overflow-hidden">{renderConsensusSequence()}</Tab.Panel>
          <Tab.Panel className="w-full overflow-hidden">{renderPhylogeneticTree()}</Tab.Panel>
          <Tab.Panel className="w-full overflow-hidden">{renderStatistics()}</Tab.Panel>
        </Tab.Panels>
      </Tab.Group>

      {/* AI Analysis Component */}
      <AlignmentAIAnalysis result={result} />
    </div>
  );
};

// Helper components
const ColorLegendItem = ({ color, text }: { color: string; text: string }) => (
  <div className="flex items-center space-x-1">
    <div className={`w-4 h-4 rounded ${color}`}></div>
    <span className="text-xs text-gray-600 dark:text-gray-400">{text}</span>
  </div>
);

const StatItem = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-sm">
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
    <div className="text-lg font-medium text-gray-800 dark:text-white">{value}</div>
  </div>
);

export default AlignmentResult;