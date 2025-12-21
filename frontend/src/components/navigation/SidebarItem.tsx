import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';

interface SidebarItemProps {
  path: string;
  label: string;
  isOpen: boolean;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export const SidebarItem: React.FC<SidebarItemProps> = ({ 
  path, 
  label, 
  isOpen, 
  icon,
  onClick 
}) => {
  const location = useLocation();
  
  // Custom active check that includes query parameters
  const isActive = () => {
    const [pathname, queryString] = path.split('?');
    const currentPath = location.pathname;
    const currentQuery = location.search.substring(1); // Remove '?'
    
    // Check if pathname matches
    if (currentPath !== pathname) return false;
    
    // If there's a query string in the path, check if it matches current query
    if (queryString) {
      return currentQuery === queryString;
    }
    
    // No query string needed, pathname match is enough
    return true;
  };
  
  const active = isActive();
  
  return (
    <NavLink
      to={path}
      onClick={onClick}
      className={clsx(
        "flex items-center gap-3 px-3 py-2 text-sm rounded-lg",
        "transition-all duration-200 ease-out",
        "group relative",
        active 
          ? "bg-primary-50 text-primary-700 font-medium" 
          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
      )}
      title={!isOpen ? label : undefined}
    >
      <>
        {/* Active Indicator */}
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary-600 rounded-r-full" />
        )}
        
        {/* Icon or First Letter */}
        <div className={clsx(
          "w-6 h-6 rounded-md flex items-center justify-center shrink-0",
          "transition-all duration-200",
          !isOpen && "mx-auto",
          active 
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
          "whitespace-nowrap truncate",
          !isOpen && "hidden"
        )}>
          {label}
        </span>
      </>
    </NavLink>
  );
};