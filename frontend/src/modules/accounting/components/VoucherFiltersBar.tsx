/**
 * VoucherFiltersBar.tsx
 */
import React from 'react';
import { DateRange, VoucherFilters } from '../../../hooks/useVouchersWithCache';
import { DatePicker } from './shared/DatePicker';

interface Props {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  filters: VoucherFilters;
  onChange: (partial: Partial<VoucherFilters>) => void;
  hideTypeFilter?: boolean;
  voucherTypes?: Array<{ id: string; name: string; code?: string }>;
}

export const VoucherFiltersBar: React.FC<Props> = ({ 
  dateRange, 
  onDateRangeChange, 
  filters, 
  onChange, 
  hideTypeFilter, 
  voucherTypes = [] 
}) => {
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    onChange({ [name]: value === 'ALL' ? undefined : value });
  };

  return (
    <div className="bg-[var(--color-bg-primary)] p-4 rounded-lg border border-[var(--color-border)] shadow-sm flex flex-col lg:flex-row gap-4 items-center flex-wrap transition-colors duration-300">
      
      {/* Search */}
      <div className="flex-1 w-full lg:w-auto min-w-[200px]">
        <input
          type="text"
          name="search"
          placeholder="Search by ID, Ref, Amount..."
          className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border)] rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          value={filters.search || ''}
          onChange={handleInputChange}
        />
      </div>

      {/* Type Filter */}
      {!hideTypeFilter && (
        <div className="w-full lg:w-32">
          <select
            name="type"
            className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border)] rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
            value={filters.type || 'ALL'}
            onChange={handleInputChange}
          >
            <option value="ALL">All Types</option>
            {voucherTypes.map(vt => {
              const value = (vt as any).baseType || vt.code || vt.id;
              return (
                <option key={vt.id} value={value}>
                  {vt.name}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {/* Status Filter */}
      <div className="w-full lg:w-32">
        <select
          name="status"
          className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border)] rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          value={filters.status || 'ALL'}
          onChange={handleInputChange}
        >
          <option value="ALL">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="POSTED">Posted</option>
          <option value="LOCKED">Locked</option>
          <option value="VOID">Void</option>
        </select>
      </div>

      {/* Date Range */}
      <div className="flex gap-2 items-center w-full lg:w-auto">
        <DatePicker
          className="w-36"
          value={dateRange.from || ''}
          onChange={(val: string) => onDateRangeChange({ ...dateRange, from: val })}
        />
        <span className="text-[var(--color-text-muted)]">-</span>
        <DatePicker
          className="w-36"
          value={dateRange.to || ''}
          onChange={(val: string) => onDateRangeChange({ ...dateRange, to: val })}
        />
      </div>

    </div>
  );
};