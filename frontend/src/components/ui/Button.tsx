import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  variant = 'primary', 
  size = 'md', 
  isLoading = false,
  leftIcon,
  rightIcon,
  className = '',
  children, 
  disabled,
  ...props 
}) => {
  const baseStyles = clsx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium",
    "transition-all duration-200 ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none",
    "active:scale-[0.98]"
  );
  
  const variants = {
    primary: clsx(
      "bg-primary-600 text-white shadow-sm",
      "hover:bg-primary-700 hover:shadow-md",
      "focus-visible:ring-primary-500"
    ),
    secondary: clsx(
      "bg-white text-gray-700 border border-gray-200 shadow-sm",
      "hover:bg-gray-50 hover:border-gray-300",
      "focus-visible:ring-gray-300"
    ),
    outline: clsx(
      "bg-transparent text-primary-600 border border-primary-300",
      "hover:bg-primary-50 hover:border-primary-400",
      "focus-visible:ring-primary-500"
    ),
    danger: clsx(
      "bg-danger-600 text-white shadow-sm",
      "hover:bg-danger-700 hover:shadow-md",
      "focus-visible:ring-danger-500"
    ),
    success: clsx(
      "bg-success-600 text-white shadow-sm",
      "hover:bg-success-700 hover:shadow-md",
      "focus-visible:ring-success-500"
    ),
    ghost: clsx(
      "bg-transparent text-gray-600",
      "hover:bg-gray-100 hover:text-gray-900",
      "focus-visible:ring-gray-300"
    ),
  };

  const sizes = {
    xs: "h-7 px-2 text-xs",
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };

  return (
    <button 
      className={clsx(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};
