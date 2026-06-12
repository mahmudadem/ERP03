import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { ChevronDown, ChevronRight, ChevronLeft } from 'lucide-react';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { Portal } from '@headlessui/react';
import { useTranslation } from 'react-i18next';
import { resolveSidebarIcon } from './sidebarIcons';


interface SidebarItemProps {
  path?: string;
  label: string;
  isOpen: boolean;
  icon?: React.ReactNode;
  iconName?: string;
  onClick?: () => void;
  children?: any[]; 
  isFlyout?: boolean;
  isChild?: boolean;
  badge?: string;
  isCompact?: boolean;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ 
  path, 
  label, 
  isOpen, 
  icon,
  iconName,
  onClick,
  children,
  isFlyout = false,
  isChild = false,
  badge,
  isCompact = false
}) => {
  const location = useLocation();
  const { sidebarMode, appearanceSettings } = useUserPreferences();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.dir() === 'rtl';
  const InlineChevron = isRtl ? ChevronLeft : ChevronRight;
  
  const use3DStyle = appearanceSettings?.id === 'tailwind-play';
  const isContrastSidebar = appearanceSettings?.sidebarSurface === 'contrast';

  // Phosphor Duotone icons across the whole sidebar. resolveSidebarIcon
  // returns a Phosphor component for known names, falling back to Lucide for
  // anything not yet mapped.
  const ResolvedIcon = resolveSidebarIcon(iconName);
  const finalIcon = icon || (ResolvedIcon ? <ResolvedIcon className="w-4 h-4" /> : null);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const hasChildren = children && children.length > 0;
  const isSubmenusMode = sidebarMode === 'submenus';
  const useApexAccordionLook = !isSubmenusMode;
  
  // Custom active check
  const isActive = (targetPath: string) => {
    const [pathname, queryString] = targetPath.split('?');
    const currentPath = location.pathname;
    const currentQuery = location.search.substring(1);
    if (currentPath !== pathname) return false;
    return (currentQuery || '') === (queryString || '');
  };
  
  const active = path ? isActive(path) : false;

  // Deep recursive descendant check.
  // isAnyChildActive is true when ANY descendant at ANY depth is the active route.
  // This gives grandparent / great-grandparent items the soft "ancestor" tint.
  const checkDeepActive = (items: any[]): boolean =>
    items.some((child: any) =>
      (child.path && isActive(child.path)) ||
      (child.children?.length && checkDeepActive(child.children))
    );
  const isAnyChildActive = hasChildren ? checkDeepActive(children!) : false;

  // RULE: only the EXACT current-route item gets a solid/strong highlight.
  // Every ancestor node (parent, grandparent…) gets the soft tint via isAnyChildActive.
  const isSolidActive = active;

  // Auto-expand for classic mode
  React.useEffect(() => {
    if (!isSubmenusMode && isAnyChildActive) {
      setIsExpanded(true);
    }
  }, [isAnyChildActive, isSubmenusMode]);

  const itemRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState({ top: 0, left: 0, right: 0, bottom: 0 });
  const [showFlyout, setShowFlyout] = React.useState(false);
  const [opensUpward, setOpensUpward] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const updateCoords = () => {
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom
      });
      
      // Determine direction: if bottom half of screen, default to upward for long menus
      // (Simplified logic: if below 60% of vertical height, consider upward flip)
      const viewportHeight = window.innerHeight;
      const isLowOnScreen = rect.top > viewportHeight * 0.6;
      setOpensUpward(isLowOnScreen);
    }
  };

  const handleMouseEnter = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    updateCoords();
    setShowFlyout(true);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    timerRef.current = setTimeout(() => {
      setShowFlyout(false);
    }, 150); // Small delay to allow moving mouse to the flyout
  };

  React.useEffect(() => {
    if (showFlyout && isSubmenusMode) {
      updateCoords();
      window.addEventListener('scroll', updateCoords, true);
      return () => {
        window.removeEventListener('scroll', updateCoords, true);
        if (timerRef.current) clearTimeout(timerRef.current);
      };
    }
  }, [showFlyout, isSubmenusMode]);

  const itemContent = (
    <div className={clsx(
      "flex items-center rounded-[var(--radius-md)] w-full transition-colors duration-300 ease-out group relative outline-none",
      // Layout: row when expanded, centered column when shrunk (no label below so just center the icon)
      (isOpen || isFlyout) 
        ? isCompact 
          ? "flex-row gap-2 px-2.5 py-1"
          : useApexAccordionLook
            ? "flex-row gap-3 px-3 py-2"
            : "flex-row gap-3 px-3 py-2" 
        : "px-1 py-2.5 justify-center items-center",
      
      isCompact
        ? "compact-sidebar-item"
        : useApexAccordionLook
          ? isChild
            ? "text-[12px] font-medium"
            : "text-[12px] font-semibold"
        : isChild 
          ? "text-xs font-normal py-1.5" 
          : "text-sm font-medium",
      // Three active states:
      //   1. This item is the direct active route → solid blue fill.
      //   2. A child is active AND parent is collapsed → solid blue fill so the collapsed parent still signals it.
      //   3. A child is active AND parent is expanded → soft brand-tinted text (the child carries the strong fill).
      isSolidActive
        ? useApexAccordionLook
          ? isChild
            ? "bg-blue-50 text-blue-600 font-semibold"
            : "bg-blue-50 text-blue-600 font-semibold border-l-4 rtl:border-l-0 rtl:border-r-4 border-blue-600 rounded-l-none rtl:rounded-l-md rtl:rounded-r-none"
        : (use3DStyle && isChild && !isFlyout)
          ? "bg-transparent text-primary-600 font-bold"
          : isCompact
            ? isContrastSidebar
              ? "bg-white/20 text-white font-semibold"
              : "sidebar-item-active text-primary-600 dark:text-primary-400 font-semibold"
            : isContrastSidebar
              ? "bg-white/20 text-white font-semibold shadow-sm"
              : "bg-primary-600 text-white font-semibold shadow-sm dark:bg-primary-500"
        : isAnyChildActive
          ? useApexAccordionLook
            ? "bg-slate-100 text-slate-800 font-semibold"
          : isCompact
            ? isContrastSidebar
              ? "bg-white/10 text-white font-medium hover:bg-white/15"
              : "bg-primary-50/50 text-primary-600 dark:bg-primary-950/20 dark:text-primary-400 hover:bg-black/5 dark:hover:bg-white/5"
            : isContrastSidebar
              ? "bg-white/10 text-white font-medium hover:bg-white/15"
              : "bg-primary-50/50 text-primary-700 dark:bg-primary-950/20 dark:text-primary-300 hover:bg-black/5 dark:hover:bg-white/5"
          : useApexAccordionLook
            ? "text-slate-700 hover:bg-slate-100/70 hover:text-slate-900"
          : isContrastSidebar
            ? "text-[var(--app-sidebar-muted)] hover:bg-white/10 hover:text-[var(--app-sidebar-text)]"
            : "text-[var(--app-sidebar-muted)] hover:bg-black/5 dark:hover:bg-white/5 hover:text-[var(--app-sidebar-text)]",
      // Flyout child base layout; split hover based on active state to avoid overriding the active background on hover
      isFlyout && "px-4 py-2.5 rounded-none",
      isFlyout && !isSolidActive && "hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/20 dark:hover:text-primary-400",
      isFlyout && isSolidActive && "hover:bg-primary-700 dark:hover:bg-primary-400/20",
    )}>
      {/* Active Indicator (vertical strip for expanded, maybe different for shrunk).
          Inverted active state fills the row with primary, so the indicator is
          white to stay visible against the blue background. */}
      {!isFlyout && !isCompact && !useApexAccordionLook && (active || isAnyChildActive) && !(use3DStyle && isChild) && (isOpen ? (
        <span
          className={clsx(
            "absolute top-1/2 -translate-y-1/2 w-1 h-6",
            isSolidActive
              ? "bg-white/80"
              : "bg-primary-600 dark:bg-primary-400",
            isRtl ? "right-0 rounded-l-full" : "left-0 rounded-r-full"
          )}
        />
      ) : (
        <span
          className={clsx(
            "absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 rounded-t-full",
            isSolidActive
              ? "bg-white/80"
              : "bg-primary-600 dark:bg-primary-400"
          )}
        />
      ))}

      {/* Icon or First Letter */}
      {(!isChild || isFlyout) && (
        <div className={clsx(
          "pointer-events-none rounded-[var(--radius-md)] flex items-center justify-center shrink-0 transition-colors duration-300",
          (isOpen || isFlyout) 
            ? isCompact 
              ? "w-5 h-5"
              : "w-6 h-6" 
            : "w-8 h-8",
          // Icon pill state matches the row state:
          //   - row solid blue (direct active OR collapsed-parent-with-active-child) → pill is bg-white/20
          //   - row tinted (expanded parent with active child) → pill is bg-primary-100 / text-primary-700
          //   - inactive → muted
          isSolidActive
            ? useApexAccordionLook
              ? "text-blue-500"
              : use3DStyle && !isOpen && !isFlyout
              ? "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm text-primary-600"
              : "bg-white/20 text-white"
            : isAnyChildActive
              ? useApexAccordionLook
                ? "text-blue-600"
              : isContrastSidebar
                ? "bg-white/20 text-white"
                : "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
              : useApexAccordionLook
                ? "text-slate-400 group-hover:text-slate-600"
              : use3DStyle && !isOpen && !isFlyout
                ? "bg-transparent text-[var(--app-sidebar-muted)] hover:bg-white dark:hover:bg-slate-800 hover:border hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-sm"
                : isContrastSidebar
                  ? "bg-white/10 text-[var(--app-sidebar-muted)]"
                  : "bg-[var(--color-bg-tertiary)] text-[var(--app-sidebar-muted)]"
        )}>
          {(() => {
            if (finalIcon) {
              return React.cloneElement(finalIcon as React.ReactElement, {
                className: clsx(
                  (finalIcon as React.ReactElement).props.className,
                  (isOpen || isFlyout) 
                    ? isCompact 
                      ? "w-3.5 h-3.5"
                      : "w-4 h-4" 
                    : "w-6 h-6",
                  "transition-colors duration-200"
                )
              });
            }

            return (
              <span className={clsx("font-bold", (isOpen || isFlyout) ? "text-xs" : "text-lg")}>
                {label.charAt(0).toUpperCase()}
              </span>
            );
          })()}
        </div>
      )}
      
      {/* Label — only shown when sidebar is expanded */}
      {(isOpen || isFlyout) && (
        <span className="pointer-events-none whitespace-nowrap truncate flex-1">
          {label}
        </span>
      )}

      {/* Badge */}
      {badge && (isOpen || isFlyout) && (
        <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-red-500 text-white shrink-0">
          {badge}
        </span>
      )}

      {/* Chevron for children (hide in shrunk mode to save space) */}
      {hasChildren && (isOpen || isFlyout) && (
        <div className="shrink-0 pointer-events-none">
          {(!isSubmenusMode && isExpanded) ? (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
          ) : (
            <InlineChevron
              className={clsx(
                "w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200",
                isRtl ? "group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"
              )}
            />
          )}
        </div>
      )}
    </div>
  );

  // --- Sub-Menus Mode Logic ---
  if (isSubmenusMode && hasChildren) {
    return (
      <div 
        ref={itemRef}
        className="w-full relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          className={clsx("w-full outline-none group", isRtl ? "text-right" : "text-left")}
          title={!isOpen ? label : undefined}
        >
          {itemContent}
        </button>

        {showFlyout && (
          <Portal>
            <div 
              className={clsx(
                "fixed z-[100] rounded-[var(--radius-lg)] shadow-lg py-2 min-w-[240px] border transition-colors duration-300",
                "bg-[var(--app-sidebar-surface)] border-[var(--color-border)]",
                "animate-in fade-in duration-200"
              )}
              style={{ 
                ...(opensUpward ? { bottom: (window.innerHeight - coords.bottom) - 4 } : { top: coords.top - 4 }),
                ...(isRtl
                  ? { right: (window.innerWidth - coords.left) + (isFlyout ? 1 : 11) }
                  : { left: coords.right + (isFlyout ? 1 : 11) })
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {/* Safe Zone Bridge */}
              <div className={clsx(
                "absolute top-0 bottom-0 w-[22px] bg-transparent",
                isFlyout 
                  ? (isRtl ? "right-[-8px]" : "left-[-8px]") 
                  : (isRtl ? "right-[-22px]" : "left-[-22px]")
              )} />
              
              <div className="relative z-10 space-y-0.5">
                {children.map((child, idx) => (
                  <SidebarItem
                    key={child.path || idx}
                    path={child.path}
                    label={child.label}
                    isOpen={true}
                    onClick={() => { setShowFlyout(false); if (onClick) onClick(); }}
                    children={child.children}
                    isFlyout={true}
                    iconName={child.icon}
                    isChild={true}
                    isCompact={isCompact}
                  />
                ))}
              </div>
            </div>
          </Portal>
        )}
      </div>
    );
  }

  // --- Classic Mode Logic ---
  return (
    <div className="w-full">
      {hasChildren ? (
        <button 
          onClick={() => {
            if (!isOpen) {
              // If sidebar is closed, we might want to tell the parent to open it
              // For now, just expand the accordion locally
              setIsExpanded(true);
            } else {
              setIsExpanded(!isExpanded);
            }
            if (onClick) onClick();
          }}
          className={clsx("w-full outline-none", isRtl ? "text-right" : "text-left")}
          title={!isOpen ? label : undefined}
        >
          {itemContent}
        </button>
      ) : (
        <NavLink
          to={path || ''}
          onClick={onClick}
          className="w-full"
          title={!isOpen ? label : undefined}
        >
          {itemContent}
        </NavLink>
      )}

      {/* Render children inline (Classic Mode) */}
      {hasChildren && isOpen && !isSubmenusMode && (
        <div
          className={clsx(
            "grid transition-all duration-300 ease-in-out overflow-hidden mt-0.5",
            isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          )}
        >
          <div className={clsx(
            "min-h-0 space-y-0.5 overflow-hidden",
            useApexAccordionLook
              ? isRtl
                ? "mr-4 border-r border-[#E2E8F0] pr-2.5"
                : "ml-4 border-l border-[#E2E8F0] pl-2.5"
              : isRtl
                ? "mr-6 border-r border-[var(--color-border)] pr-[1px]"
                : "ml-6 border-l border-[var(--color-border)] pl-[1px]"
          )}>
            {children.map((child, idx) => (
              <SidebarItem
                key={child.path || idx}
                path={child.path}
                label={child.label}
                isOpen={isOpen}
                onClick={onClick}
                children={child.children}
                iconName={child.icon}
                isChild={true}
                isCompact={isCompact}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
