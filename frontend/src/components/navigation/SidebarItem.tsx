import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import * as Icons from 'lucide-react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useUserPreferences } from '../../hooks/useUserPreferences';
import { Portal } from '@headlessui/react';

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
  isChild = false
}) => {
  const location = useLocation();
  const { sidebarMode } = useUserPreferences();
  
  // Resolve Icon from name if provided
  const ResolvedIcon = iconName ? (Icons as any)[iconName] : null;
  const finalIcon = icon || (ResolvedIcon ? <ResolvedIcon className="w-4 h-4" /> : null);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);
  const hasChildren = children && children.length > 0;
  const isSubmenusMode = sidebarMode === 'submenus';
  
  // Custom active check
  const isActive = (targetPath: string) => {
    const [pathname, queryString] = targetPath.split('?');
    const currentPath = location.pathname;
    const currentQuery = location.search.substring(1);
    if (currentPath !== pathname) return false;
    return (currentQuery || '') === (queryString || '');
  };
  
  const active = path ? isActive(path) : false;
  const isAnyChildActive = hasChildren && children.some(child => child.path && isActive(child.path));

  // Auto-expand for classic mode
  React.useEffect(() => {
    if (!isSubmenusMode && isAnyChildActive) {
      setIsExpanded(true);
    }
  }, [isAnyChildActive, isSubmenusMode]);

  const itemRef = React.useRef<HTMLDivElement>(null);
  const [coords, setCoords] = React.useState({ top: 0, left: 0, bottom: 0 });
  const [showFlyout, setShowFlyout] = React.useState(false);
  const [opensUpward, setOpensUpward] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const updateCoords = () => {
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.right,
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
      }
    }
  }, [showFlyout, isSubmenusMode]);

  const itemContent = (
    <div className={clsx(
      "flex items-center rounded-lg w-full transition-all duration-300 ease-out group relative outline-none",
      // Layout switching: Row when open/flyout, Col when shrunk
      (isOpen || isFlyout) ? "flex-row gap-3 px-3 py-2" : "flex-col gap-1.5 px-2 py-3 justify-center items-center",
      
      isChild ? "text-xs font-normal py-1.5" : "text-sm font-medium",
      (active || (isAnyChildActive && !isExpanded && !isSubmenusMode))
        ? "bg-primary-50 text-primary-700 font-medium dark:bg-primary-900/20 dark:text-primary-400" 
        : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)] hover:text-[var(--color-text-primary)]",
      isFlyout && "px-4 py-2.5 rounded-none hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/20 dark:hover:text-primary-400"
    )}>
      {/* Active Indicator (vertical strip for expanded, maybe different for shrunk) */}
      {!isFlyout && (active || isAnyChildActive) && (isOpen ? (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-600 rounded-r-full shadow-[0_0_10px_rgba(37,99,235,0.4)]" />
      ) : (
        <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary-600 rounded-t-full shadow-[0_0_10px_rgba(37,99,235,0.4)]" />
      ))}
      
      {/* Icon or First Letter */}
      <div className={clsx(
        "rounded-md flex items-center justify-center shrink-0 transition-all duration-300",
        (isOpen || isFlyout) 
          ? (isChild ? "w-5 h-5 -ml-0.5" : "w-6 h-6") 
          : "w-10 h-10 mb-1",
        (active || isAnyChildActive)
          ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-400" 
          : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] group-hover:bg-gray-200 dark:group-hover:bg-gray-700 group-hover:text-[var(--color-text-primary)]"
      )}>
        {finalIcon ? (
          React.cloneElement(finalIcon as React.ReactElement, { 
            className: clsx(
              (finalIcon as React.ReactElement).props.className,
              (isOpen || isFlyout) 
                ? (isChild ? "w-3 h-3" : "w-4 h-4") 
                : "w-6 h-6"
            )
          })
        ) : (
          !isChild && (
            <span className={clsx("font-bold", (isOpen || isFlyout) ? "text-xs" : "text-lg")}>
              {label.charAt(0).toUpperCase()}
            </span>
          )
        )}
      </div>
      
      {/* Label */}
      <span className={clsx(
        "whitespace-nowrap truncate",
        (isOpen || isFlyout) ? "flex-1 text-sm" : "text-[9px] font-black uppercase tracking-tighter text-center w-full px-1"
      )}>
        {label}
      </span>

      {/* Chevron for children (hide in shrunk mode to save space) */}
      {hasChildren && (isOpen || isFlyout) && (
        <div className="shrink-0">
          {(!isSubmenusMode && isExpanded) ? (
            <ChevronDown className="w-4 h-4 text-[var(--color-text-muted)]" />
          ) : (
            <ChevronRight className="w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 group-hover:translate-x-0.5" />
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
        <button className="w-full text-left outline-none group">
          {itemContent}
        </button>

        {showFlyout && (
          <Portal>
            <div 
              className={clsx(
                "fixed z-[100] rounded-xl shadow-lg py-2 min-w-[240px] border transition-colors duration-300",
                "backdrop-blur-md bg-[var(--color-bg-primary)]/95 border-[var(--color-border)]",
                "animate-in fade-in slide-in-from-left-1 duration-200"
              )}
              style={{ 
                ...(opensUpward ? { bottom: (window.innerHeight - coords.bottom) - 4 } : { top: coords.top - 4 }),
                left: coords.left + (isFlyout ? 1 : 11) 
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {/* Safe Zone Bridge */}
              <div className={clsx(
                "absolute top-0 bottom-0 w-[22px] bg-transparent",
                isFlyout ? "left-[-8px]" : "left-[-22px]"
              )} />
              
              <div className="relative z-10 space-y-0.5">
                {children.map((child, idx) => (
                  <SidebarItem
                    key={child.path || idx}
                    path={child.path}
                    label={child.label}
                    isOpen={true}
                    onClick={onClick}
                    children={child.children}
                    isFlyout={true}
                    iconName={child.icon}
                    isChild={true}
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
          className="w-full text-left outline-none"
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
      {hasChildren && isExpanded && isOpen && !isSubmenusMode && (
        <div className="ml-6 mt-1 space-y-0.5 border-l border-[var(--color-border)] pl-[1px] transition-all duration-300">
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
            />
          ))}
        </div>
      )}
    </div>
  );
};
