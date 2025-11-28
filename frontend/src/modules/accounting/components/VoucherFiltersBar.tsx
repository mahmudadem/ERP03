/**
 * VoucherFiltersBar.tsx
 */
import React from 'react';
import { VoucherListFilters } from '../../../types/accounting/VoucherListTypes';

interface Props {
  filters: VoucherListFilters;
  onChange: (partial: Partial<VoucherListFilters>) => void;
}

export const VoucherFiltersBar: React.FC<Props> = ({ filters, onChange }) => {
  
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
      <div className="w-full lg:w-32">
        <select
          name="type"
          className="w-full border rounded px-3 py-2 text-sm bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none"
          value={filters.type || 'ALL'}
          onChange={handleInputChange}
        >
          <option value="ALL">All Types</option>
          <option value="INV">Invoice</option>
          <option value="PMT">Payment</option>
          <option value="REC">Receipt</option>
          <option value="JRNL">Journal</option>
        </select>
      </div>

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
          name="from"
          className="border rounded px-2 py-2 text-sm w-36"
          value={filters.from || ''}
          onChange={handleInputChange}
        />
        <span className="text-gray-400">-</span>
        <input
          type="date"
          name="to"
          className="border rounded px-2 py-2 text-sm w-36"
          value={filters.to || ''}
          onChange={handleInputChange}
        />
      </div>

      {/* Sort */}
      <div className="w-full lg:w-40 ml-auto">
        <select
          name="sort"
          className="w-full border rounded px-3 py-2 text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
          value={filters.sort || 'date_desc'}
          onChange={handleInputChange}
        >
          <option value="date_desc">Newest First</option>
          <option value="date_asc">Oldest First</option>
          <option value="amount_desc">High Amount</option>
          <option value="amount_asc">Low Amount</option>
        </select>
      </div>
    </div>
  );
};