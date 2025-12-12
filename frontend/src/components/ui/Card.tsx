import React from 'react';
import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  variant?: 'default' | 'elevated' | 'bordered' | 'glass';
  hover?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({ 
  children, 
  className = '', 
  onClick,
  variant = 'default',
  hover = false,
  padding = 'md'
}) => {
  const baseStyles = clsx(
    "rounded-xl overflow-hidden",
    "transition-all duration-200 ease-out"
  );

  const variants = {
    default: "bg-white border border-gray-100 shadow-soft",
    elevated: "bg-white shadow-soft-lg",
    bordered: "bg-white border-2 border-gray-200",
    glass: "glass border border-white/20 shadow-lg",
  };

  const paddings = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };

  const hoverStyles = hover ? clsx(
    "cursor-pointer",
    "hover:shadow-lg hover:border-gray-200",
    "hover:-translate-y-0.5"
  ) : "";

  return (
    <div 
      onClick={onClick}
      className={clsx(baseStyles, variants[variant], paddings[padding], hoverStyles, className)}
    >
      {children}
    </div>
  );
};

// Card subcomponents for structured content
export const CardHeader: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className = '' 
}) => (
  <div className={clsx("px-6 py-4 border-b border-gray-100", className)}>
    {children}
  </div>
);

export const CardTitle: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className = '' 
}) => (
  <h3 className={clsx("text-lg font-semibold text-gray-900", className)}>
    {children}
  </h3>
);

export const CardDescription: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className = '' 
}) => (
  <p className={clsx("text-sm text-gray-500 mt-1", className)}>
    {children}
  </p>
);

export const CardContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className = '' 
}) => (
  <div className={clsx("p-6", className)}>
    {children}
  </div>
);

export const CardFooter: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className = '' 
}) => (
  <div className={clsx("px-6 py-4 bg-gray-50/50 border-t border-gray-100", className)}>
    {children}
  </div>
);
