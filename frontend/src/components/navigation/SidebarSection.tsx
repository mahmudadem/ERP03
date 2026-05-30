import React, { useState } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { clsx } from 'clsx';
import * as Icons from 'lucide-react';
import {
  FcHome,
  FcMoneyTransfer,
  FcShop,
  FcShipped,
  FcPackage,
  FcConferenceCall,
  FcBusinessContact,
  FcTabletAndroid,
  FcFactory,
  FcBriefcase,
  FcEngineering,
  FcAssistant,
  FcSettings,
  FcDepartment,
  FcLock,
  FcStatistics,
} from 'react-icons/fc';
import { useTranslation } from 'react-i18next';
import { NavLink, useLocation } from 'react-router-dom';
import { useUserPreferences } from '../../hooks/useUserPreferences';

// Module-header icons get the colorful Flat Color (Icons8) treatment so each
// module anchors visually in the sidebar. Sub-items keep their monochrome
// Lucide icons. The map keys are the Lucide icon names declared in
// moduleMenuMap.ts so the existing config doesn't change.
const FLAT_COLOR_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Home: FcHome,
  HandCoins: FcMoneyTransfer,           // Accounting
  ShoppingCart: FcShop,                 // Sales
  ClipboardList: FcShipped,             // Purchases
  Package: FcPackage,                   // Inventory
  Users: FcConferenceCall,              // HR
  UsersRound: FcBusinessContact,        // CRM (if used)
  Monitor: FcTabletAndroid,             // POS
  Factory: FcFactory,                   // Manufacturing
  Briefcase: FcBriefcase,               // Projects
  Wrench: FcEngineering,                // Tools
  Bot: FcAssistant,                     // AI Assistant
  Settings: FcSettings,                 // System / Settings
  Building2: FcDepartment,              // Companies (super-admin)
  Shield: FcLock,                       // Permissions (super-admin)
  BarChart3: FcStatistics,              // Reports
};

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
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({ 
  title, 
  items, 
  isOpen, 
  iconName,
  onNavigate,
  defaultExpanded = false,
  path
}) => {
  const { appearanceSettings } = useUserPreferences();
  const { i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const InlineChevron = isRtl ? ChevronLeft : ChevronRight;
  
  const use3DStyle = appearanceSettings?.id === 'tailwind-play';

  // Prefer colorful Flat Color icon for module headers; fall back to Lucide
  // when no FC mapping exists for the given icon name.
  const FlatColorIcon = iconName ? FLAT_COLOR_ICONS[iconName] : null;
  const ResolvedIcon = iconName ? (Icons as any)[iconName] : null;

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
    "w-full flex transition-all duration-300 ease-out",
    isOpen ? "flex-row items-center gap-3 px-4 py-2" : "flex-col items-center gap-1.5 px-2 py-3 justify-center",
    "text-[11px] font-bold text-[var(--app-sidebar-muted)] uppercase tracking-wider",
    "hover:text-[var(--app-sidebar-text)] hover:bg-[var(--color-bg-tertiary)]/50 group"
  );

  const renderHeaderContent = (isActiveLink = false) => {
    const isActive = isActiveLink || isSectionActive;

    return (
      <>
        {(FlatColorIcon || ResolvedIcon) && (
          <div className={clsx(
            "rounded-[var(--radius-md)] transition-all duration-300 flex items-center justify-center shrink-0",
            // FlatColorIcons carry their own color, so they don't need the tinted
            // background pill — render against a plain transparent container.
            FlatColorIcon
              ? (isOpen ? "p-0.5" : "w-10 h-10")
              : isOpen
                ? "p-1.5 bg-[var(--color-bg-tertiary)]"
                : use3DStyle
                  ? isActive
                    ? "w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-primary-600"
                    : "w-10 h-10 bg-[var(--color-bg-tertiary)] text-[var(--app-sidebar-muted)] hover:bg-white dark:hover:bg-slate-800 hover:border hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm"
                  : "w-10 h-10 bg-primary-50 dark:bg-primary-900/20 text-primary-600 shadow-sm",

            !FlatColorIcon && !use3DStyle && "group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:text-primary-600",
            !FlatColorIcon && !use3DStyle && (isActiveLink || (isOpen && !isExpanded)) && "bg-primary-50 dark:bg-primary-900/20 text-primary-600"
          )}>
            {FlatColorIcon ? (
              <FlatColorIcon
                className={clsx(
                  isOpen ? "w-6 h-6" : "w-8 h-8",
                  "transition-transform duration-200 group-hover:scale-110"
                )}
              />
            ) : (
              <ResolvedIcon
                className={clsx(
                  isOpen ? "w-4 h-4" : "w-6 h-6",
                  "transition-transform duration-200 group-hover:scale-110"
                )}
                strokeWidth={1.75}
              />
            )}
          </div>
        )}
      
        {isOpen ? (
          <>
            <span className={clsx("truncate flex-1", isRtl ? "text-right" : "text-left")}>{title}</span>
            {!path && (isExpanded 
              ? <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" /> 
              : <InlineChevron className="w-3 h-3 text-gray-400 shrink-0" />
            )}
          </>
        ) : (
          <span className="text-[9px] font-black uppercase tracking-tighter text-center w-full truncate px-1">
            {title}
          </span>
        )}
      </>
    );
  };

  return (
    <div className="mb-2">
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
                : "bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400"
            )
          )}
        >
          {({ isActive }) => renderHeaderContent(isActive)}
        </NavLink>
      ) : (
        <button 
          onClick={toggleExpand}
          className={headerClass}
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
            />
          ))}
        </div>
      )}
    </div>
  );
};
