import React from 'react';
import { useSidebarConfig } from '../hooks/useSidebarConfig';
import { SidebarSection } from '../components/navigation/SidebarSection';
import * as Icons from 'lucide-react';
import { LayoutDashboard } from 'lucide-react';
import { SidebarItem } from '../components/navigation/SidebarItem';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { useBreakpoint } from '../hooks/useBreakpoint';

interface SidebarProps {
  isOpen: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, onNavigate }) => {
  const sections = useSidebarConfig();
  const { sidebarMode, sidebarPinned, toggleSidebarPinned, appearanceSettings, layoutMode } = useUserPreferences();
  const isCompact = layoutMode === 'compact';
  const { t, i18n } = useTranslation('common');
  const isRtl = i18n.dir() === 'rtl';
  const isDesktop = useBreakpoint('lg');
  const isPinnedAndDocked = sidebarPinned && isDesktop;
  const isFlyoutMode = sidebarMode === 'submenus';

  const [isHovered, setIsHovered] = React.useState(false);
  const isSidebarExpanded = isOpen || (isHovered && isFlyoutMode && isDesktop);

  // When the user clicks a nav item the cursor stays inside the sidebar,
  // so onMouseLeave never fires. Reset isHovered here so the sidebar
  // collapses immediately after navigation instead of waiting for mouse-out.
  const handleNavigate = React.useCallback(() => {
    setIsHovered(false);
    if (onNavigate) onNavigate();
  }, [onNavigate]);

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

  // Determine classes based on mode (flyout vs accordion) and screen sizes
  let asideClasses: string[] = [];
  if (isFlyoutMode) {
    // Flyout Mode: has a persistent narrow icon-strip on desktop when closed
    if (isDesktop) {
      asideClasses = [
        "top-12 bottom-0 z-30",
        isRtl ? "right-0 border-l" : "left-0 border-r",
        isSidebarExpanded ? "w-[var(--app-sidebar-width)]" : "w-20",
        (isSidebarExpanded && !sidebarPinned) ? "shadow-xl" : "",
        "translate-x-0",
      ];
    } else {
      // Mobile: standard slide-over drawer
      asideClasses = [
        "top-0 bottom-0 z-50",
        isRtl ? "right-0 border-l" : "left-0 border-r",
        "w-56 shadow-2xl",
        isSidebarExpanded ? "translate-x-0" : (isRtl ? "translate-x-full" : "-translate-x-full"),
      ];
    }
  } else {
    // Accordion Mode: either fully shown or fully hidden (no narrow strip when closed)
    if (isPinnedAndDocked) {
      asideClasses = [
        "top-12 bottom-0 z-30",
        isRtl ? "right-0 border-l" : "left-0 border-r",
        "w-[var(--app-sidebar-width)]",
        isSidebarExpanded ? "translate-x-0" : (isRtl ? "translate-x-full" : "-translate-x-full"),
      ];
    } else {
      // Mobile or unpinned overlay: standard overlay drawer
      asideClasses = [
        "top-0 bottom-0 z-50",
        isRtl ? "right-0 border-l" : "left-0 border-r",
        "w-72 shadow-2xl",
        isSidebarExpanded ? "translate-x-0" : (isRtl ? "translate-x-full" : "-translate-x-full"),
      ];
    }
  }

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={clsx(
        "fixed flex flex-col print:hidden bg-[var(--app-sidebar-surface)] border-[var(--color-border)] transition-all duration-300 ease-out",
        !isFlyoutMode && "main-sidebar-accordion",
        asideClasses
      )}
    >
      {/* Header Area with Pin & Close Buttons */}
      <div className={clsx(
        "h-12 flex items-center shrink-0 border-b border-[var(--color-border)]",
        !isFlyoutMode && "bg-white/80",
        isSidebarExpanded ? "justify-between px-4" : "justify-center px-2"
      )}>
        {/* Pin button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleSidebarPinned();
          }}
          className={clsx(
            "p-1.5 rounded-lg transition-all duration-200",
            sidebarPinned 
              ? "bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-400 rotate-[-45deg]" 
              : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]"
          )}
          title={sidebarPinned ? t('sidebar.unpin', 'Unpin Sidebar') : t('sidebar.pin', 'Pin Sidebar')}
        >
          <Icons.Pin className="w-4 h-4" />
        </button>

        {/* Close button */}
        {isSidebarExpanded && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)] transition-all duration-200"
            title={t('sidebar.close', 'Close Sidebar')}
          >
            <Icons.X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Area */}
      {isSidebarExpanded && (
        <div className={clsx("px-4 mb-4 shrink-0", !isFlyoutMode && "mt-4")}>
          <div className="relative">
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t('sidebar.search', 'Search (Ctrl + G)')}
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
      <div className={clsx("flex-1 overflow-y-auto px-3 custom-scroll", !isFlyoutMode ? "py-3 space-y-1" : "py-4")}>
        {isSidebarExpanded && isTailwindPlayTheme && (
          <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-4 mb-2">
            {t('sidebar.modulesTitle', 'Modules')}
          </div>
        )}
        {sidebarMode === 'submenus' ? (
          <div className="space-y-1">
            {Object.entries(filteredSections).map(([key, data]) => (
              <SidebarItem
                key={key}
                label={key}
                isOpen={isSidebarExpanded}
                onClick={handleNavigate}
                children={(data as any).items}
                iconName={(data as any).icon}
                isCompact={isCompact}
              />
            ))}
          </div>
        ) : (
          Object.entries(filteredSections).map(([key, data]) => (
            <SidebarSection
              key={key}
              title={key}
              items={(data as any).items}
              isOpen={isSidebarExpanded}
              onNavigate={handleNavigate}
              iconName={(data as any).icon}
              path={(data as any).path}
              isCompact={isCompact}
            />
          ))
        )}
      </div>

      {/* Footer - Company Settings */}
      <div className="shrink-0 p-3 border-t border-[var(--color-border)]">
        <SidebarItem
          label={t('sidebar.companySettings')}
          iconName="Settings"
          isOpen={isSidebarExpanded}
          onClick={onNavigate}
          isCompact={isCompact}
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
            { label: t('sidebar.communications', { defaultValue: 'Communications' }), path: '/settings/communications', icon: 'MessageSquare' },
            { label: t('sidebar.generalSettings'), path: '/company-admin/settings', icon: 'Settings' }
          ]}
        />
      </div>
    </aside>
  );
};
