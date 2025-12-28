import React from 'react';
import { useSidebarConfig } from '../hooks/useSidebarConfig';
import { SidebarSection } from '../components/navigation/SidebarSection';
import * as Icons from 'lucide-react';
import { LayoutDashboard } from 'lucide-react';
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
  const { sidebarMode, sidebarPinned, toggleSidebarPinned } = useUserPreferences();
  const toggleSidebar = () => {
    if (onToggle) onToggle();
  };

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 left-0 z-40 transition-all duration-300 ease-out flex flex-col",
        "bg-[var(--color-bg-primary)] border-r border-[var(--color-border)]",
        isOpen ? 'w-64' : 'w-24'
      )}
    >
      {/* Header / Logo Area */}
      <div className="h-20 flex items-center justify-between px-4 border-b border-[var(--color-border)] shrink-0 group/header">
        <button 
          onClick={toggleSidebar}
          className="flex items-center gap-3 overflow-hidden transition-all duration-300 hover:opacity-80 outline-none"
        >
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-500/20 shrink-0">
            <LayoutDashboard className="w-6 h-6 text-white" />
          </div>
          {isOpen && (
            <div className="flex flex-col items-start animate-in fade-in slide-in-from-left-2 duration-300">
              <span className="text-lg font-black text-[var(--color-text-primary)] tracking-tighter leading-none">
                ERP<span className="text-primary-600">03</span>
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] font-bold uppercase tracking-widest mt-0.5">
                Enterprise
              </span>
            </div>
          )}
        </button>

        {isOpen && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSidebarPinned();
            }}
            className={clsx(
              "p-1.5 rounded-lg transition-all duration-200 animate-in fade-in zoom-in duration-300",
              sidebarPinned 
                ? "bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400 rotate-[-45deg]" 
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
            )}
            title={sidebarPinned ? "Unpin Sidebar" : "Pin Sidebar"}
          >
            <Icons.Pin className="w-4 h-4" />
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
            { label: 'Overview', path: '/company-admin/overview', icon: 'Layout' },
            { label: 'Users', path: '/company-admin/users', icon: 'User' },
            { label: 'Roles', path: '/company-admin/roles', icon: 'Shield' },
            { label: 'Modules', path: '/company-admin/modules', icon: 'Package' },
            { label: 'Features', path: '/company-admin/features', icon: 'Zap' },
            { label: 'Bundles', path: '/company-admin/bundles', icon: 'Layers' },
            { label: 'General Settings', path: '/company-admin/settings', icon: 'Settings' }
          ]}
        />
      </div>
    </aside>
  );
};
