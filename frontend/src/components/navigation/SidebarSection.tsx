import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { resolveSidebarIcon } from './sidebarIcons';

interface SidebarItemData {
  path?: string;
  label: string;
  icon?: string;
  badge?: string;
  children?: SidebarItemData[];
}

interface SidebarSectionProps {
  title: string;
  items: SidebarItemData[];
  isOpen: boolean; // Sidebar open/closed state
  iconName?: string;
  onNavigate?: () => void;
  defaultExpanded?: boolean;
  path?: string; // Optional path for top-level direct links
  isCompact?: boolean;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({ 
  title, 
  items, 
  isOpen, 
  iconName,
  onNavigate,
  defaultExpanded = false,
  path,
  isCompact = false
}) => {
  const { appearanceSettings } = useUserPreferences();
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const InlineChevron = isRtl ? ChevronLeft : ChevronRight;
  
  const use3DStyle = appearanceSettings?.id === 'tailwind-play';
  const isContrastSidebar = appearanceSettings?.sidebarSurface === 'contrast';

  // Phosphor Duotone across the whole sidebar (single icon set everywhere).
  // resolveSidebarIcon falls back to Lucide for any name without a Phosphor
  // mapping so unmapped entries still render.
  const ResolvedIcon = resolveSidebarIcon(iconName);

  const location = useLocation();
  const isActivePath = (targetPath: string) => {
    const [pathname, queryString] = targetPath.split('?');
    const currentPath = location.pathname;
    const currentQuery = location.search.substring(1);
    if (currentPath !== pathname) return false;
    return (currentQuery || '') === (queryString || '');
  };

  const isChildActive = (item: SidebarItemData): boolean => {
    if (item.path && isActivePath(item.path)) return true;
    if (item.children && item.children.some(child => isChildActive(child))) return true;
    return false;
  };

  const isSectionActive = path ? isActivePath(path) : items.some(item => isChildActive(item));

  const [isExpanded, setIsExpanded] = useState(defaultExpanded || isSectionActive);

  React.useEffect(() => {
    if (isSectionActive) {
      setIsExpanded(true);
    }
  }, [isSectionActive]);

  if (items.length === 0 && !path) return null;

  const toggleExpand = () => setIsExpanded((prev) => !prev);

  const headerClass = clsx(
    "w-full flex transition-colors duration-300 ease-out",
    isOpen 
      ? isCompact 
        ? "flex-row items-center gap-2 px-3 py-1.5"
        : "flex-row items-center gap-3 px-4 py-2"
      : "flex-col items-center gap-1.5 px-2 py-3 justify-center",
    isCompact
      ? "text-[10px] font-semibold text-[var(--app-sidebar-muted)] uppercase tracking-wider"
      : "text-[11px] font-bold text-[var(--app-sidebar-muted)] uppercase tracking-wider",
    isContrastSidebar
      ? "hover:text-[var(--app-sidebar-text)] hover:bg-white/10 group"
      : "hover:text-[var(--app-sidebar-text)] hover:bg-black/5 dark:hover:bg-white/5 group"
  );

  const renderHeaderContent = (isActiveLink = false) => {
    const isActive = isActiveLink || isSectionActive;

    return (
      <>
        {ResolvedIcon && (
          <div className={clsx(
            "pointer-events-none rounded-[var(--radius-md)] transition-colors duration-300 flex items-center justify-center shrink-0",
            isOpen
              ? isActiveLink
                ? isCompact
                  ? "p-1 bg-white/20 text-primary-600"
                  : "p-1.5 bg-white/20 text-white"           // direct active route → row is blue, pill is translucent white
                : isSectionActive
                  ? isContrastSidebar
                    ? "p-1.5 bg-white/20 text-white"
                    : "p-1.5 bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"  // child is active → soft brand tint
                  : isCompact
                    ? isContrastSidebar
                      ? "p-1 bg-white/10 text-[var(--app-sidebar-muted)]"
                      : "p-1 bg-[var(--color-bg-tertiary)]"
                    : isContrastSidebar
                      ? "p-1.5 bg-white/10 text-[var(--app-sidebar-muted)]"
                      : "p-1.5 bg-[var(--color-bg-tertiary)]"
              : use3DStyle
                ? isActive
                  ? "w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-primary-600"
                  : isContrastSidebar
                    ? "w-10 h-10 bg-white/10 text-[var(--app-sidebar-muted)] hover:bg-white/15"
                    : "w-10 h-10 bg-[var(--color-bg-tertiary)] text-[var(--app-sidebar-muted)] hover:bg-white dark:hover:bg-slate-800 hover:border hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm"
                : isActiveLink
                  ? isCompact
                    ? isContrastSidebar
                      ? "w-8 h-8 bg-white/25 text-white shadow-sm"
                      : "w-8 h-8 bg-primary-600 text-white shadow-sm dark:bg-primary-500"
                    : isContrastSidebar
                      ? "w-10 h-10 bg-white/25 text-white shadow-sm"
                      : "w-10 h-10 bg-primary-600 text-white shadow-sm dark:bg-primary-500"
                  : isSectionActive
                    ? isCompact
                      ? isContrastSidebar
                        ? "w-8 h-8 bg-white/20 text-white shadow-sm"
                        : "w-8 h-8 bg-primary-100 text-primary-700 shadow-sm dark:bg-primary-900/40 dark:text-primary-300"
                      : isContrastSidebar
                        ? "w-10 h-10 bg-white/20 text-white shadow-sm"
                        : "w-10 h-10 bg-primary-100 text-primary-700 shadow-sm dark:bg-primary-900/40 dark:text-primary-300"
                    : isCompact
                      ? isContrastSidebar
                        ? "w-8 h-8 bg-white/10 text-[var(--app-sidebar-muted)] shadow-sm"
                        : "w-8 h-8 bg-primary-50 dark:bg-primary-900/20 text-primary-600 shadow-sm"
                      : isContrastSidebar
                        ? "w-10 h-10 bg-white/10 text-[var(--app-sidebar-muted)] shadow-sm"
                        : "w-10 h-10 bg-primary-50 dark:bg-primary-900/20 text-primary-600 shadow-sm"
          )}>
            <ResolvedIcon
              className={clsx(
                isOpen 
                  ? isCompact 
                    ? "w-4 h-4" 
                    : "w-5 h-5" 
                  : "w-6 h-6",
                "transition-colors duration-200"
              )}
            />
          </div>
        )}
      
        {isOpen ? (
          <>
            <span className={clsx("pointer-events-none truncate flex-1", isRtl ? "text-right" : "text-left")}>{title}</span>
            {!path && (isExpanded 
              ? <ChevronDown className="pointer-events-none w-3 h-3 text-gray-400 shrink-0" /> 
              : <InlineChevron className="pointer-events-none w-3 h-3 text-gray-400 shrink-0" />
            )}
          </>
        ) : (
          <span className="pointer-events-none text-[9px] font-black uppercase tracking-tighter text-center w-full truncate px-1">
            {title}
          </span>
        )}
      </>
    );
  };

  const showSeparator = isCompact && ['Reports', 'Tools', 'Settings'].includes(title);

  return (
    <div className="mb-2">
      {showSeparator && (
        <div className="px-3 py-1">
          <div className="h-px bg-[var(--color-border)] opacity-60" />
        </div>
      )}
      {/* Section Header */}
      {path ? (
        <NavLink
          to={path}
          onClick={onNavigate}
          className={({ isActive }) => clsx(
            headerClass,
            isActive && (
              use3DStyle
                ? "bg-transparent text-primary-600 font-bold"
                : isCompact
                  ? "sidebar-item-active text-primary-600 dark:text-primary-400 font-semibold"
                  : "bg-primary-600 text-white shadow-sm dark:bg-primary-500"
            )
          )}
        >
          {({ isActive }) => renderHeaderContent(isActive)}
        </NavLink>
      ) : (
        <button
          onClick={toggleExpand}
          className={clsx(
            headerClass,
            // Section contains the active route — soft brand tint so the
            // parent acknowledges it without competing with the child's
            // solid-fill active row.
            isSectionActive && !use3DStyle && "text-primary-700 dark:text-primary-300"
          )}
        >
          {renderHeaderContent(false)}
        </button>
      )}

      {/* Items List - Conditionally Rendered */}
      {isExpanded && (
        <div className={clsx(
          "space-y-0.5 mt-1 transition-all duration-300",
          isOpen && (
            isRtl
              ? "mr-6 border-r border-[var(--color-border)] pr-[1px]"
              : "ml-6 border-l border-[var(--color-border)] pl-[1px]"
          )
        )}>
          {items.map((item, idx) => (
            <SidebarItem
              key={item.path || `${item.label}-${idx}`}
              path={item.path || ''}
              label={item.label}
              isOpen={isOpen}
              onClick={onNavigate}
              children={item.children}
              iconName={item.icon}
              badge={item.badge}
              isCompact={isCompact}
            />
          ))}
        </div>
      )}
    </div>
  );
};
