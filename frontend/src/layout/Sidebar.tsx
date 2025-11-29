import React from 'react';
import { useSidebarConfig } from '../hooks/useSidebarConfig';
import { SidebarSection } from '../components/navigation/SidebarSection';

interface SidebarProps {
  isOpen: boolean;
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onNavigate }) => {
  const sections = useSidebarConfig();

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

      <div className="overflow-y-auto h-[calc(100vh-4rem)] py-2 custom-scroll">
        {Object.entries(sections).map(([key, items]) => (
          <SidebarSection
            key={key}
            title={key}
            items={items as any[]}
            isOpen={isOpen}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </aside>
  );
};
