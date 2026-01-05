/**
 * VoucherFiltersBar.tsx
 */
import React from 'react';
import { DateRange, VoucherFilters } from '../../../hooks/useVouchersWithCache';
import { DatePicker } from './shared/DatePicker';
import { Button } from '../../../components/ui/Button';
import { Filter, RotateCcw, Search } from 'lucide-react';

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
  // Local state for buffering changes
  const [localFilters, setLocalFilters] = React.useState<VoucherFilters>(filters);
  const [localDateRange, setLocalDateRange] = React.useState<DateRange>(dateRange);

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
    // Reset filters
    const defaultFilters = {};
    setLocalFilters(defaultFilters);
    
    // Reset date range to the system default (2000-01-01)
    // We import the logic directly to avoid another round-trip
    const to = new Date().toISOString().split('T')[0];
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
          placeholder="Search by ID, Ref, Amount..."
          className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border)] rounded pl-10 pr-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none"
          value={localFilters.search || ''}
          onChange={handleInputChange}
          onKeyDown={(e) => e.key === 'Enter' && handleApply()}
        />
      </div>

      {/* Type Filter */}
      {!hideTypeFilter && (
        <div className="w-full lg:w-40">
          <select
            name="type"
            className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border)] rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            value={localFilters.type || 'ALL'}
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
      <div className="w-full lg:w-40">
        <select
          name="status"
          className="w-full bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border-[var(--color-border)] rounded px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
          value={localFilters.status || 'ALL'}
          onChange={handleInputChange}
        >
          <option value="ALL">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="POSTED">Posted</option>
          <option value="LOCKED">Locked</option>
          <option value="VOID">Void</option>
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
          Apply
        </Button>
        <Button 
          variant="secondary" 
          onClick={handleClear}
          className="flex-1 lg:flex-none gap-2"
          leftIcon={<RotateCcw size={16} />}
          title="Reset all filters and dates"
        >
          Clear
        </Button>
      </div>

    </div>
  );
};
