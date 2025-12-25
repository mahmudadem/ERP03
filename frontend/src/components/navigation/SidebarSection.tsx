import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SidebarItem } from './SidebarItem';

interface SidebarItemData {
  path?: string;
  label: string;
  children?: SidebarItemData[];
}

interface SidebarSectionProps {
  title: string;
  items: SidebarItemData[];
  isOpen: boolean; // Sidebar open/closed state
  onNavigate?: () => void;
  defaultExpanded?: boolean;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({ 
  title, 
  items, 
  isOpen, 
  onNavigate,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (items.length === 0) return null;

  const toggleExpand = () => setIsExpanded((prev) => !prev);

  return (
    <div className="mb-2">
      {/* Section Header - Clickable to Fold/Unfold */}
      <button 
        onClick={toggleExpand}
        className={`
          w-full flex items-center justify-between px-4 py-2 
          text-xs font-semibold text-gray-500 uppercase tracking-wider
          hover:bg-gray-50 rounded-md transition-colors
          ${!isOpen && 'justify-center'}
        `}
      >
        <span className={`${!isOpen && 'hidden'} truncate`}>{title}</span>
        {isOpen && (
          isExpanded 
            ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> 
            : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>

      {/* Items List - Conditionally Rendered */}
      {isExpanded && (
        <div className="space-y-0.5 mt-1">
          {items.map((item, idx) => (
            <SidebarItem
              key={item.path || `${item.label}-${idx}`}
              path={item.path || ''}
              label={item.label}
              isOpen={isOpen}
              onClick={onNavigate}
              children={item.children}
            />
          ))}
        </div>
      )}
    </div>
  );
};