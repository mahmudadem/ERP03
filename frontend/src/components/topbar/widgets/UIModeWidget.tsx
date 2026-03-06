import React from 'react';
import { Monitor, LayoutGrid } from 'lucide-react';
import { clsx } from 'clsx';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { useTranslation } from 'react-i18next';

interface UIModeWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
}

export const UIModeWidget: React.FC<UIModeWidgetProps> = ({
  showBorder = true,
  showBackground = true
}) => {
  const { t } = useTranslation('common');
  const { uiMode, setUiMode } = useUserPreferences();

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
