import React from 'react';
import { NavLink } from 'react-router-dom';

interface SidebarItemProps {
  path: string;
  label: string;
  isOpen: boolean;
  onClick?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ path, label, isOpen, onClick }) => {
  return (
    <NavLink
      to={path}
      onClick={onClick}
      className={({ isActive }) => `
        flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded mx-2
        ${isActive 
          ? 'bg-blue-50 text-blue-700 font-medium' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
      `}
      title={!isOpen ? label : undefined}
    >
      <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center ${!isOpen && 'mx-auto'}`}>
        <span className="text-lg leading-none opacity-70">
           {label.charAt(0)}
        </span>
      </div>
      <span className={`whitespace-nowrap ${!isOpen && 'hidden'}`}>
        {label}
      </span>
    </NavLink>
  );
};