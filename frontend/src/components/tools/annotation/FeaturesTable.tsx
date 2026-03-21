import { useTranslation } from '@/context/TranslationProvider';
import { useState, useMemo } from 'react';
import { AnnotationFeature } from '@/types/annotation';
import { 
  ArrowUpIcon, 
  ArrowDownIcon, 
  MagnifyingGlassIcon,
  ArrowDownTrayIcon
} from '@heroicons/react/24/outline';

interface FeaturesTableProps {
  features: AnnotationFeature[];
}

const FeaturesTable = ({ features }: FeaturesTableProps) => {
  const { t } = useTranslation();
  const [sortField, setSortField] = useState<keyof AnnotationFeature>('start');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Handle sorting
  const handleSort = (field: keyof AnnotationFeature) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Filter and sort features
  const filteredAndSortedFeatures = useMemo(() => {
    let result = [...features];
    
    // Filter based on search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(feature => 
        feature.name.toLowerCase().includes(query) || 
        feature.description.toLowerCase().includes(query) ||
        feature.type.toLowerCase().includes(query)
      );
    }
    
    // Sort based on current sort field and direction
    result.sort((a, b) => {
      let valueA = a[sortField];
      let valueB = b[sortField];
      
      // Handle undefined values
      if (valueA === undefined) return sortDirection === 'asc' ? -1 : 1;
      if (valueB === undefined) return sortDirection === 'asc' ? 1 : -1;
      
      // Handle numeric values
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }
      
      // Handle string values
      const strA = String(valueA).toLowerCase();
      const strB = String(valueB).toLowerCase();
      
      return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
    });
    
    return result;
  }, [features, searchQuery, sortField, sortDirection]);
  
  // Export to CSV
  const exportToCsv = () => {
    const headers = ['Name', 'Type', 'Start', 'End', 'Description', 'Source', 'Score', 'Evidence'];
    
    const csvContent = [
      headers.join(','),
      ...filteredAndSortedFeatures.map(feature => [
        `"${(feature.name || '').replace(/"/g, '""')}"`,
        feature.type,
        feature.start,
        feature.end,
        `"${(feature.description || '').replace(/"/g, '""')}"`,
        feature.source || '',
        feature.score !== undefined ? feature.score : '',
        feature.evidence ? `"${feature.evidence.replace(/"/g, '""')}"` : ''
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'sequence_annotations.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-neutral-800 p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {t('annotation.featuresTableTitle')} ({filteredAndSortedFeatures.length})
        </h4>
        
        {/* Search and export */}
        <div className="flex flex-col sm:flex-row w-full sm:w-auto items-start sm:items-center gap-2">
          <div className="relative w-full sm:w-auto">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" aria-hidden="true" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full sm:w-auto rounded-md border-0 py-1.5 pl-10 pr-3 text-gray-900 dark:text-gray-100 bg-white dark:bg-neutral-700 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:ring-inset focus:ring-purple-600 sm:text-sm"
              placeholder={t('annotation.searchPlaceholder')}
            />
          </div>
          
          <button
            type="button"
            onClick={exportToCsv}
            className="inline-flex items-center justify-center w-full sm:w-auto px-2.5 py-1.5 text-sm font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-600 focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-300 dark:border-gray-600"
          >
            <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
            {t('annotation.export')}
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-neutral-800">
            <tr>
              <th 
                scope="col" 
                className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  {t('annotation.columnName')}
                  {sortField === 'name' && (
                    sortDirection === 'asc' ? 
                      <ArrowUpIcon className="h-3 w-3 ml-1" /> : 
                      <ArrowDownIcon className="h-3 w-3 ml-1" />
                  )}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700"
                onClick={() => handleSort('type')}
              >
                <div className="flex items-center">
                  {t('annotation.columnType')}
                  {sortField === 'type' && (
                    sortDirection === 'asc' ? 
                      <ArrowUpIcon className="h-3 w-3 ml-1" /> : 
                      <ArrowDownIcon className="h-3 w-3 ml-1" />
                  )}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700"
                onClick={() => handleSort('start')}
              >
                <div className="flex items-center">
                  {t('annotation.columnStart')}
                  {sortField === 'start' && (
                    sortDirection === 'asc' ? 
                      <ArrowUpIcon className="h-3 w-3 ml-1" /> : 
                      <ArrowDownIcon className="h-3 w-3 ml-1" />
                  )}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700"
                onClick={() => handleSort('end')}
              >
                <div className="flex items-center">
                  {t('annotation.columnEnd')}
                  {sortField === 'end' && (
                    sortDirection === 'asc' ? 
                      <ArrowUpIcon className="h-3 w-3 ml-1" /> : 
                      <ArrowDownIcon className="h-3 w-3 ml-1" />
                  )}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700 hidden md:table-cell"
                onClick={() => handleSort('description')}
              >
                <div className="flex items-center">
                  {t('annotation.columnDescription')}
                  {sortField === 'description' && (
                    sortDirection === 'asc' ? 
                      <ArrowUpIcon className="h-3 w-3 ml-1" /> : 
                      <ArrowDownIcon className="h-3 w-3 ml-1" />
                  )}
                </div>
              </th>
              <th 
                scope="col" 
                className="px-3 py-3.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-neutral-700 hidden lg:table-cell"
                onClick={() => handleSort('source')}
              >
                <div className="flex items-center">
                  {t('annotation.columnSource')}
                  {sortField === 'source' && (
                    sortDirection === 'asc' ? 
                      <ArrowUpIcon className="h-3 w-3 ml-1" /> : 
                      <ArrowDownIcon className="h-3 w-3 ml-1" />
                  )}
                </div>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-neutral-900 divide-y divide-gray-200 dark:divide-gray-800">
            {filteredAndSortedFeatures.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  {searchQuery ? t('annotation.noSearchResults') : t('annotation.noFeatures')}
                </td>
              </tr>
            ) : (
              filteredAndSortedFeatures.map((feature, index) => (
                <tr 
                  key={feature.id || index} 
                  className="hover:bg-gray-50 dark:hover:bg-neutral-800"
                >
                  <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-sm mr-2 flex-shrink-0" 
                        style={{ backgroundColor: feature.color || '#9333EA' }}
                      ></div>
                      {feature.name}
                    </div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    {feature.type}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    {feature.start}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                    {feature.end}
                  </td>
                  <td className="px-3 py-4 text-sm text-gray-700 dark:text-gray-300 max-w-xs truncate hidden md:table-cell">
                    {feature.description}
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300 hidden lg:table-cell">
                    {feature.source}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {filteredAndSortedFeatures.length > 10 && (
        <div className="bg-gray-50 dark:bg-neutral-800 px-3 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          {t('annotation.totalFeatures', { count: String(filteredAndSortedFeatures.length) })}
        </div>
      )}
    </div>
  );
};

export default FeaturesTable;