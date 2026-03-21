import React from 'react';

interface CustomInputProps {
  type: 'radio' | 'checkbox';
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
  name?: string;
}

const CustomInput = ({ type, checked, onChange, disabled = false, label, name }: CustomInputProps) => {
  return (
    <label className={`
      inline-flex items-center cursor-pointer ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
    `}>
      <div className={`
        relative w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center 
        ${type === 'radio' ? 'rounded-full' : 'rounded'}
        border-2 transition-all duration-200
        ${checked 
          ? 'border-purple-600 bg-purple-600' 
          : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700'}
        touch-action: manipulation;
      `}>
        {checked && (
          type === 'radio' ? (
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-white"></div>
          ) : (
            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
            </svg>
          )
        )}
        <input
          type={type}
          className="absolute opacity-0 w-0 h-0"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          name={name}
        />
      </div>
      <span className="ml-2 text-gray-700 dark:text-gray-300 text-xs sm:text-sm">
        {label}
      </span>
    </label>
  );
};

export default CustomInput;