import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'secondary', 
  icon, 
  className = '', 
  ...props 
}) => {
  const baseStyles = "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded transition-colors border shadow-sm select-none";
  
  const variants = {
    primary: "bg-blue-600 text-white border-blue-700 hover:bg-blue-700",
    secondary: "bg-white text-gray-700 border-gray-300 hover:bg-gray-50",
    danger: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100",
    ghost: "bg-transparent text-gray-600 border-transparent shadow-none hover:bg-gray-100"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${className}`} 
      {...props}
    >
      {icon && <span className="w-4 h-4">{icon}</span>}
      {children}
    </button>
  );
};