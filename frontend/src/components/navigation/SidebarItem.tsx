import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface SidebarItemProps {
  path?: string;
  label: string;
  isOpen: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
  children?: any[]; // Keep it simple for now or use SidebarItemData
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ 
  path, 
  label, 
  isOpen, 
  icon,
  onClick,
  children
}) => {
  const location = useLocation();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const hasChildren = children && children.length > 0;
  
  // Custom active check that includes query parameters
  const isActive = (targetPath: string) => {
    const [pathname, queryString] = targetPath.split('?');
    const currentPath = location.pathname;
    const currentQuery = location.search.substring(1); // Remove '?'
    
    // Check if pathname matches
    if (currentPath !== pathname) return false;
    
    // Strict query matching:
    // 1. If current URL has a query, it must match the item's query exactly.
    // 2. If current URL has NO query, the item must also have NO query.
    return (currentQuery || '') === (queryString || '');
  };
  
  const active = path ? isActive(path) : false;
  const isAnyChildActive = hasChildren && children.some(child => child.path && isActive(child.path));

  // Auto-expand if a child is active
  React.useEffect(() => {
    if (isAnyChildActive) {
      setIsExpanded(true);
    }
  }, [isAnyChildActive]);

  const toggleExpand = (e: React.MouseEvent) => {
    if (hasChildren) {
      e.preventDefault();
      e.stopPropagation();
      setIsExpanded(!isExpanded);
    }
  };

  const itemContent = (
    <div className={clsx(
      "flex items-center gap-3 px-3 py-2 text-sm rounded-lg w-full",
      "transition-all duration-200 ease-out",
      "group relative",
      (active || (isAnyChildActive && !isExpanded))
        ? "bg-primary-50 text-primary-700 font-medium" 
        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
    )}>
      {/* Active Indicator */}
      {(active || isAnyChildActive) && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-600 rounded-r-full" />
      )}
      
      {/* Icon or First Letter */}
      <div className={clsx(
        "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
        "transition-all duration-200",
        !isOpen && "mx-auto",
        (active || isAnyChildActive)
          ? "bg-primary-100 text-primary-700" 
          : "bg-gray-100 text-gray-500 group-hover:bg-gray-200 group-hover:text-gray-700"
      )}>
        {icon || (
          <span className="text-xs font-semibold">
            {label.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      
      {/* Label */}
      <span className={clsx(
        "whitespace-nowrap truncate flex-1",
        !isOpen && "hidden"
      )}>
        {label}
      </span>

      {/* Chevron for children */}
      {hasChildren && isOpen && (
        <div onClick={toggleExpand}>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </div>
      )}
    </div>
  );

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

      {/* Render children */}
      {hasChildren && isExpanded && isOpen && (
        <div className="ml-9 mt-1 space-y-1 border-l border-gray-100 pl-2">
          {children.map((child, idx) => {
             const childActive = child.path ? isActive(child.path) : false;
             return (
               <NavLink
                 key={child.path || idx}
                 to={child.path || ''}
                 onClick={onClick}
                 className={clsx(
                   "block px-3 py-1.5 text-xs rounded-md transition-colors",
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