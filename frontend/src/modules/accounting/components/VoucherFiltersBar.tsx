/**
 * VoucherFiltersBar.tsx
 */
import React from 'react';
import { DateRange, VoucherFilters } from '../../../hooks/useVouchersWithCache';

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
    <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col lg:flex-row gap-4 items-center flex-wrap">
      
      {/* Search */}
      <div className="flex-1 w-full lg:w-auto min-w-[200px]">
        <input
          type="text"
          name="search"
          placeholder="Search by ID, Ref, Amount..."
          className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={filters.search || ''}
          onChange={handleInputChange}
        />
      </div>

      {/* Type Filter */}
      {!hideTypeFilter && (
        <div className="w-full lg:w-32">
          <select
            name="type"
            className="w-full border rounded px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
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
          className="w-full border rounded px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
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
        <input
          type="date"
          className="border rounded px-2 py-2 text-sm w-36"
          value={dateRange.from || ''}
          onChange={(e) => onDateRangeChange({ ...dateRange, from: e.target.value })}
        />
        <span className="text-gray-400">-</span>
        <input
          type="date"
          className="border rounded px-2 py-2 text-sm w-36"
          value={dateRange.to || ''}
          onChange={(e) => onDateRangeChange({ ...dateRange, to: e.target.value })}
        />
      </div>

    </div>
  );
};