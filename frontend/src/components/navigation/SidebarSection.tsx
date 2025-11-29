import React from 'react';
import { SidebarItem } from './SidebarItem';

interface SidebarSectionProps {
  title: string;
  items: Array<{ path?: string; label: string; children?: Array<{ path: string; label: string }> }>;
  isOpen: boolean;
  onNavigate?: () => void;
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({ title, items, isOpen, onNavigate }) => {
  if (items.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className={`px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 ${!isOpen && 'hidden'}`}>
        {title}
      </h3>
      <div className="space-y-1">
        {items.map((item) => {
          if (item.children && item.children.length > 0) {
            return (
              <div key={item.label}>
                {isOpen && <div className="px-4 py-2 text-xs font-semibold text-gray-500">{item.label}</div>}
                <div className="space-y-1">
                  {item.children.map((child) => (
                    <SidebarItem
                      key={child.path}
                      path={child.path}
                      label={child.label}
                      isOpen={isOpen}
                      onClick={onNavigate}
                    />
                  ))}
                </div>
              </div>
            );
          }

          if (item.path) {
            return (
              <SidebarItem
                key={item.path}
                path={item.path}
                label={item.label}
                isOpen={isOpen}
                onClick={onNavigate}
              />
            );
          }
          return null;
        })}
      </div>
    </div>
  );
};
