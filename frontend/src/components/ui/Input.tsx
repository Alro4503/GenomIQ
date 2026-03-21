import React, { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, leftIcon, rightIcon, fullWidth = true, className = '', ...props }, ref) => {
    // Base classes
    const baseInputClasses = 'rounded-md border bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100';
    
    // Input state classes
    const stateClasses = error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : 'border-neutral-300 dark:border-neutral-700 focus:border-[#4A9136] focus:ring-[#4A9136]';
    
    // Icon padding
    const paddingClasses = leftIcon
      ? 'pl-10'
      : rightIcon
      ? 'pr-10'
      : 'px-4';
    
    // Width class
    const widthClass = fullWidth ? 'w-full' : '';
    
    // Combine all classes
    const inputClasses = `${baseInputClasses} ${stateClasses} ${paddingClasses} ${widthClass} py-2 focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors ${className}`;
    
    return (
      <div className={`${fullWidth ? 'w-full' : ''} mb-4`}>
        {label && (
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {label}
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500">
              {leftIcon}
            </div>
          )}
          
          <input ref={ref} className={inputClasses} {...props} />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-neutral-500">
              {rightIcon}
            </div>
          )}
        </div>
        
        {error && (
          <p className="mt-1 text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;