/**
 * VoucherFiltersBar.tsx
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { DateRange, VoucherFilters } from '../../../hooks/useVouchersWithCache';
import { DatePicker } from './shared/DatePicker';
import { Button } from '../../../components/ui/Button';
import { Filter, RotateCcw, Search } from 'lucide-react';

interface Props {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  filters: VoucherFilters;
  onChange: (partial: Partial<VoucherFilters>) => void;
  onClear?: () => void;
  hideTypeFilter?: boolean;
  voucherTypes?: Array<{ id: string; name: string; code?: string; baseType?: string }>;
}

export const VoucherFiltersBar: React.FC<Props> = ({ 
  dateRange, 
  onDateRangeChange, 
  filters, 
  onChange, 
  onClear,
  hideTypeFilter, 
  voucherTypes = [] 
}) => {
  const { t } = useTranslation('accounting');
  // Local state for buffering changes
  const [localFilters, setLocalFilters] = React.useState<VoucherFilters>(filters);
  const [localDateRange, setLocalDateRange] = React.useState<DateRange>(dateRange);

  // Derive unique categories from voucherTypes plus standard types
  const categories = React.useMemo(() => {
    const staticTypes = ['journal_entry', 'payment_voucher', 'receipt_voucher', 'reversal'];
    const dynamicTypes = voucherTypes.map(vt => vt.baseType).filter(Boolean) as string[];
    return Array.from(new Set([...staticTypes, ...dynamicTypes]));
  }, [voucherTypes]);

  // Sync with props when they change externally (e.g. from URL)
  React.useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  React.useEffect(() => {
    setLocalDateRange(dateRange);
  }, [dateRange]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setLocalFilters(prev => ({ 
      ...prev, 
      [name]: value === 'ALL' ? undefined : value 
    }));
  };

  const handleApply = () => {
    // Apply both filters and date range at once
    onChange(localFilters);
    onDateRangeChange(localDateRange);
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
      return;
    }
    
    // Reset filters
    const defaultFilters = {
      status: undefined,
      type: undefined,
      search: undefined,
      formId: undefined 
    };
    setLocalFilters(defaultFilters);
    
    // Reset date range to the system default (2000-01-01)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const to = `${year}-${month}-${day}`;
    const defaultRange = { from: '2000-01-01', to };
    setLocalDateRange(defaultRange);
    
    // Immediately apply the cleared state
    onChange(defaultFilters);
    onDateRangeChange(defaultRange);
  };

  return (
    <div className="bg-[var(--color-bg-primary)] p-4 rounded-lg border border-[var(--color-border)] shadow-sm flex flex-col lg:flex-row gap-4 items-center flex-wrap transition-colors duration-300">
      
      {/* Search */}
      <div className="flex-1 w-full lg:w-auto min-w-[200px] relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" size={16} />
        <input
          type="text"
          name="search"
          placeholder={t('voucherFilters.search')}
          className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border)] rounded pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          value={localFilters.search || ''}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        />
      </div>

      {/* Category Filter (Type) */}
      {!hideTypeFilter && (
        <div className="w-full lg:w-40">
          <select
            name="type"
            className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border)] rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            value={localFilters.type || 'ALL'}
            onChange={handleInputChange}
          >
            <option value="ALL">{t('voucherFilters.allCategories', 'All Categories')}</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {t(`voucherTypes.${cat}`, cat.replace('_', ' ').toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Form Filter (FormId) */}
      {!hideTypeFilter && (
        <div className="w-full lg:w-40">
          <select
            name="formId"
            className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border)] rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            value={localFilters.formId || 'ALL'}
            onChange={handleInputChange}
          >
            <option value="ALL">{t('voucherFilters.allForms', 'All Forms')}</option>
            {voucherTypes.map(vt => (
              <option key={vt.id} value={vt.id}>
                {vt.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Status Filter */}
      <div className="w-full lg:w-40">
        <select
          name="status"
          className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border)] rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
          value={localFilters.status || 'ALL'}
          onChange={handleInputChange}
        >
          <option value="ALL">{t('voucherFilters.allStatus')}</option>
          <option value="DRAFT">{t('statuses.draft')}</option>
          <option value="PENDING">{t('statuses.pending')}</option>
          <option value="APPROVED">{t('statuses.approved')}</option>
          <option value="POSTED">{t('statuses.posted')}</option>
          <option value="REVERSED">{t('statuses.reversed')}</option>
          <option value="LOCKED">{t('statuses.locked')}</option>
          <option value="VOID">{t('statuses.void')}</option>
        </select>
      </div>

      {/* Date Range */}
      <div className="flex gap-2 items-center w-full lg:w-auto">
        <DatePicker
          className="w-36"
          value={localDateRange.from || ''}
          onChange={(val: string) => setLocalDateRange({ ...localDateRange, from: val })}
        />
        <span className="text-[var(--color-text-muted)] font-medium">-</span>
        <DatePicker
          className="w-36"
          value={localDateRange.to || ''}
          onChange={(val: string) => setLocalDateRange({ ...localDateRange, to: val })}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 w-full lg:w-auto">
        <Button 
          variant="primary" 
          onClick={handleApply}
          className="flex-1 lg:flex-none gap-2 shadow-sm"
          leftIcon={<Filter size={16} />}
        >
          {t('voucherFilters.apply')}
        </Button>
        <Button 
          variant="secondary" 
          onClick={handleClear}
          className="flex-1 lg:flex-none gap-2"
          leftIcon={<RotateCcw size={16} />}
          title={t('voucherFilters.resetTitle')}
        >
          {t('voucherFilters.clear')}
        </Button>
      </div>

    </div>
  );
};
