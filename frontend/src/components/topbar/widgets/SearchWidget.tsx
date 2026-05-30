import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

interface SearchWidgetProps {
  showBorder?: boolean;
  showBackground?: boolean;
  compact?: boolean;
}

export const SearchWidget: React.FC<SearchWidgetProps> = ({
  showBorder = true,
  showBackground = true,
  compact = false
}) => {
  const { t } = useTranslation('common');
  const [query, setQuery] = useState('');

  return (
    <div className={clsx(
      "flex items-center gap-1.5 rounded-lg text-xs transition-all h-full w-full overflow-hidden",
      !compact && "px-3 bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] shadow-sm",
      compact && "bg-slate-50 dark:bg-slate-950 border border-slate-250 dark:border-slate-850 px-2 py-0.5"
    )}>
      <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('widgets.search.placeholder', { defaultValue: 'بحث...' })}
        className="bg-transparent border-none outline-none text-slate-700 dark:text-slate-200 placeholder-slate-400 text-xs w-16 sm:w-20 focus:w-28 sm:focus:w-36 transition-all"
      />
    </div>
  );
};
