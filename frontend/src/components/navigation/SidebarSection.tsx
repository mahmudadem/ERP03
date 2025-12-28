import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SidebarItem } from './SidebarItem';
import { clsx } from 'clsx';
import * as Icons from 'lucide-react';

interface SidebarItemData {
  path?: string;
  label: string;
  icon?: string;
  children?: SidebarItemData[];
}

interface SidebarSectionProps {
  title: string;
  items: SidebarItemData[];
  isOpen: boolean; // Sidebar open/closed state
  iconName?: string;
  onNavigate?: () => void;
  defaultExpanded?: boolean;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({ 
  title, 
  items, 
  isOpen, 
  iconName,
  onNavigate,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  
  // Resolve Icon from name if provided
  const ResolvedIcon = iconName ? (Icons as any)[iconName] : null;

  if (items.length === 0) return null;

  const toggleExpand = () => setIsExpanded((prev) => !prev);

  return (
    <div className="mb-2">
      {/* Section Header */}
      <button 
        onClick={toggleExpand}
        className={clsx(
          "w-full flex items-center gap-3 px-4 py-2 transition-all duration-300",
          "text-[11px] font-bold text-[var(--color-text-secondary)] uppercase tracking-wider",
          "hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-tertiary)]/50 group",
          !isOpen && "justify-center px-0"
        )}
      >
        {ResolvedIcon && (
          <div className={clsx(
            "p-1.5 rounded-lg transition-colors bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]",
            "group-hover:bg-primary-50 dark:group-hover:bg-primary-900/20 group-hover:text-primary-600",
            !isExpanded && !isOpen && "bg-primary-50 dark:bg-primary-900/20 text-primary-600"
          )}>
            <ResolvedIcon className="w-4 h-4" />
          </div>
        )}
        {isOpen && (
          <>
            <span className="truncate flex-1 text-left">{title}</span>
            {isExpanded 
              ? <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" /> 
              : <ChevronRight className="w-3 h-3 text-gray-400 shrink-0" />
            }
          </>
        )}
      </button>

      {/* Items List - Conditionally Rendered */}
      {isExpanded && (
        <div className={clsx(
          "space-y-0.5 mt-1 transition-all duration-300",
          isOpen && "ml-6 border-l border-[var(--color-border)] pl-[1px]"
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
            />
          ))}
        </div>
      )}
    </div>
  );
};