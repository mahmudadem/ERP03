import React from 'react';
import * as Lucide from 'lucide-react';

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number }>;

/**
 * Resolves an icon name to a Lucide icon component.
 * Falls back to null if the icon name is not found in lucide-react.
 */
export const resolveSidebarIcon = (name?: string | null): IconComponent | null => {
  if (!name) return null;
  return (Lucide as any)[name] ?? null;
};
