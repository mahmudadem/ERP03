import React, { useId } from 'react';
import { clsx } from 'clsx';

interface SpinnerProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'secondary' | 'white' | 'indigo' | 'slate';
  className?: string;
}

export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'primary',
  className = '',
}) => {
  const gradientId = useId();

  const sizeClasses = {
    xs: 'h-3.5 w-3.5',
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  const variantClasses = {
    primary: 'text-primary-600 dark:text-primary-400',
    secondary: 'text-gray-500 dark:text-gray-400',
    white: 'text-white',
    indigo: 'text-indigo-600 dark:text-indigo-400',
    slate: 'text-slate-900 dark:text-slate-100',
  };

  return (
    <svg 
      className={clsx('animate-spin', sizeClasses[size], variantClasses[variant], className)} 
      viewBox="0 0 32 32"
      fill="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="1" />
          <stop offset="50%" stopColor="currentColor" stopOpacity="0.4" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle 
        cx="16" 
        cy="16" 
        r="14" 
        stroke={`url(#${gradientId})`} 
        strokeWidth="3" 
        strokeLinecap="round" 
      />
    </svg>
  );
};
