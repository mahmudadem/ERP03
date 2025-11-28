import React from 'react';
import { NavItem } from '../../types';

interface SidebarProps {
  navItems: NavItem[];
  isOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ navItems, isOpen }) => {
  return (
    <aside
      className={`
        fixed left-0 top-0 h-full bg-primary text-white transition-all duration-300 z-20
        ${isOpen ? 'w-64' : 'w-16'}
      `}
    >
      <div className="h-16 flex items-center justify-center border-b border-gray-700">
        <span className={`font-bold text-xl ${!isOpen && 'hidden'}`}>ERP System</span>
        <span className={`font-bold text-xl ${isOpen && 'hidden'}`}>E</span>
      </div>

      <nav className="mt-4 flex flex-col gap-1 px-2">
        {navItems.map((item) => (
          <a
            key={item.path}
            href={`#${item.path}`}
            className="flex items-center gap-4 p-2 rounded hover:bg-secondary transition-colors"
          >
            <div className="w-6 h-6 bg-gray-600 rounded-full flex-shrink-0 flex items-center justify-center text-xs">
              {item.label.charAt(0)}
            </div>
            {isOpen && <span className="whitespace-nowrap">{item.label}</span>}
          </a>
        ))}
      </nav>
    </aside>
  );
};