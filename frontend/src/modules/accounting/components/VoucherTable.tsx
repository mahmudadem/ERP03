/**
 * VoucherTable.tsx
 */
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { VoucherListItem } from '../../../types/accounting/VoucherListTypes';
import { PostingLockPolicy } from '../../../types/accounting/PostingLockPolicy';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Printer, Lock } from 'lucide-react';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { clsx } from 'clsx';
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
  onViewPrint?: (id: string) => void;
  onRefresh?: (id: string) => void;
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
  onDelete,
  onViewPrint
}) => {
  const safeVouchers = Array.isArray(vouchers) ? vouchers : [];
  const pageInfo = pagination || { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
  const { settings } = useCompanySettings();
  
  // States for row expansion
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  
  // Toggle row expansion
  const toggleRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };
  
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

  // AUTO-EXPAND rows that contain filtered results
  useEffect(() => {
    const isSearching = filters.searchNumber || filters.statuses?.length || filters.types?.length || filters.dateFrom || filters.dateTo;
    if (isSearching && safeVouchers.length > 0) {
      const topLevel = safeVouchers.filter(v => !v.reversalOfVoucherId);
      const reversals = safeVouchers.filter(v => !!v.reversalOfVoucherId);
      
      const checkMatch = (item: VoucherListItem) => {
        if (filters.dateFrom && new Date(item.date) < new Date(filters.dateFrom)) return false;
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (new Date(item.date) > toDate) return false;
        }
        if (filters.statuses && filters.statuses.length > 0 && !filters.statuses.includes(item.status)) return false;
        if (filters.types && filters.types.length > 0 && !filters.types.includes(item.type)) return false;
        if (filters.searchNumber) {
          const s = filters.searchNumber.toLowerCase();
          if (!(item.voucherNo || item.id).toLowerCase().includes(s)) return false;
        }
        return true;
      };

      const newExpanded = new Set(expandedRows);
      let changed = false;

      topLevel.forEach(v => {
        // If parent doesn't match but child does, expand parent
        if (!checkMatch(v)) {
          const children = reversals.filter(r => r.reversalOfVoucherId === v.id);
          if (children.some(checkMatch)) {
            if (!newExpanded.has(v.id)) {
              newExpanded.add(v.id);
              changed = true;
            }
          }
        }
      });

      if (changed) {
        setExpandedRows(newExpanded);
      }
    }
  }, [filters, safeVouchers]);
  
  // Handle column header click for sorting
  const handleSort = (field: keyof VoucherListItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // Data Transformation: Group reversals by their parent voucher
  const { displayVouchers, hasReversalMap } = useMemo(() => {
    // 1. Separate top-level vouchers from reversals
    const topLevel = safeVouchers.filter(v => !v.reversalOfVoucherId);
    const reversals = safeVouchers.filter(v => v.reversalOfVoucherId);
    
    // 2. Map reversals to their parent IDs for quick lookup
    const reversalGroups = reversals.reduce((acc, r) => {
      const pid = r.reversalOfVoucherId!;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(r);
      return acc;
    }, {} as Record<string, VoucherListItem[]>);
    
    // 3. Mark which vouchers have completions
    const hasReversalMap = new Set(Object.keys(reversalGroups));
    
    // 4. Identify which top-level items match directly or via children
    const filtered = topLevel.filter(v => {
      // Logic to check if an item (parent or any of its children) matches filters
      const checkMatch = (item: VoucherListItem) => {
        if (filters.dateFrom && new Date(item.date) < new Date(filters.dateFrom)) return false;
        if (filters.dateTo) {
          const toDate = new Date(filters.dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (new Date(item.date) > toDate) return false;
        }
        if (filters.statuses && filters.statuses.length > 0 && !filters.statuses.includes(item.status)) return false;
        if (filters.types && filters.types.length > 0 && !filters.types.includes(item.type)) return false;
        if (filters.searchNumber) {
          const s = filters.searchNumber.toLowerCase();
          if (!(item.voucherNo || item.id).toLowerCase().includes(s)) return false;
        }
        return true;
      };

      // Does the parent match?
      if (checkMatch(v)) return true;

      // Do any of its reversals match?
      const children = reversalGroups[v.id] || [];
      return children.some(child => checkMatch(child));
    });
    
    const sorted = filtered.sort((a, b) => {
      let aVal: any = a[sortField];
      let bVal: any = b[sortField];
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      
      if (sortField === 'date') {
        const aDate = new Date(a.date).getTime();
        const bDate = new Date(b.date).getTime();
        if (aDate === bDate) {
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return sortDirection === 'asc' ? aCreated - bCreated : bCreated - aCreated;
        }
        return sortDirection === 'asc' ? aDate - bDate : bDate - aDate;
      }
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    // 5. Flatten the structure for rendering (parent followed by its visible reversals)
    const result: Array<{ voucher: VoucherListItem, isNested: boolean }> = [];
    sorted.forEach(v => {
      result.push({ voucher: v, isNested: false });
      
      // If parent is expanded, add its reversals
      if (expandedRows.has(v.id) && reversalGroups[v.id]) {
        reversalGroups[v.id].forEach(rev => {
          result.push({ voucher: rev, isNested: true });
        });
      }
    });
    
    return { displayVouchers: result, hasReversalMap };
  }, [safeVouchers, sortField, sortDirection, filters, expandedRows]);
  
  // Render sort icon
  const renderSortIcon = (field: keyof VoucherListItem) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-30" />;
    return sortDirection === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />;
  };
  
  if (isLoading) {
    return <div className="p-8 text-center text-gray-500">Loading vouchers...</div>;
  }

  if (error) {
    return <div className="p-8 text-center text-red-500">Error: {error}</div>;
  }

  return (
    <div className="bg-[var(--color-bg-primary)] rounded-lg border border-[var(--color-border)] shadow-sm flex flex-col transition-colors duration-300">

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--color-border)]">
          <thead className="bg-[var(--color-bg-tertiary)] transition-colors duration-300">
            <tr>
              <th className="w-10"></th> {/* Expand icon column */}
              
              {/* Date & Time Header */}
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider group relative">
                <div className="flex items-center gap-2">
                  <span>Date & Time</span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSort('date')} className="p-1 hover:text-primary-600">
                      {renderSortIcon('date')}
                    </button>
                    <button onClick={() => setActiveFilterColumn(activeFilterColumn === 'date' ? null : 'date')} className={clsx("p-1 hover:text-primary-600", (filters.dateFrom || filters.dateTo) ? 'text-primary-600 opacity-100' : '')}>
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {activeFilterColumn === 'date' && (
                  <div ref={filterRef} className="absolute top-full left-0 mt-1 p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-xl rounded-md z-50 min-w-[200px] normal-case font-normal text-[var(--color-text-primary)]">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase mb-1">From</label>
                        <DatePicker 
                          value={filters.dateFrom || ''} 
                          onChange={(val: string) => setFilters({ ...filters, dateFrom: val })} 
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-[var(--color-text-muted)] uppercase mb-1">To</label>
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
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider group relative">
                <div className="flex items-center gap-2">
                  <span>Number</span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSort('voucherNo')} className="p-1 hover:text-primary-600">
                      {renderSortIcon('voucherNo')}
                    </button>
                    <button onClick={() => setActiveFilterColumn(activeFilterColumn === 'number' ? null : 'number')} className={clsx("p-1 hover:text-primary-600", filters.searchNumber ? 'text-primary-600 opacity-100' : '')}>
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {activeFilterColumn === 'number' && (
                  <div ref={filterRef} className="absolute top-full left-0 mt-1 p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-xl rounded-md z-50 min-w-[200px] normal-case font-normal text-[var(--color-text-primary)]">
                    <input type="text" placeholder="Search number..." value={filters.searchNumber || ''} onChange={(e) => setFilters({ ...filters, searchNumber: e.target.value })} className="w-full text-sm bg-[var(--color-bg-tertiary)] border-[var(--color-border)] rounded px-2 py-1" />
                  </div>
                )}
              </th>

              {/* Type Header */}
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider group relative">
                <div className="flex items-center gap-2">
                  <span>Type</span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSort('type')} className="p-1 hover:text-primary-600">
                      {renderSortIcon('type')}
                    </button>
                    <button onClick={() => setActiveFilterColumn(activeFilterColumn === 'type' ? null : 'type')} className={clsx("p-1 hover:text-primary-600", filters.types?.length ? 'text-primary-600 opacity-100' : '')}>
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {activeFilterColumn === 'type' && (
                  <div ref={filterRef} className="absolute top-full left-0 mt-1 p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-xl rounded-md z-50 min-w-[150px] normal-case font-normal text-[var(--color-text-primary)]">
                    <div className="space-y-1">
                      {uniqueTypes.map(type => (
                        <label key={type} className="flex items-center gap-2 p-1 hover:bg-[var(--color-bg-tertiary)] rounded cursor-pointer transition-colors">
                          <input type="checkbox" checked={filters.types?.includes(type) || false} onChange={(e) => {
                            const current = filters.types || [];
                            const updated = e.target.checked ? [...current, type] : current.filter(t => t !== type);
                            setFilters({ ...filters, types: updated.length > 0 ? updated : undefined });
                          }} className="rounded border-[var(--color-border)] text-primary-600 bg-[var(--color-bg-primary)]" />
                          <span className="text-sm">{type}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </th>

              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Prefix</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Source</th>
              
              {/* Status Header */}
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider group relative">
                <div className="flex items-center gap-2">
                  <span>Status</span>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleSort('status')} className="p-1 hover:text-primary-600">
                      {renderSortIcon('status')}
                    </button>
                    <button onClick={() => setActiveFilterColumn(activeFilterColumn === 'status' ? null : 'status')} className={clsx("p-1 hover:text-primary-600", filters.statuses?.length ? 'text-primary-600 opacity-100' : '')}>
                      <Filter className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                {activeFilterColumn === 'status' && (
                  <div ref={filterRef} className="absolute top-full left-0 mt-1 p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-xl rounded-md z-50 min-w-[150px] normal-case font-normal text-[var(--color-text-primary)]">
                    <div className="space-y-1">
                      {uniqueStatuses.map(status => (
                        <label key={status} className="flex items-center gap-2 p-1 hover:bg-[var(--color-bg-tertiary)] rounded cursor-pointer transition-colors">
                          <input type="checkbox" checked={filters.statuses?.includes(status) || false} onChange={(e) => {
                            const current = filters.statuses || [];
                            const updated = e.target.checked ? [...current, status] : current.filter(s => s !== status);
                            setFilters({ ...filters, statuses: updated.length > 0 ? updated : undefined });
                          }} className="rounded border-[var(--color-border)] text-primary-600 bg-[var(--color-bg-primary)]" />
                          <span className="text-sm capitalize">{status}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </th>

              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Debit</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Credit</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Ref</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-blue-500 uppercase tracking-wider">ID (Debug)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-purple-500 uppercase tracking-wider">RevOf (Debug)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-[var(--color-bg-primary)] divide-y divide-[var(--color-border)] transition-colors duration-300">
            {displayVouchers.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-6 py-12 text-center text-[var(--color-text-muted)] text-sm">
                  No vouchers found matching your filters.
                </td>
              </tr>
            ) : (
              displayVouchers.map(({ voucher, isNested }) => (
                <tr 
                  key={voucher.id} 
                  className={clsx(
                    "transition-colors group cursor-pointer",
                    isNested ? "bg-amber-50/30 dark:bg-amber-900/5 hover:bg-amber-50 dark:hover:bg-amber-900/10" : "hover:bg-primary-50 dark:hover:bg-primary-900/10"
                  )}
                  onClick={() => onRowClick?.(voucher.id)}
                >
                  <td className="pl-4 py-2">
                    {!isNested && hasReversalMap.has(voucher.id) && (
                      <button 
                        onClick={(e) => toggleRow(voucher.id, e)}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      >
                         <svg 
                           className={clsx("w-4 h-4 transition-transform duration-200", expandedRows.has(voucher.id) ? "rotate-90" : "")} 
                           fill="none" 
                           stroke="currentColor" 
                           viewBox="0 0 24 24"
                         >
                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="9 5l7 7-7 7" />
                         </svg>
                      </button>
                    )}
                  </td>
                  <td className={clsx("px-6 py-2 whitespace-nowrap text-sm text-[var(--color-text-primary)]", isNested && "pl-12")}>
                    <div className="flex flex-col">
                      <span className="font-medium">{formatCompanyDate(voucher.date, settings)}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">
                        {formatCompanyTime(voucher.createdAt || voucher.date, settings)}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm font-mono text-[var(--color-text-secondary)]">
                    <div className="flex items-center gap-2">
                       {voucher.voucherNo || voucher.id}
                       {isNested && <Badge variant="warning" className="text-[9px] px-1 py-0">REV</Badge>}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-[var(--color-text-secondary)]">
                    <span className={clsx(
                      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                      isNested ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]"
                    )}>
                      {voucher.type}
                    </span>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm font-mono text-[var(--color-text-secondary)]">
                    {(voucher as any).prefix || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)] truncate max-w-[120px]" title={(voucher as any).formId || ''}>
                    {(voucher as any).formId || '-'}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Badge variant={getStatusVariant(voucher.status)}>
                        {voucher.status.toUpperCase()}
                      </Badge>
                      
                      {voucher.status === 'approved' && (
                        <Badge 
                          variant={(voucher as any).postedAt ? 'success' : 'warning'}
                          title={(voucher as any).postedAt 
                            ? `Posted on ${formatCompanyDate((voucher as any).postedAt, settings)} (Mode: ${
                                voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED ? 'Strict' : 'Flexible'
                              })`
                            : undefined
                          }
                        >
                          {(voucher as any).postedAt ? 'POSTED' : 'NOT POSTED'}
                        </Badge>
                      )}
                      
                      {voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED && (
                        <Badge variant="error" title="This voucher is immutable because it was created under Strict Mode.">
                          <Lock className="w-3 h-3 inline-block mr-1" />
                          LOCKED
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-[var(--color-text-primary)] text-right font-mono">
                    {voucher.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {voucher.currency}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-sm text-[var(--color-text-primary)] text-right font-mono">
                    {voucher.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} {voucher.currency}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-[var(--color-text-secondary)] truncate max-w-[150px]">
                    {voucher.reference || '-'}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-xs font-mono text-blue-500 opacity-60">
                    {voucher.id.slice(-6)}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-xs font-mono text-purple-500 opacity-60">
                    {voucher.reversalOfVoucherId ? voucher.reversalOfVoucherId.slice(-6) : '-'}
                  </td>
                  <td className="px-6 py-2 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3 transition-opacity">
                      <button 
                        onClick={(e) => { e.stopPropagation(); onViewPrint?.(voucher.id); }}
                        className="text-[var(--color-text-muted)] hover:text-primary-600 transition-colors p-1.5 bg-[var(--color-bg-tertiary)] hover:bg-primary-50 dark:hover:bg-primary-900/40 rounded"
                        title="View Official / Print"
                      >
                        <Printer size={18} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onRowClick?.(voucher.id); }}
                        className="text-[var(--color-text-muted)] hover:text-primary-600 transition-colors p-1.5 bg-[var(--color-bg-tertiary)] hover:bg-primary-50 dark:hover:bg-primary-900/40 rounded"
                        title="View Details"
                      >
                        <Eye size={18} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onEdit?.(voucher); }}
                        disabled={voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED || isNested}
                        className={clsx(
                          "transition-colors p-1.5 rounded",
                          (voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED || isNested)
                            ? "text-gray-400 cursor-not-allowed opacity-50"
                            : "text-[var(--color-text-muted)] hover:text-primary-600 bg-[var(--color-bg-tertiary)] hover:bg-primary-50 dark:hover:bg-primary-900/40"
                        )}
                        title={isNested 
                            ? "Reversals are immutable."
                            : (voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED 
                                ? "Audit-locked. Use reversal to correct." 
                                : "Edit Voucher")
                        }
                      >
                        <Edit size={18} />
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDelete?.(voucher.id); }}
                        disabled={voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED || isNested}
                        className={clsx(
                          "transition-colors p-1.5 rounded",
                          (voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED || isNested)
                            ? "text-gray-400 cursor-not-allowed opacity-50"
                            : "text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 bg-[var(--color-bg-tertiary)] hover:bg-red-50 dark:hover:bg-red-900/40"
                        )}
                        title={isNested 
                            ? "Reversals cannot be deleted."
                            : (voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED 
                                ? "Audit-locked. Cannot delete." 
                                : "Delete Voucher")
                        }
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
