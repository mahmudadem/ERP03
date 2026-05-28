import React from 'react';
import { useSidebarConfig } from '../hooks/useSidebarConfig';
import { SidebarSection } from '../components/navigation/SidebarSection';
import * as Icons from 'lucide-react';
import { LayoutDashboard } from 'lucide-react';
import { SidebarItem } from '../components/navigation/SidebarItem';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

interface SidebarProps {
  isOpen: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onNavigate }) => {
  const sections = useSidebarConfig();
  const { sidebarMode, sidebarPinned, toggleSidebarPinned, appearanceSettings } = useUserPreferences();
  const { t, i18n } = useTranslation('common');
  const isRtl = i18n.dir() === 'rtl';
  const toggleSidebar = () => {
    if (onToggle) onToggle();
  };

  const [searchQuery, setSearchQuery] = React.useState('');
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredSections = React.useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const query = searchQuery.toLowerCase().trim();
    const result: typeof sections = {};

    Object.entries(sections).forEach(([key, section]) => {
      const sectionMatches = key.toLowerCase().includes(query);
      if (sectionMatches) {
        result[key] = section;
        return;
      }

      const filteredItems = (section.items || []).filter(item => {
        const itemMatches = item.label.toLowerCase().includes(query);
        const hasMatchingChild = (item.children || []).some(child =>
          child.label.toLowerCase().includes(query)
        );
        return itemMatches || hasMatchingChild;
      }).map(item => {
        const filteredChildren = (item.children || []).filter(child =>
          child.label.toLowerCase().includes(query)
        );
        if (filteredChildren.length > 0) {
          return { ...item, children: filteredChildren };
        }
        return item;
      });

      if (filteredItems.length > 0 || (section.path && section.path.toLowerCase().includes(query))) {
        result[key] = {
          ...section,
          items: filteredItems
        };
      }
    });

    return result;
  }, [sections, searchQuery]);

  const isTailwindPlayTheme = appearanceSettings?.id === 'tailwind-play';

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 z-40 flex flex-col print:hidden",
        "bg-[var(--app-sidebar-surface)] border-[var(--color-border)]",
        "transition-all duration-300 ease-out",
        isRtl
          ? [
              "right-0 border-l",
              "lg:w-[var(--app-sidebar-width)] lg:translate-x-0",
              "w-64",
              isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
            ]
          : [
              "left-0 border-r",
              "lg:w-[var(--app-sidebar-width)] lg:translate-x-0",
              "w-64",
              isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
            ]
      )}
    >
      {/* Header / Logo Area */}
      <div className={clsx(
        "flex items-center justify-between px-4 shrink-0 group/header",
        isTailwindPlayTheme ? "h-16 border-b-0" : "h-20 border-b border-[var(--color-border)]"
      )}>
        <button 
          onClick={toggleSidebar}
          className="flex items-center gap-3 overflow-hidden transition-all duration-300 hover:opacity-80 outline-none"
        >
          <div className={clsx(
            "rounded-[var(--radius-md)] bg-primary-600 flex items-center justify-center shrink-0",
            isTailwindPlayTheme ? "w-6 h-6" : "w-10 h-10 shadow-lg shadow-primary-500/20"
          )}>
            <LayoutDashboard className={clsx("text-white", isTailwindPlayTheme ? "w-4 h-4" : "w-6 h-6")} />
          </div>
          {isOpen && (
            <div className="flex flex-col items-start animate-in fade-in slide-in-from-left-2 duration-300">
              <span className="text-lg font-black text-[var(--app-sidebar-text)] tracking-tighter leading-none">
                ERP<span className="text-primary-600">03</span>
              </span>
              {!isTailwindPlayTheme && (
                <span className="text-[10px] text-[var(--app-sidebar-muted)] font-bold uppercase tracking-widest mt-0.5">
                  Enterprise
                </span>
              )}
            </div>
          )}
        </button>

        {isOpen && !isTailwindPlayTheme && (
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

      {/* Search Area */}
      {isOpen && (
        <div className="px-4 mb-4 shrink-0">
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('sidebar.search', { defaultValue: 'Search (Ctrl + G)' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={clsx(
                "w-full px-3 py-1.5 text-xs bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500",
                isTailwindPlayTheme && "font-mono font-medium rounded-[var(--radius-sm)] shadow-sm"
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <Icons.X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4 px-3 custom-scroll">
        {isOpen && isTailwindPlayTheme && (
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 mb-2">
            MODULES
          </div>
        )}
        {sidebarMode === 'submenus' ? (
          <div className="space-y-1">
            {Object.entries(filteredSections).map(([key, data]) => (
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
          Object.entries(filteredSections).map(([key, data]) => (
            <SidebarSection
              key={key}
              title={key}
              items={(data as any).items}
              isOpen={isOpen}
              onNavigate={onNavigate}
              iconName={(data as any).icon}
              path={(data as any).path}
            />
          ))
        )}
      </div>

      {/* Footer - Company Settings */}
      <div className="shrink-0 p-3 border-t border-[var(--color-border)]">
        <SidebarItem
          label={t('sidebar.companySettings')}
          iconName="Settings"
          isOpen={isOpen}
          onClick={onNavigate}
          children={[
            { label: t('sidebar.overview'), path: '/company-admin/overview', icon: 'Layout' },
            { label: t('sidebar.users'), path: '/company-admin/users', icon: 'User' },
            { label: t('sidebar.roles'), path: '/company-admin/roles', icon: 'Shield' },
            { label: t('sidebar.modules'), path: '/company-admin/modules', icon: 'Package' },
            { label: t('sidebar.features'), path: '/company-admin/features', icon: 'Zap' },
            { label: t('sidebar.bundles'), path: '/company-admin/bundles', icon: 'Layers' },
            { label: t('sidebar.currencies'), path: '/system/currencies', icon: 'Coins' },
            { label: 'Tax Codes', path: '/settings/tax-codes', icon: 'Percent' },
            { label: t('sidebar.notifications'), path: '/settings/notifications', icon: 'Bell' },
            { label: t('sidebar.generalSettings'), path: '/company-admin/settings', icon: 'Settings' }
          ]}
        />
      </div>
    </aside>
  );
};
