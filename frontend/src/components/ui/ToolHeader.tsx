import React from 'react';

interface ToolHeaderProps {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const ToolHeader = ({ title, description, icon }: ToolHeaderProps) => {
  return (
    <div className="flex items-start space-x-4 mb-6">
      <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex-shrink-0">
        {icon}
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
        <p className="mt-1 text-gray-600 dark:text-gray-400 max-w-3xl">{description}</p>
      </div>
    </div>
  );
};

export default ToolHeader;