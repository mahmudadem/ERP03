import React from 'react';
import { NavLink } from 'react-router-dom';
import { useSidebarConfig } from '../hooks/useSidebarConfig';

interface SidebarProps {
  isOpen: boolean;
  onNavigate?: () => void; // Called when a link is clicked (e.g., to close mobile menu)
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onNavigate }) => {
  const sections = useSidebarConfig();

  // Helper to render a group
  const renderGroup = (title: string, items: any[]) => {
    if (items.length === 0) return null;
    return (
      <div className="mb-6" key={title}>
        <h3 className={`px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ${!isOpen && 'hidden'}`}>
          {title}
        </h3>
        <div className="space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onNavigate}
              className={({ isActive }) => `
                flex items-center gap-3 px-4 py-2 text-sm transition-colors rounded mx-2
                ${isActive 
                  ? 'bg-blue-50 text-blue-700 font-medium' 
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
              `}
            >
              <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center ${!isOpen && 'mx-auto'}`}>
                {/* Fallback Icon */}
                <span className="text-lg leading-none opacity-70">
                   {item.label.charAt(0)}
                </span>
              </div>
              <span className={`whitespace-nowrap ${!isOpen && 'hidden'}`}>
                {item.label}
              </span>
            </NavLink>
          ))}
        </div>
      </div>
    );
  };

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 bg-white border-r border-gray-200 z-30 transition-all duration-300
        ${isOpen ? 'w-64 translate-x-0' : 'w-20 -translate-x-full lg:translate-x-0'}
      `}
    >
      <div className="h-16 flex items-center justify-center border-b border-gray-100 mb-4">
        <span className="text-xl font-extrabold text-blue-600 tracking-tight">
          {isOpen ? 'ERP Enhanced' : 'E'}
        </span>
      </div>

      <div className="overflow-y-auto h-[calc(100vh-4rem)] py-2">
        {Object.entries(sections).map(([key, items]) => renderGroup(key, items as any[]))}
      </div>
    </aside>
  );
};