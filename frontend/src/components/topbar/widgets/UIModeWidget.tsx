import React from 'react';
import { Monitor, LayoutGrid } from 'lucide-react';
import { clsx } from 'clsx';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { useTranslation } from 'react-i18next';

interface UIModeWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
  compact?: boolean;
}

export const UIModeWidget: React.FC<UIModeWidgetProps> = ({
  showBorder = true,
  showBackground = true,
  compact = false
}) => {
  const { t } = useTranslation('common');
  const { uiMode, setUiMode } = useUserPreferences();

  if (compact) {
    return (
      <div className="flex items-center gap-0.5 bg-slate-100/50 dark:bg-slate-900/50 p-0.5 rounded border border-slate-200/40 dark:border-slate-800/40 select-none text-[9px] font-black leading-none shrink-0">
        <button
          onClick={() => setUiMode('windows')}
          className={clsx(
            "px-1 py-0.5 rounded-sm transition-all",
            uiMode === 'windows'
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          {t('widgets.uiMode.windowsCompact', 'Win')}
        </button>
        <button
          onClick={() => setUiMode('classic')}
          className={clsx(
            "px-1 py-0.5 rounded-sm transition-all",
            uiMode === 'classic'
              ? "bg-indigo-600 text-white shadow-xs"
              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          )}
        >
          {t('widgets.uiMode.webCompact', 'Web')}
        </button>
      </div>
    );
  }

  return (
    <div className={clsx(
      "flex p-1 rounded-lg transition-all h-full w-full overflow-hidden",
      showBackground && "bg-[var(--color-bg-tertiary)] shadow-sm",
      showBorder && "border border-[var(--color-border)]"
    )}>
      <button
        onClick={() => setUiMode('windows')}
        className={clsx(
          "flex justify-center items-center gap-1.5 px-3 flex-1 text-xs font-semibold rounded-md transition-all h-full",
          uiMode === 'windows' 
           ? "bg-[var(--color-bg-primary)] text-indigo-600 shadow-sm" 
           : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        )}
      >
        <Monitor className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate hidden sm:inline">{t('widgets.uiMode.windows', 'Windows')}</span>
      </button>
      <button
        onClick={() => setUiMode('classic')}
        className={clsx(
          "flex justify-center items-center gap-1.5 px-3 flex-1 text-xs font-semibold rounded-md transition-all h-full",
          uiMode === 'classic' 
           ? "bg-[var(--color-bg-primary)] text-indigo-600 shadow-sm" 
           : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        )}
      >
        <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate hidden sm:inline">{t('widgets.uiMode.web', 'Web')}</span>
      </button>
    </div>
  );
};
