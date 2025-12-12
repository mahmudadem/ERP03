import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { SidebarItem } from './SidebarItem';

interface SidebarSectionProps {
  title: string;
  items: Array<{ path: string; label: string }>;
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
          {items.map((item) => (
            <SidebarItem
              key={item.path}
              path={item.path}
              label={item.label}
              isOpen={isOpen}
              onClick={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
};