/**
 * VoucherTable.tsx
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { VoucherListItem } from '../../../types/accounting/VoucherListTypes';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Filter, X } from 'lucide-react';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate, formatCompanyTime } from '../../../utils/dateUtils';
import { DatePicker } from './shared/DatePicker';

interface Props {
  vouchers: VoucherListItem[];
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
  isLoading?: boolean;
  error?: string | null;
  onPageChange?: (page: number) => void;
  onRowClick?: (id: string) => void;
  onEdit?: (voucher: VoucherListItem) => void;
  onDelete?: (id: string) => void;
}

interface ColumnFilter {
  dateFrom?: string;
  dateTo?: string;
  statuses?: string[];
  types?: string[];
  searchNumber?: string;
}

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'approved': return 'success';
    case 'pending': return 'warning';
    case 'draft': return 'default';
    case 'cancelled': return 'error';
    case 'locked': return 'info';
    default: return 'default';
  }
};

export const VoucherTable: React.FC<Props> = ({ 
  vouchers = [], 
  pagination, 
  isLoading,
  error,
  onPageChange,
  onRowClick,
  onEdit,
  onDelete
}) => {
  const safeVouchers = Array.isArray(vouchers) ? vouchers : [];
  const pageInfo = pagination || { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
  const { settings } = useCompanySettings();
  
  // Sorting state - default to date descending (most recent first)
  const [sortField, setSortField] = useState<keyof VoucherListItem>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  
  // Filter state
  const [filters, setFilters] = useState<ColumnFilter>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  
  // Get unique values for filters
  const uniqueStatuses = useMemo(() => 
    Array.from(new Set(safeVouchers.map(v => v.status))).sort(),
    [safeVouchers]
  );
  
  const uniqueTypes = useMemo(() => 
    Array.from(new Set(safeVouchers.map(v => v.type))).sort(),
    [safeVouchers]
  );
  
  // Close filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setActiveFilterColumn(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Handle column header click for sorting
  const handleSort = (field: keyof VoucherListItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // Filter and sort vouchers
  const filteredAndSortedVouchers = useMemo(() => {
    // First apply filters
    let filtered = [...safeVouchers];
    
    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(v => new Date(v.date) >= fromDate);
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      filtered = filtered.filter(v => new Date(v.date) <= toDate);
    }
    
    // Status filter
    if (filters.statuses && filters.statuses.length > 0) {
      filtered = filtered.filter(v => filters.statuses!.includes(v.status));
    }
    
    // Type filter
    if (filters.types && filters.types.length > 0) {
      filtered = filtered.filter(v => filters.types!.includes(v.type));
    }
    
    // Number search filter
    if (filters.searchNumber) {
      const search = filters.searchNumber.toLowerCase();
      filtered = filtered.filter(v => 
        (v.voucherNo || v.id).toLowerCase().includes(search)
      );
    }
    
    // Then sort
    const sorted = filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      
      // Handle undefined values
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      
      // Handle date comparison
      if (sortField === 'date') {
        aVal = new Date(aVal as string).getTime();
        bVal = new Date(bVal as string).getTime();
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    
    return sorted;
  }, [safeVouchers, sortField, sortDirection, filters]);
  
  // Render sort icon
  const renderSortIcon = (field: keyof VoucherListItem) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };
  
  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.dateFrom) count++;
    if (filters.dateTo) count++;
    if (filters.statuses && filters.statuses.length > 0) count++;
    if (filters.types && filters.types.length > 0) count++;
    if (filters.searchNumber) count++;
    return count;
  }, [filters]);
  
  // Clear all filters
  const clearFilters = () => {
    setFilters({});
  };
  
  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading vouchers...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm flex flex-col">

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {/* Date & Time Header */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group relative">
                <div className="flex items-center gap-2">
                  <span>Date & Time</span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSort('date')} className="p-1 hover:text-blue-600">
                      {renderSortIcon('date')}
                    </button>
                    <button onClick={() => setActiveFilterColumn(activeFilterColumn === 'date' ? null : 'date')} className={`p-1 hover:text-blue-600 ${(filters.dateFrom || filters.dateTo) ? 'text-blue-600 opacity-100' : ''}`}>
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {activeFilterColumn === 'date' && (
                  <div ref={filterRef} className="absolute top-full left-0 mt-1 p-3 bg-white border border-gray-200 shadow-xl rounded-md z-50 min-w-[200px] normal-case font-normal text-gray-700">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">From</label>
                        <DatePicker 
                          value={filters.dateFrom || ''} 
                          onChange={(val: string) => setFilters({ ...filters, dateFrom: val })} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">To</label>
                        <DatePicker 
                          value={filters.dateTo || ''} 
                          onChange={(val: string) => setFilters({ ...filters, dateTo: val })} 
                        />
                      </div>
                    </div>
                  </div>
                )}
              </th>

              {/* Number Header */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group relative">
                <div className="flex items-center gap-2">
                  <span>Number</span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSort('voucherNo')} className="p-1 hover:text-blue-600">
                      {renderSortIcon('voucherNo')}
                    </button>
                    <button onClick={() => setActiveFilterColumn(activeFilterColumn === 'number' ? null : 'number')} className={`p-1 hover:text-blue-600 ${filters.searchNumber ? 'text-blue-600 opacity-100' : ''}`}>
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {activeFilterColumn === 'number' && (
                  <div ref={filterRef} className="absolute top-full left-0 mt-1 p-3 bg-white border border-gray-200 shadow-xl rounded-md z-50 min-w-[200px] normal-case font-normal text-gray-700">
                    <input type="text" placeholder="Search number..." value={filters.searchNumber || ''} onChange={(e) => setFilters({ ...filters, searchNumber: e.target.value })} className="w-full text-sm border-gray-300 rounded px-2 py-1" />
                  </div>
                )}
              </th>

              {/* Type Header */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group relative">
                <div className="flex items-center gap-2">
                  <span>Type</span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSort('type')} className="p-1 hover:text-blue-600">
                      {renderSortIcon('type')}
                    </button>
                    <button onClick={() => setActiveFilterColumn(activeFilterColumn === 'type' ? null : 'type')} className={`p-1 hover:text-blue-600 ${filters.types?.length ? 'text-blue-600 opacity-100' : ''}`}>
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {activeFilterColumn === 'type' && (
                  <div ref={filterRef} className="absolute top-full left-0 mt-1 p-3 bg-white border border-gray-200 shadow-xl rounded-md z-50 min-w-[150px] normal-case font-normal text-gray-700">
                    <div className="space-y-1">
                      {uniqueTypes.map(type => (
                        <label key={type} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input type="checkbox" checked={filters.types?.includes(type) || false} onChange={(e) => {
                            const current = filters.types || [];
                            const updated = e.target.checked ? [...current, type] : current.filter(t => t !== type);
                            setFilters({ ...filters, types: updated.length > 0 ? updated : undefined });
                          }} className="rounded border-gray-300 text-blue-600" />
                          <span className="text-sm">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </th>

              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Prefix</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
              
              {/* Status Header */}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group relative">
                <div className="flex items-center gap-2">
                  <span>Status</span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSort('status')} className="p-1 hover:text-blue-600">
                      {renderSortIcon('status')}
                    </button>
                    <button onClick={() => setActiveFilterColumn(activeFilterColumn === 'status' ? null : 'status')} className={`p-1 hover:text-blue-600 ${filters.statuses?.length ? 'text-blue-600 opacity-100' : ''}`}>
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {activeFilterColumn === 'status' && (
                  <div ref={filterRef} className="absolute top-full left-0 mt-1 p-3 bg-white border border-gray-200 shadow-xl rounded-md z-50 min-w-[150px] normal-case font-normal text-gray-700">
                    <div className="space-y-1">
                      {uniqueStatuses.map(status => (
                        <label key={status} className="flex items-center gap-2 p-1 hover:bg-gray-50 rounded cursor-pointer">
                          <input type="checkbox" checked={filters.statuses?.includes(status) || false} onChange={(e) => {
                            const current = filters.statuses || [];
                            const updated = e.target.checked ? [...current, status] : current.filter(s => s !== status);
                            setFilters({ ...filters, statuses: updated.length > 0 ? updated : undefined });
                          }} className="rounded border-gray-300 text-blue-600" />
                          <span className="text-sm capitalize">{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </th>

              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider group relative">
                <div className="flex items-center justify-end gap-2">
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSort('totalDebit')} className="p-1 hover:text-blue-600">
                      {renderSortIcon('totalDebit')}
                    </button>
                    {/* Amount filter could be added here if needed, keeping it simple for now as sort is primary for amounts */}
                  </div>
                  <span>Debit</span>
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider group relative">
                <div className="flex items-center justify-end gap-2">
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSort('totalCredit')} className="p-1 hover:text-blue-600">
                      {renderSortIcon('totalCredit')}
                    </button>
                  </div>
                  <span>Credit</span>
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider group relative">
                <div className="flex items-center gap-2">
                  <span>Ref</span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSort('reference')} className="p-1 hover:text-blue-600">
                      {renderSortIcon('reference')}
                    </button>
                  </div>
                </div>
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {safeVouchers.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-6 py-12 text-center text-gray-500 text-sm">
                  No vouchers found matching your filters.
                </td>
              </tr>
            ) : (
              filteredAndSortedVouchers.map((voucher: VoucherListItem) => (
                <tr 
                  key={voucher.id} 
                  className="hover:bg-blue-50 transition-colors group"
                >
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex flex-col">
                      <span className="font-medium">{formatCompanyDate(voucher.date, settings)}</span>
                      <span className="text-xs text-gray-500">{formatCompanyTime(voucher.date, settings)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm font-mono text-gray-600">
                    {voucher.voucherNo || voucher.id}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-500">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                      {voucher.type}
                    </span>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm font-mono text-gray-500">
                    {(voucher as any).prefix || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-[120px]" title={(voucher as any).formId || ''}>
                    {(voucher as any).formId || '-'}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <Badge variant={getStatusVariant(voucher.status)}>
                      {voucher.status.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                    {voucher.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {voucher.currency}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-gray-900 text-right font-mono">
                    {voucher.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {voucher.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate max-w-[150px]">
                    {voucher.reference || '-'}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onRowClick?.(voucher.id); }}
                        className="text-slate-400 hover:text-blue-600 transition-colors p-1.5 bg-slate-50 hover:bg-blue-50 rounded"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onEdit?.(voucher); }}
                        className="text-slate-400 hover:text-indigo-600 transition-colors p-1.5 bg-slate-50 hover:bg-indigo-50 rounded"
                        title="Edit Voucher"
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDelete?.(voucher.id); }}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1.5 bg-slate-50 hover:bg-red-50 rounded"
                        title="Delete Voucher"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer - Only show if pagination is provided */}
      {pagination && onPageChange && (
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing page <span className="font-medium">{pageInfo.page}</span> of <span className="font-medium">{pageInfo.totalPages || 1}</span> ({pageInfo.totalItems} items)
          </div>
          <div className="flex gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              disabled={pageInfo.page <= 1}
              onClick={() => onPageChange(pageInfo.page - 1)}
            >
              Previous
            </Button>
            <Button 
              variant="secondary" 
              size="sm" 
              disabled={pageInfo.page >= pageInfo.totalPages}
              onClick={() => onPageChange(pageInfo.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
