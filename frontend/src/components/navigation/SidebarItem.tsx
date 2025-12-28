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
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ 
  path, 
  label, 
  isOpen, 
  icon,
  iconName,
  onClick,
  children,
  isFlyout = false
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
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });
  const [showFlyout, setShowFlyout] = React.useState(false);
  const timerRef = React.useRef<NodeJS.Timeout | null>(null);

  const updateCoords = () => {
    if (itemRef.current) {
      const rect = itemRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top,
        left: rect.right
      });
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
      "flex items-center gap-3 px-3 py-2 text-sm rounded-lg w-full",
      "transition-all duration-200 ease-out",
      "group relative",
      (active || (isAnyChildActive && !isExpanded && !isSubmenusMode))
        ? "bg-primary-50 text-primary-700 font-medium" 
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
      isFlyout && "px-4 py-2.5 rounded-none hover:bg-primary-50 hover:text-primary-700"
    )}>
      {/* Active Indicator (not for flyout items) */}
      {!isFlyout && (active || isAnyChildActive) && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-600 rounded-r-full" />
      )}
      
      {/* Icon or First Letter */}
      <div className={clsx(
        "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
        "transition-all duration-200",
        (!isOpen && !isFlyout) && "mx-auto",
        (active || isAnyChildActive)
          ? "bg-primary-100 text-primary-700" 
          : "bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700"
      )}>
        {finalIcon || (
          <span className="text-xs font-semibold">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      
      {/* Label */}
      <span className={clsx(
        "whitespace-nowrap truncate flex-1",
        (!isOpen && !isFlyout) && "hidden",
        "font-medium"
      )}>
        {label}
      </span>

      {/* Chevron for children */}
      {hasChildren && (isOpen || isFlyout) && (
        <div>
          {(!isSubmenusMode && isExpanded) ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400 transition-transform duration-200 group-hover:translate-x-0.5" />
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
                "fixed z-[100] bg-white border border-gray-200 rounded-xl shadow-lg py-2 min-w-[240px]",
                "backdrop-blur-md bg-white/98",
                "animate-in fade-in slide-in-from-left-1 duration-200"
              )}
              style={{ 
                top: coords.top - 4, 
                left: coords.left + (isFlyout ? 1 : 11) // 12px sidebar padding + 5px gap
              }}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            >
              {/* Safe Zone Bridge - Adjusted to ensure it covers the maximum potential gap */}
              <div className="absolute left-[-22px] top-0 bottom-0 w-[22px] bg-transparent" />
              
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
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full text-left"
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
        <div className="ml-9 mt-1 space-y-1 border-l border-gray-100 pl-2">
          {children.map((child, idx) => {
             const childActive = child.path ? isActive(child.path) : false;
             return (
               <NavLink
                 key={child.path || idx}
                 to={child.path || ''}
                 onClick={onClick}
                 className={clsx(
                   "block px-3 py-2 text-sm rounded-md transition-colors",
                   childActive
                     ? "bg-primary-50 text-primary-700 font-medium"
                     : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                 )}
               >
                 {child.label}
               </NavLink>
             );
          })}
        </div>
      )}
    </div>
  );
};
