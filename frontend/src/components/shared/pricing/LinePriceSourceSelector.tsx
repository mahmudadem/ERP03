import React from 'react';
import { useTranslation } from 'react-i18next';
import { Tag } from 'lucide-react';
import { clsx } from 'clsx';

export type LinePriceSource = 'PRICE_LIST' | 'LAST_PARTY_PRICE' | 'LAST_EVENT' | 'ITEM_DEFAULT';

interface LinePriceSourceSelectorProps {
  value: LinePriceSource;
  onChange: (value: LinePriceSource) => void;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  selectClassName?: string;
  compact?: boolean;
}

export const LINE_PRICE_SOURCE_OPTIONS: LinePriceSource[] = [
  'LAST_PARTY_PRICE',
  'PRICE_LIST',
  'LAST_EVENT',
  'ITEM_DEFAULT',
];

export function linePriceSourceLabel(t: ReturnType<typeof useTranslation>['t'], source: LinePriceSource): string {
  const labels: Record<LinePriceSource, string> = {
    LAST_PARTY_PRICE: t('pricing.linePriceSource.lastPartyPrice', 'Last party price'),
    PRICE_LIST: t('pricing.linePriceSource.priceList', 'Price list'),
    LAST_EVENT: t('pricing.linePriceSource.lastEvent', 'Last sale/purchase'),
    ITEM_DEFAULT: t('pricing.linePriceSource.itemDefault', 'Item default'),
  };
  return labels[source];
}

export function LinePriceSourceSelector({
  value,
  onChange,
  disabled,
  className,
  labelClassName,
  selectClassName,
  compact = false,
}: LinePriceSourceSelectorProps) {
  const { t } = useTranslation();

  return (
    <div className={clsx('min-w-0', className)}>
      <label
        className={clsx(
          'mb-1 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-400',
          labelClassName,
        )}
      >
        <Tag className="h-3 w-3" />
        {t('pricing.linePriceSource.label', 'Line price source')}
      </label>
      <select
        className={clsx(
          'w-full rounded border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 shadow-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100',
          compact ? 'h-8' : 'h-9',
          selectClassName,
        )}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as LinePriceSource)}
      >
        {LINE_PRICE_SOURCE_OPTIONS.map((source) => (
          <option key={source} value={source}>
            {linePriceSourceLabel(t, source)}
          </option>
        ))}
      </select>
    </div>
  );
}
