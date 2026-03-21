import { useTranslation } from '@/context/TranslationProvider';
import { useState, useEffect } from 'react';
import { BlastResults as BlastResultsType, BlastHit, BlastProgramInfo, BlastDatabaseInfo } from '@/types/blast';
import AlignmentView from './AlignmentView';
import BlastAIAnalysis from './BlastAIAnalysis';
import { format } from 'date-fns';
import { es, enUS } from 'date-fns/locale';

interface BlastResultsProps {
  results: BlastResultsType | null;
  isLoading: boolean;
  error: string | null;
  jobId?: number;
  jobDetails?: {
    program?: string;
    database?: string;
    createdAt?: string;
  };
}


const BlastResults = ({
  results,
  isLoading,
  error,
  jobId,
  jobDetails
}: BlastResultsProps) => {
  const { t, language } = useTranslation();
  const [selectedTab, setSelectedTab] = useState<'summary' | 'alignment'>('summary');
  const [selectedHitId, setSelectedHitId] = useState<string | undefined>(undefined);

  // Función para formatear la fecha con hora exacta
  const formatExactDateTime = (dateString?: string) => {
    if (!dateString) return '';

    const date = new Date(dateString);
    const locale = language === 'es' ? es : enUS;

    // Formato: "dd MMM yyyy, HH:mm" (ej: "15 May 2024, 14:30")
    return format(date, 'dd MMM yyyy, HH:mm', { locale });
  };

  // Información del programa y base de datos
  const programInfo = jobDetails?.program
    ? (BlastProgramInfo[jobDetails.program as keyof typeof BlastProgramInfo] || { name: jobDetails.program })
    : null;

  const databaseInfo = jobDetails?.database
    ? (BlastDatabaseInfo[jobDetails.database as keyof typeof BlastDatabaseInfo] || { name: jobDetails.database })
    : null;

  // Renderizar resumen de hits
  const renderHitsSummary = () => {
    if (!results || !results.summary || !results.summary.hits) {
      return (
        <div className="text-center p-6 text-gray-500 dark:text-gray-400">
          {t('blast.noHitsFound')}
        </div>
      );
    }

    const { hits, hit_count } = results.summary;

    if (hit_count === 0 || hits.length === 0) {
      return (
        <div className="text-center p-6 text-gray-500 dark:text-gray-400">
          {t('blast.noHitsFound')}
        </div>
      );
    }

    return (
      <div>
        <div className="mb-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('blast.hitCountLabel')}: <span className="font-medium text-gray-800 dark:text-gray-200">{hit_count}</span>
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('blast.hitId')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('blast.description')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('blast.score')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('blast.evalue')}
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('blast.identity')}
                </th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {t('blast.actions')}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-gray-800">
              {hits.map((hit, index) => (
                <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                    {hit.id}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-300 break-words max-w-xs">
                    {hit.title}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {hit.bit_score}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {hit.evalue}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                    {hit.identity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    <button
                      onClick={() => {
                        setSelectedHitId(hit.id);
                        setSelectedTab('alignment');
                      }}
                      className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                    >
                      {t('blast.viewAlignment')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };
  const exportResults = (format: 'xml' | 'json' | 'csv' | 'fasta') => {
    if (!results) return;

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `blast-results-${jobId || 'export'}-${timestamp}`;

    switch (format) {
      case 'xml':
        if (results.content) {
          downloadBlob(results.content, `${filename}.xml`, 'text/xml');
        }
        break;

      case 'json':
        const jsonData = {
          job_id: jobId,
          timestamp: new Date().toISOString(),
          program: jobDetails?.program,
          database: jobDetails?.database,
          summary: results.summary,
          hits: results.summary?.hits || []
        };
        downloadBlob(JSON.stringify(jsonData, null, 2), `${filename}.json`, 'application/json');
        break;

      case 'csv':
        const csvContent = convertToCSV(results.summary?.hits || []);
        downloadBlob(csvContent, `${filename}.csv`, 'text/csv');
        break;

      case 'fasta':
        const fastaContent = convertToFASTA(results.summary?.hits || []);
        downloadBlob(fastaContent, `${filename}.fasta`, 'text/plain');
        break;
    }
  };

  const downloadBlob = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const convertToCSV = (hits: any[]) => {
    const headers = ['Hit_ID', 'Title', 'Length', 'Bit_Score', 'E_Value', 'Identity'];
    const csvRows = [headers.join(',')];

    hits.forEach(hit => {
      const row = [
        hit.id || '',
        `"${(hit.title || '').replace(/"/g, '""')}"`, // Escape quotes
        hit.length || '',
        hit.bit_score || '',
        hit.evalue || '',
        hit.identity || ''
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  };

  const convertToFASTA = (hits: any[]) => {
    let fastaContent = '';

    hits.forEach((hit, index) => {
      fastaContent += `>${hit.id || `hit_${index + 1}`} ${hit.title || 'No description'}\n`;
      // Note: FASTA sequences would need to be extracted from alignment data
      // For now, we'll just provide a placeholder
      fastaContent += `${hit.sequence || 'SEQUENCE_NOT_AVAILABLE_IN_SUMMARY'}\n\n`;
    });

    return fastaContent;
  };


  // Renderizar alineamientos
  const renderAlignments = () => {
    return (
      <div>
        {selectedHitId && (
          <div className="mb-4">
            <button
              onClick={() => setSelectedHitId(undefined)}
              className="px-2 py-1 text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/10 rounded hover:bg-purple-100 dark:hover:bg-purple-900/20"
            >
              ← {t('blast.backToAllAlignments')}
            </button>
          </div>
        )}

        <AlignmentView
          xmlContent={results?.content}
          selectedHitId={selectedHitId}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200 dark:border-neutral-800 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all h-full">
        <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white flex items-center">
          {programInfo && databaseInfo ?
            <>
              {t('blast.resultsTitle')}: #{jobId} - {programInfo.name} {t('blast.search')} {t('blast.in')} {databaseInfo.name}
            </> :
            <>
              {t('blast.resultsTitle')}
              {jobId && <span className="ml-2 text-sm font-normal text-gray-500">#{jobId}</span>}
            </>
          }
        </h3>

        {jobDetails?.createdAt && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('blast.createdAt')}: {formatExactDateTime(jobDetails.createdAt)}
          </p>
        )}

        <div className="min-h-96">
          {isLoading ? (
            <div className="text-center p-6">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-solid border-purple-500 border-r-transparent mb-4"></div>
              <p className="text-gray-600 dark:text-gray-400">
                {t('blast.loading')}
              </p>
            </div>
          ) : error ? (
            <div className="text-center p-6 text-red-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>{error}</p>
            </div>
          ) : !results ? (
            <div className="text-center p-6 text-gray-500 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>{t('blast.noResults')}</p>
            </div>
          ) : (
            <div className="w-full">
              {/* Pestañas */}
              <div className="mb-4 border-b border-gray-200 dark:border-gray-700">
                <ul className="flex flex-wrap -mb-px">
                  <li className="mr-2">
                    <button
                      onClick={() => setSelectedTab('summary')}
                      className={`inline-block p-4 rounded-t-lg ${selectedTab === 'summary'
                        ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400'
                        : 'border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                      {t('blast.summaryTab')}
                    </button>
                  </li>
                  <li className="mr-2">
                    <button
                      onClick={() => {
                        setSelectedTab('alignment');
                        setSelectedHitId(undefined); // Resetear hit seleccionado al cambiar a vista de alineamiento
                      }}
                      className={`inline-block p-4 rounded-t-lg ${selectedTab === 'alignment'
                        ? 'border-b-2 border-purple-500 text-purple-600 dark:text-purple-400'
                        : 'border-b-2 border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                        }`}
                    >
                      {t('blast.alignmentTab')}
                    </button>
                  </li>
                </ul>
              </div>

              {/* Contenido de la pestaña seleccionada */}
              <div className="p-2">
                {selectedTab === 'summary' ? renderHitsSummary() : renderAlignments()}
              </div>
            </div>
          )}
        </div>

        {/* Información adicional */}
        {results && !isLoading && !error && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('blast.exportOptions')}
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                className="px-3 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 text-xs rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/40 transition-colors"
                onClick={() => exportResults('xml')}
                title={t('blast.downloadXMLDescription') || 'Download raw XML results'}
              >
                {t('blast.downloadXML') || 'XML'}
              </button>
              <button
                className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs rounded-md hover:bg-green-200 dark:hover:bg-green-900/40 transition-colors"
                onClick={() => exportResults('json')}
                title={t('blast.downloadJSONDescription') || 'Download summary as JSON'}
              >
                {t('blast.downloadJSON') || 'JSON'}
              </button>
              <button
                className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 text-xs rounded-md hover:bg-blue-200 dark:hover:bg-blue-900/40 transition-colors"
                onClick={() => exportResults('csv')}
                title={t('blast.downloadCSVDescription') || 'Download hits summary as CSV'}
              >
                {t('blast.downloadCSV') || 'CSV'}
              </button>
              <button
                className="px-3 py-1 bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-xs rounded-md hover:bg-orange-200 dark:hover:bg-orange-900/40 transition-colors"
                onClick={() => exportResults('fasta')}
                title={t('blast.downloadFASTADescription') || 'Download hits as FASTA'}
              >
                {t('blast.downloadFASTA') || 'FASTA'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* AI Analysis Component */}
      {results && !isLoading && !error && (
        <BlastAIAnalysis results={results} />
      )}
    </div>
  );
};

export default BlastResults;