import React from 'react';
import { Monitor, LayoutGrid } from 'lucide-react';
import { clsx } from 'clsx';
import { useUserPreferences } from '../../../hooks/useUserPreferences';

export const UIModeWidget: React.FC = () => {
  const { uiMode, setUiMode } = useUserPreferences();

  return (
    <div className="flex bg-[var(--color-bg-tertiary)] p-1 rounded-lg border border-[var(--color-border)] shadow-sm max-w-fit">
      <button
        onClick={() => setUiMode('windows')}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
          uiMode === 'windows' 
           ? "bg-[var(--color-bg-primary)] text-indigo-600 shadow-sm" 
           : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        )}
      >
        <Monitor className="w-3.5 h-3.5" />
        Windows
      </button>
      <button
        onClick={() => setUiMode('classic')}
        className={clsx(
          "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
          uiMode === 'classic' 
           ? "bg-[var(--color-bg-primary)] text-indigo-600 shadow-sm" 
           : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        )}
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        Web
      </button>
    </div>
  );
};
