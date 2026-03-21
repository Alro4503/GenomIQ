import Link from 'next/link';
import { useTranslation } from '@/context/TranslationProvider';
import { ArrowRightIcon } from '@heroicons/react/24/outline';

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

interface ToolCardProps {
  tool: Tool;
}

const ToolCard: React.FC<ToolCardProps> = ({ tool }) => {
  const { t } = useTranslation();
  
  return (
    <div className="h-full w-full">
      <Link href={tool.url} className="block h-full">
        <div className="h-full border border-gray-200 dark:border-neutral-800 rounded-xl p-6 flex flex-col justify-between bg-white dark:bg-neutral-900 hover:shadow-md hover:border-purple-500/50 dark:hover:border-purple-500/50 transition-all">
          {/* Cabecera con icono centrado verticalmente */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center">
              <div className="mr-3 flex items-center justify-center">
                {tool.icon}
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                {tool.displayName}
              </h3>
            </div>
            {/* Etiqueta de categoría con altura fija */}
            <span className="inline-flex items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 px-2.5 py-1 h-6 text-xs font-medium text-purple-800 dark:text-purple-300">
              {tool.category}
            </span>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 min-h-12 flex-grow">
            {tool.description}
          </p>
          
          <div className="mt-5 pt-4 border-t border-gray-100 dark:border-neutral-800">
            <div className="flex justify-between items-center">
              <div className="flex flex-wrap gap-1">
                {tool.supportedSequenceTypes.map((type) => (
                  <span 
                    key={type} 
                    className="inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-neutral-800 px-2 py-1 h-6 text-xs font-medium text-gray-800 dark:text-gray-300"
                  >
                    {type}
                  </span>
                ))}
              </div>
              
              <span className="inline-flex items-center text-purple-600 dark:text-purple-400 text-sm font-medium">
                {t('common.open')}
                <ArrowRightIcon className="ml-1 h-4 w-4" />
              </span>
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
};

export default ToolCard;