import React from 'react';
import { useSidebarConfig } from '../hooks/useSidebarConfig';
import { SidebarSection } from '../components/navigation/SidebarSection';
import { LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react';
import { SidebarItem } from '../components/navigation/SidebarItem';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { clsx } from 'clsx';

interface SidebarProps {
  isOpen: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onNavigate }) => {
  const sections = useSidebarConfig();
  const { sidebarMode } = useUserPreferences();

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-out flex flex-col",
        "bg-[var(--color-bg-primary)] border-r border-[var(--color-border)]",
        isOpen ? 'w-64' : 'w-20'
      )}
    >
      {/* Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-[var(--color-border)] shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <LayoutDashboard className="w-5 h-5 text-white" />
          </div>
          {isOpen && (
            <span className="text-lg font-bold text-[var(--color-text-primary)] tracking-tight">
              ERP<span className="text-primary-600">03</span>
            </span>
          )}
        </div>
        {onToggle && (
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)] transition-colors"
          >
            {isOpen ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 custom-scroll">
        {sidebarMode === 'submenus' ? (
          <div className="space-y-1">
            {Object.entries(sections).map(([key, data]) => (
              <SidebarItem
                key={key}
                label={key}
                isOpen={isOpen}
                onClick={onNavigate}
                children={(data as any).items}
                iconName={(data as any).icon}
              />
            ))}
          </div>
        ) : (
          Object.entries(sections).map(([key, data]) => (
            <SidebarSection
              key={key}
              title={key}
              items={(data as any).items}
              isOpen={isOpen}
              onNavigate={onNavigate}
              iconName={(data as any).icon}
            />
          ))
        )}
      </div>

      {/* Footer - Company Settings */}
      <div className="shrink-0 p-3 border-t border-[var(--color-border)]">
        <SidebarItem
          label="Company Settings"
          iconName="Settings"
          isOpen={isOpen}
          onClick={onNavigate}
          children={[
            { label: 'Overview', path: '/company-admin/overview' },
            { label: 'Users', path: '/company-admin/users' },
            { label: 'Roles', path: '/company-admin/roles' },
            { label: 'Modules', path: '/company-admin/modules' },
            { label: 'Features', path: '/company-admin/features' },
            { label: 'Bundles', path: '/company-admin/bundles' },
            { label: 'General Settings', path: '/company-admin/settings' }
          ]}
        />
      </div>
    </aside>
  );
};
