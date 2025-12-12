import React, { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(({ 
  label, 
  error, 
  hint,
  leftIcon,
  rightIcon,
  className = '', 
  ...props 
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {props.required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          className={clsx(
            "w-full rounded-lg border bg-white px-3 py-2.5 text-sm",
            "transition-all duration-200 ease-out",
            "placeholder:text-gray-400",
            "focus:outline-none focus:ring-2 focus:ring-offset-0",
            "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
            leftIcon && "pl-10",
            rightIcon && "pr-10",
            error 
              ? "border-danger-300 text-danger-900 focus:border-danger-500 focus:ring-danger-500/20" 
              : "border-gray-200 focus:border-primary-500 focus:ring-primary-500/20",
            className
          )}
          {...props}
        />
        {rightIcon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            {rightIcon}
          </div>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-xs font-medium text-danger-600 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ 
  label, 
  error, 
  hint,
  className = '', 
  ...props 
}, ref) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
          {props.required && <span className="text-danger-500 ml-0.5">*</span>}
        </label>
      )}
      <textarea
        ref={ref}
        className={clsx(
          "w-full rounded-lg border bg-white px-3 py-2.5 text-sm min-h-[100px] resize-y",
          "transition-all duration-200 ease-out",
          "placeholder:text-gray-400",
          "focus:outline-none focus:ring-2 focus:ring-offset-0",
          "disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed",
          error 
            ? "border-danger-300 text-danger-900 focus:border-danger-500 focus:ring-danger-500/20" 
            : "border-gray-200 focus:border-primary-500 focus:ring-primary-500/20",
          className
        )}
        {...props}
      />
      {error && (
        <p className="mt-1.5 text-xs font-medium text-danger-600 flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="mt-1.5 text-xs text-gray-500">{hint}</p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';
