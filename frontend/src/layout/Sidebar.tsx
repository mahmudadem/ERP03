import React from 'react';
import { useSidebarConfig } from '../hooks/useSidebarConfig';
import { SidebarSection } from '../components/navigation/SidebarSection';
import { LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onNavigate }) => {
  const sections = useSidebarConfig();

  return (
    <aside
      className={`
        fixed inset-y-0 left-0 z-40
        bg-white border-r border-gray-100
        transition-all duration-300 ease-out
        flex flex-col
        ${isOpen ? 'w-64' : 'w-20'}
      `}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          {isOpen && (
            <span className="text-lg font-bold text-gray-900 tracking-tight">
              ERP<span className="text-primary-600">03</span>
            </span>
          )}
        </div>
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 custom-scroll">
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

      {/* Footer */}
      <div className="shrink-0 p-4 border-t border-gray-100">
        {isOpen ? (
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white font-medium text-sm shadow-lg shadow-accent-500/20">
              U
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">User Name</p>
              <p className="text-xs text-gray-500 truncate">user@example.com</p>
            </div>
          </div>
        ) : (
          <div className="w-9 h-9 mx-auto rounded-full bg-gradient-to-br from-accent-400 to-accent-600 flex items-center justify-center text-white font-medium text-sm">
            U
          </div>
        )}
      </div>
    </aside>
  );
};
