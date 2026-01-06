/**
 * VoucherTable.tsx
 */
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { VoucherListItem } from '../../../types/accounting/VoucherListTypes';
import { PostingLockPolicy } from '../../../types/accounting/PostingLockPolicy';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { Eye, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Filter, X, Printer, Lock, ChevronRight, ChevronDown, CheckCircle, RotateCcw, Ban, RefreshCw } from 'lucide-react';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { clsx } from 'clsx';
import { formatCompanyDate, formatCompanyTime } from '../../../utils/dateUtils';
import { DatePicker } from './shared/DatePicker';
import { useAccounts } from '../../../context/AccountsContext';
import { VoucherFormConfig } from '../voucher-wizard/types';
import { Info, GripVertical, Settings2, Check } from 'lucide-react';

const STORAGE_KEY_WIDTHS = 'erp_voucher_list_column_widths';
const STORAGE_KEY_FONT_SIZE = 'erp_voucher_list_font_size';
const STORAGE_KEY_VISIBLE_COLUMNS = 'erp_voucher_list_visible_columns';

const DEFAULT_COLUMN_WIDTHS = {
  expand: 48,
  date: 128,
  number: 160,
  type: 128,
  name: 192,
  debitAccount: 180,
  creditAccount: 180,
  creationMode: 80,
  approvedAt: 128,
  status: 96,
  amount: 128,
  ref: 128,
  actions: 96
};

const COLUMN_LABELS: Record<string, string> = {
  date: 'Date',
  number: 'Number',
  type: 'Type',
  name: 'Voucher Name',
  debitAccount: 'Debit Account',
  creditAccount: 'Credit Account',
  creationMode: 'C-Mode',
  approvedAt: 'Approved At',
  status: 'Status',
  amount: 'Amount',
  ref: 'Ref',
  actions: 'Actions'
};

interface Props {
  vouchers: VoucherListItem[];
  voucherTypes?: VoucherFormConfig[];
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
  onCancel?: (id: string) => void;
  dateRange?: { from: string; to: string };
  externalFilters?: {
    search?: string;
    type?: string;
    status?: string;
    formId?: string;
  };
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
  voucherTypes = [],
  pagination, 
  isLoading,
  error,
  onPageChange,
  onRowClick,
  onEdit,
  onDelete,
  onViewPrint,
  onCancel,
  dateRange,
  externalFilters = {}
}) => {
  const safeVouchers = Array.isArray(vouchers) ? vouchers : [];
  const pageInfo = pagination || { page: 1, pageSize: 20, totalItems: 0, totalPages: 0 };
  const { settings } = useCompanySettings();
  const { getAccountById } = useAccounts();
  
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
  
  // Resizable Columns state
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WIDTHS);
    if (saved) {
      try {
        return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) };
      } catch (e) {
        return DEFAULT_COLUMN_WIDTHS;
      }
    }
    return DEFAULT_COLUMN_WIDTHS;
  });

  const [fontSize, setFontSize] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY_FONT_SIZE) || 'text-sm';
  });

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VISIBLE_COLUMNS);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return Object.keys(COLUMN_LABELS);
      }
    }
    return Object.keys(COLUMN_LABELS);
  });

  const [showSettings, setShowSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleColumn = (col: string) => {
    setVisibleColumns(prev => 
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current || !tableContainerRef.current) return;
    const { column, startX, startWidth } = resizingRef.current;
    const deltaX = e.clientX - startX;
    
    let newWidth = Math.max(50, startWidth + deltaX);
    
    // Boundary check: Total width should not exceed container width
    const containerWidth = tableContainerRef.current.clientWidth;
    const otherColumnsWidth = Object.entries(columnWidths)
      .filter(([key]) => key !== column)
      .reduce((sum, [, width]) => sum + width, 0);
      
    if (newWidth + otherColumnsWidth > containerWidth) {
      newWidth = containerWidth - otherColumnsWidth;
    }

    if (newWidth < 50) newWidth = 50;
    
    setColumnWidths(prev => ({
      ...prev,
      [column]: newWidth
    }));
  }, [columnWidths]);

  const handleResizeEnd = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
  }, [handleResizeMove]);

  const handleResizeStart = useCallback((column: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingRef.current = {
      column,
      startX: e.clientX,
      startWidth: columnWidths[column] || 100
    };
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
  }, [columnWidths, handleResizeMove, handleResizeEnd]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WIDTHS, JSON.stringify(columnWidths));
  }, [columnWidths]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FONT_SIZE, fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VISIBLE_COLUMNS, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  // Normalize widths on mount if they exceed container width
  useEffect(() => {
    if (tableContainerRef.current) {
      const containerWidth = tableContainerRef.current.clientWidth;
      const totalWidth = Object.values(columnWidths).reduce((a, b) => a + b, 0);
      if (totalWidth > containerWidth && containerWidth > 0) {
        const ratio = containerWidth / totalWidth;
        setColumnWidths(prev => {
          const scaled = { ...prev };
          Object.keys(scaled).forEach(key => {
            scaled[key] = Math.max(50, Math.floor(scaled[key] * ratio));
          });
          return scaled;
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  const [filters, setFilters] = useState<ColumnFilter>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const filterRef = useRef<HTMLDivElement>(null);
  
  // 1. Pre-calculate Maps for efficient lookups (Hoisted from display logic)
  const { voucherMap, reversalGroups, isActuallyReversedMap, isReversalRejectedMap, hasReversalMap } = useMemo(() => {
    const vMap = new Map<string, VoucherListItem>();
    safeVouchers.forEach(v => vMap.set(v.id, v));

    const topLevel = safeVouchers.filter(v => !v.reversalOfVoucherId);
    const reversals = safeVouchers.filter(v => v.reversalOfVoucherId);

    const rGroups = reversals.reduce((acc, r) => {
      const pid = r.reversalOfVoucherId!;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(r);
      return acc;
    }, {} as Record<string, VoucherListItem[]>);

    // Identify status derived from children
    const actuallyReversed = new Set(
      Object.entries(rGroups)
        .filter(([pid, group]) => group.some(r => !!r.postedAt))
        .map(([pid]) => pid)
    );

    const reversalRejected = new Set(
      Object.entries(rGroups)
        .filter(([pid, group]) => group.some(r => r.status.toLowerCase() === 'rejected'))
        .map(([pid]) => pid)
    );

    const hasReversal = new Set(Object.keys(rGroups));

    return { 
      voucherMap: vMap, 
      reversalGroups: rGroups, 
      isActuallyReversedMap: actuallyReversed, 
      isReversalRejectedMap: reversalRejected,
      hasReversalMap: hasReversal
    };
  }, [safeVouchers]);

  // Helper: Get Derived Status for Display/Filtering
  const getDerivedStatus = useCallback((voucher: VoucherListItem) => {
    // 1. Check Reversal Status
    const hasVisibleReversal = hasReversalMap.has(voucher.id);
    const isReversed = !voucher.reversalOfVoucherId && (
      hasVisibleReversal 
        ? isActuallyReversedMap.has(voucher.id) 
        : !!voucher.metadata?.isReversed
    );

    if (isReversed) return 'Reversed';
    if (!!voucher.postedAt) return 'Posted';
    
    // Capitalize raw status
    return voucher.status.charAt(0).toUpperCase() + voucher.status.slice(1);
  }, [hasReversalMap, isActuallyReversedMap]);

  // Get unique values for filters (Using Derived Status)
  const uniqueStatuses = useMemo(() => {
    const statuses = new Set<string>();
    safeVouchers.forEach(v => {
      statuses.add(getDerivedStatus(v));
    });
    return Array.from(statuses).sort();
  }, [safeVouchers, getDerivedStatus]);
  
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

  // Shared matching logic for both filtering and auto-expansion (Origin-Aware)
  const checkMatch = useCallback((item: VoucherListItem) => {
    const hasActiveFilters = Object.keys(filters).length > 0 || Object.keys(externalFilters).length > 0;

    // 1. Check Date Range
    const from = filters.dateFrom || dateRange?.from;
    const to = filters.dateTo || dateRange?.to;
    
    if (from && item.date < from) return false;
    if (to && item.date > to) return false;
    
    // 2. Check Status (Using Derived Status)
    const statusFilter = filters.statuses || (externalFilters.status && externalFilters.status !== 'ALL' ? [externalFilters.status] : null);
    if (statusFilter && statusFilter.length > 0) {
      const derivedStatus = getDerivedStatus(item);
      // DEBUG: Log match attempt for analysis
      if (statusFilter.some(s => s.toLowerCase() === 'posted')) {
         console.log('DEBUG_STATUS_CHECK', { 
           id: item.id,
           rawStatus: item.status,
           derived: derivedStatus, 
           filters: statusFilter,
           matchResult: statusFilter.some(s => s.toLowerCase() === derivedStatus.toLowerCase())
         });
      }
      const match = statusFilter.some(s => s.toLowerCase() === derivedStatus.toLowerCase());
      if (!match) return false;
    }
    
    // 3. Check Type (Origin-Aware & Optimized)
    const typeFilter = filters.types || (externalFilters.type && externalFilters.type !== 'ALL' ? [externalFilters.type] : null);
    if (typeFilter && typeFilter.length > 0) {
      const itemType = item.type.toLowerCase();
      const isDirectMatch = typeFilter.some(t => t.toLowerCase() === itemType);
      
      let isReversalMatch = false;
      if (itemType === 'reversal') {
         if (item.reversalOfVoucherId) {
           const parent = voucherMap.get(item.reversalOfVoucherId);
           if (parent) {
             isReversalMatch = typeFilter.some(t => t.toLowerCase() === parent.type.toLowerCase());
           }
         }
         if (!isReversalMatch && item.metadata?.originType) {
            isReversalMatch = typeFilter.some(t => t.toLowerCase() === item.metadata?.originType?.toLowerCase());
         }
      }
      
      if (!isDirectMatch && !isReversalMatch) return false;
    }

    // 4. Check Search (Local and Global)
    const searchTerm = (filters.searchNumber || externalFilters.search || '').toLowerCase();
    if (searchTerm) {
      const searchableValue = (item.voucherNo || item.id || '').toLowerCase();
      if (!searchableValue.includes(searchTerm)) return false;
    }

    return true;
  }, [filters, externalFilters, dateRange, getDerivedStatus, voucherMap]);

  // AUTO-EXPAND rows that contain filtered results
  useEffect(() => {
    const isSearching = !!(filters.searchNumber || externalFilters.search || 
                         filters.statuses?.length || externalFilters.status ||
                         filters.types?.length || externalFilters.type ||
                         filters.dateFrom || filters.dateTo);
    if (isSearching && safeVouchers.length > 0) {
      const topLevel = safeVouchers.filter(v => !v.reversalOfVoucherId);
      const reversals = safeVouchers.filter(v => !!v.reversalOfVoucherId);
      
      const autoExpandTargetIds: string[] = [];

      topLevel.forEach(v => {
        // If parent doesn't match but child does, expand parent
        if (!checkMatch(v)) {
          const children = reversals.filter(r => r.reversalOfVoucherId === v.id);
          const hasMatchingChild = children.some(checkMatch);
          if (hasMatchingChild) {
            autoExpandTargetIds.push(v.id);
          }
        }
      });

      if (autoExpandTargetIds.length > 0) {
        console.log('AUTO_EXPAND_TRIGGER:', autoExpandTargetIds);
        setExpandedRows(prev => {
          const next = new Set(prev);
          let changed = false;
          autoExpandTargetIds.forEach(id => {
            if (!next.has(id)) {
              next.add(id);
              changed = true;
            }
          });
          return changed ? next : prev;
        });
      }
    }
  }, [filters, safeVouchers, checkMatch]);
  
  // Handle column header click for sorting
  const handleSort = (field: keyof VoucherListItem) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  // Data Transformation: Use pre-calculated maps and apply filtering/sorting
  const { displayVouchers } = useMemo(() => {
    // 1. Separate top-level vouchers from reversals (Using filtered set logic if needed, but here we iterate all)
    // Actually, we want to filter the top-level list based on checkMatch
    const topLevel = safeVouchers.filter(v => !v.reversalOfVoucherId);

    // 2. Filter top-level items
    const filtered = topLevel.filter(v => {
      // Does the parent match?
      if (checkMatch(v)) return true;

      // Do any of its reversals match?
      const children = reversalGroups[v.id] || [];
      return children.some(child => checkMatch(child));
    });
    
    // 3. Sort
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

    // 4. Flatten structure
    const result: Array<{ voucher: VoucherListItem, isNested: boolean }> = [];
    sorted.forEach(v => {
      result.push({ voucher: v, isNested: false });
      
      if (expandedRows.has(v.id) && reversalGroups[v.id]) {
        reversalGroups[v.id].forEach(rev => {
          result.push({ voucher: rev, isNested: true });
        });
      }
    });
    
    return { displayVouchers: result };
  }, [safeVouchers, sortField, sortDirection, filters, expandedRows, checkMatch, reversalGroups]);
  
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


      <div ref={tableContainerRef} className="overflow-x-auto relative max-w-full">
        <table className="w-full divide-y divide-[var(--color-border)] table-fixed" style={{ width: '100%', maxWidth: '100%' }}>
          <thead className="bg-[var(--color-bg-secondary)] select-none">
            <tr className="divide-x divide-[var(--color-border)]/50">
              <th className="px-2 py-3 text-center" style={{ width: columnWidths.expand }}>
                <div className="relative inline-block text-left" ref={settingsRef}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }}
                    className="p-1 hover:bg-[var(--color-bg-tertiary)] rounded-md transition-colors text-[var(--color-text-secondary)]"
                    title="Table Settings"
                  >
                    <Settings2 size={16} />
                  </button>
                  
                  {showSettings && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-xl rounded-lg z-[100] p-4 text-xs normal-case font-normal text-[var(--color-text-primary)]">
                      <div className="mb-4">
                        <h3 className="font-bold text-[var(--color-text-primary)] uppercase mb-2 tracking-wider">Font Size</h3>
                        <div className="flex gap-2">
                          {['text-xs', 'text-sm', 'text-base'].map(size => (
                            <button
                              key={size}
                              onClick={() => setFontSize(size)}
                              className={clsx(
                                "px-2 py-1 rounded border transition-all truncate flex-1",
                                fontSize === size 
                                  ? "bg-primary-600 text-white border-primary-600" 
                                  : "bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] border-[var(--color-border)] hover:border-primary-500"
                              )}
                            >
                              {size.replace('text-', '').toUpperCase()}
                            </button>
                          ))}
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="font-bold text-[var(--color-text-primary)] uppercase mb-2 tracking-wider">Visible Columns</h3>
                        <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
                          {Object.entries(COLUMN_LABELS).map(([key, label]) => (
                            <button
                              key={key}
                              onClick={() => toggleColumn(key)}
                              className={clsx(
                                "flex items-center justify-between px-2 py-1.5 rounded transition-colors text-left",
                                visibleColumns.includes(key)
                                  ? "bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300"
                                  : "text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-tertiary)]"
                              )}
                            >
                              <span>{label}</span>
                              {visibleColumns.includes(key) && <Check size={14} />}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </th>
              
              {/* Date Header */}
              {visibleColumns.includes('date') && (
                <th 
                  className={clsx("px-6 py-3 text-left font-medium text-[var(--color-text-secondary)] uppercase tracking-wider group relative", fontSize)}
                  style={{ width: columnWidths.date }}
                >
                  <div className="flex items-center gap-2">
                    <span>Date</span>
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
                          <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">From</label>
                          <DatePicker 
                            value={filters.dateFrom || ''} 
                            onChange={(val: string) => setFilters({ ...filters, dateFrom: val })} 
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-[var(--color-text-muted)] uppercase mb-1">To</label>
                          <DatePicker 
                            value={filters.dateTo || ''} 
                            onChange={(val: string) => setFilters({ ...filters, dateTo: val })} 
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div onMouseDown={(e) => handleResizeStart('date', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 transition-colors z-10" />
                </th>
              )}

              {visibleColumns.includes('number') && (
                <th 
                  className={clsx("px-6 py-3 text-left font-medium text-[var(--color-text-secondary)] uppercase tracking-wider group relative", fontSize)}
                  style={{ width: columnWidths.number }}
                >
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
                      <input 
                        type="text" 
                        placeholder="Search number..." 
                        className="w-full px-2 py-1 text-xs border border-[var(--color-border)] rounded bg-[var(--color-bg-primary)] focus:ring-1 focus:ring-primary-500 outline-none" 
                        value={filters.searchNumber || ''} 
                        onChange={(e) => setFilters({ ...filters, searchNumber: e.target.value })}
                      />
                    </div>
                  )}
                  <div onMouseDown={(e) => handleResizeStart('number', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 transition-colors z-10" />
                </th>
              )}

              {/* Type Header */}
              {visibleColumns.includes('type') && (
                <th 
                  className={clsx("px-6 py-3 text-left font-medium text-[var(--color-text-secondary)] uppercase tracking-wider group relative", fontSize)}
                  style={{ width: columnWidths.type }}
                >
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
                            <span className="text-xs">{type}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div onMouseDown={(e) => handleResizeStart('type', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 transition-colors z-10" />
                </th>
              )}

              {visibleColumns.includes('name') && (
                <th className={clsx("px-6 py-3 text-left font-medium text-[var(--color-text-secondary)] uppercase tracking-wider relative group", fontSize)} style={{ width: columnWidths.name }}>
                  Voucher Name
                  <div onMouseDown={(e) => handleResizeStart('name', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 transition-colors z-10" />
                </th>
              )}
              {visibleColumns.includes('debitAccount') && (
                <th className={clsx("px-6 py-3 text-left font-medium text-[var(--color-text-secondary)] uppercase tracking-wider relative group", fontSize)} style={{ width: columnWidths.debitAccount }}>
                  Debit Account
                  <div onMouseDown={(e) => handleResizeStart('debitAccount', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 transition-colors z-10" />
                </th>
              )}
              {visibleColumns.includes('creditAccount') && (
                <th className={clsx("px-6 py-3 text-left font-medium text-[var(--color-text-secondary)] uppercase tracking-wider relative group", fontSize)} style={{ width: columnWidths.creditAccount }}>
                  Credit Account
                  <div onMouseDown={(e) => handleResizeStart('creditAccount', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 transition-colors z-10" />
                </th>
              )}
              {visibleColumns.includes('creationMode') && (
                <th className={clsx("px-6 py-3 text-center font-medium text-[var(--color-text-secondary)] uppercase tracking-wider relative group", fontSize)} style={{ width: columnWidths.creationMode }}>
                  C-Mode
                  <div onMouseDown={(e) => handleResizeStart('creationMode', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 transition-colors z-10" />
                </th>
              )}
              {visibleColumns.includes('approvedAt') && (
                <th className={clsx("px-6 py-3 text-left font-medium text-[var(--color-text-secondary)] uppercase tracking-wider relative group", fontSize)} style={{ width: columnWidths.approvedAt }}>
                  Approved At
                  <div onMouseDown={(e) => handleResizeStart('approvedAt', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 transition-colors z-10" />
                </th>
              )}
              
              {/* Status Header */}
              {visibleColumns.includes('status') && (
                <th 
                  className={clsx("px-6 py-3 text-center font-medium text-[var(--color-text-secondary)] uppercase tracking-wider group relative", fontSize)}
                  style={{ width: columnWidths.status }}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span>Status</span>
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity absolute right-2">
                      <button 
                        onClick={() => setActiveFilterColumn(activeFilterColumn === 'status' ? null : 'status')} 
                        className={clsx("p-1 hover:text-primary-600", filters.statuses?.length ? 'text-primary-600 opacity-100' : '')}
                      >
                        <Filter className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  {activeFilterColumn === 'status' && (
                    <div ref={filterRef} className="absolute top-full right-0 mt-1 p-3 bg-[var(--color-bg-primary)] border border-[var(--color-border)] shadow-xl rounded-md z-50 min-w-[150px] normal-case font-normal text-[var(--color-text-primary)] text-left">
                      <div className="space-y-1 max-h-[200px] overflow-y-auto">
                        {uniqueStatuses.map(status => (
                          <label key={status} className="flex items-center gap-2 p-1 hover:bg-[var(--color-bg-tertiary)] rounded cursor-pointer transition-colors">
                            <input 
                              type="checkbox" 
                              checked={filters.statuses?.includes(status) || false} 
                              onChange={(e) => {
                                const current = filters.statuses || [];
                                const updated = e.target.checked ? [...current, status] : current.filter(s => s !== status);
                                setFilters({ ...filters, statuses: updated.length > 0 ? updated : undefined });
                              }} 
                              className="rounded border-[var(--color-border)] text-primary-600 bg-[var(--color-bg-primary)]" 
                            />
                            <span className="text-xs">{status}</span>
                          </label>
                        ))}
                      </div>
                      <div className="mt-3 pt-2 border-t border-[var(--color-border)] flex justify-end">
                         <Button 
                           variant="primary" 
                           size="sm" 
                           className="text-xs px-2 py-1 h-auto"
                           onClick={() => {
                              setActiveFilterColumn(null);
                           }}
                         >
                           Apply
                         </Button>
                      </div>
                    </div>
                  )}
                  <div onMouseDown={(e) => handleResizeStart('status', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 transition-colors z-10" />
                </th>
              )}

              {visibleColumns.includes('amount') && (
                <th className={clsx("px-6 py-3 text-right font-medium text-[var(--color-text-secondary)] uppercase tracking-wider relative group", fontSize)} style={{ width: columnWidths.amount }}>
                  Amount
                  <div onMouseDown={(e) => handleResizeStart('amount', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 transition-colors z-10" />
                </th>
              )}
              {visibleColumns.includes('ref') && (
                <th className={clsx("px-6 py-3 text-left font-medium text-[var(--color-text-secondary)] uppercase tracking-wider relative group", fontSize)} style={{ width: columnWidths.ref }}>
                  Ref
                  <div onMouseDown={(e) => handleResizeStart('ref', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 transition-colors z-10" />
                </th>
              )}
              {visibleColumns.includes('actions') && (
                <th className={clsx("px-6 py-3 text-right font-medium text-[var(--color-text-secondary)] uppercase tracking-wider relative group", fontSize)} style={{ width: columnWidths.actions }}>
                  Actions
                  <div onMouseDown={(e) => handleResizeStart('actions', e)} className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary-500/30 transition-colors z-10" />
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-[var(--color-bg-primary)] divide-y divide-[var(--color-border)] transition-colors duration-300">
            {displayVouchers.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + 1} className={clsx("px-6 py-12 text-center text-[var(--color-text-muted)]", fontSize)}>
                  No vouchers found matching your filters.
                </td>
              </tr>
            ) : (
              displayVouchers.map(({ voucher, isNested }) => {
                const voucherTypeInfo = voucherTypes.find(vt => vt.id === voucher.formId || (vt as any)._typeId === voucher.formId);
                const voucherName = voucherTypeInfo?.name || voucher.type;
                
                // Extract primary accounts
                const debitLines = voucher.lines?.filter(l => l.side === 'Debit') || [];
                const creditLines = voucher.lines?.filter(l => l.side === 'Credit') || [];
                
                const debitAccountName = debitLines.length === 1 
                  ? (getAccountById(debitLines[0].accountId)?.name || debitLines[0].accountId)
                  : (debitLines.length > 1 ? 'Multiple Accounts' : '-');
                  
                const creditAccountName = creditLines.length === 1 
                  ? (getAccountById(creditLines[0].accountId)?.name || creditLines[0].accountId)
                  : (creditLines.length > 1 ? 'Multiple Accounts' : '-');

                const isBalanced = Math.abs(voucher.totalDebit - voucher.totalCredit) < 0.01;
                const displayAmount = isBalanced ? voucher.totalDebit : `D: ${voucher.totalDebit} / C: ${voucher.totalCredit}`;

                return (
                  <tr 
                    key={voucher.id} 
                    className={clsx(
                      "transition-colors group cursor-pointer border-b border-[var(--color-border)]",
                      isNested ? "bg-amber-50/30 dark:bg-amber-900/5 hover:bg-amber-50 dark:hover:bg-amber-900/10" : "hover:bg-primary-50 dark:hover:bg-primary-900/10"
                    )}
                    onClick={() => onRowClick?.(voucher.id)}
                  >
                    <td className="px-2 py-3 text-center">
                      {!isNested && hasReversalMap.has(voucher.id) && (
                        <button 
                          onClick={(e) => toggleRow(voucher.id, e)}
                          className={clsx(
                            "p-1 rounded-md border transition-all duration-200",
                            expandedRows.has(voucher.id) 
                              ? "bg-amber-100 border-amber-200 text-amber-700 dark:bg-amber-900/40 dark:border-amber-800"
                              : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-white hover:border-primary-300 hover:text-primary-600 dark:bg-gray-800/50 dark:border-gray-700"
                          )}
                        >
                           {expandedRows.has(voucher.id) ? (
                             <ChevronDown size={14} />
                           ) : (
                             <ChevronRight size={14} />
                           )}
                        </button>
                      )}
                    </td>

                    {visibleColumns.includes('date') && (
                      <td className={clsx("px-6 py-3 whitespace-nowrap text-[var(--color-text-primary)]", isNested && "pl-12", fontSize)}>
                        <div className="flex flex-col">
                          <span className="font-medium">{formatCompanyDate(voucher.date, settings)}</span>
                          <span className={clsx("text-[var(--color-text-secondary)] opacity-70", fontSize === 'text-xs' ? 'text-[10px]' : 'text-xs')}>
                            {formatCompanyTime(voucher.createdAt || voucher.date, settings)}
                          </span>
                        </div>
                      </td>
                    )}

                    {visibleColumns.includes('number') && (
                      <td className={clsx("px-6 py-3 whitespace-nowrap font-mono text-[var(--color-text-secondary)]", fontSize)}>
                        <div className="flex items-center gap-2">
                           {voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED && (
                             <span title="Audit Locked">
                               <Lock size={12} className="text-amber-600" />
                             </span>
                           )}
                           {isNested && (
                             <span title="Reversal">
                               <RotateCcw size={12} className="text-amber-600" />
                             </span>
                           )}
                           {!isNested && hasReversalMap.has(voucher.id) && !isActuallyReversedMap.has(voucher.id) && (
                             isReversalRejectedMap.has(voucher.id) ? (
                               <span title="Reversal Rejected">
                                 <RefreshCw size={12} className="text-red-500" />
                               </span>
                             ) : (
                               <span title="Reversal Pending Approval">
                                 <RefreshCw size={12} className="text-amber-500 animate-pulse" />
                               </span>
                             )
                           )}
                           <span className={clsx(
                             voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED && "font-bold text-[var(--color-text-primary)]",
                             isNested && "italic"
                           )}>
                              {voucher.voucherNo || voucher.id.slice(-8)}
                           </span>
                        </div>
                      </td>
                    )}

                    {visibleColumns.includes('type') && (
                      <td className={clsx("px-6 py-3 whitespace-nowrap text-[var(--color-text-secondary)]", fontSize)}>
                        <span className={clsx(
                          "inline-flex items-center px-1.5 py-0.5 rounded font-medium",
                          isNested ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)]",
                          fontSize
                        )}>
                          {voucher.type}
                        </span>
                      </td>
                    )}

                    {visibleColumns.includes('name') && (
                      <td className={clsx("px-6 py-3 whitespace-nowrap text-[var(--color-text-primary)] font-medium truncate", fontSize)} title={voucherName}>
                        {voucherName}
                      </td>
                    )}

                    {visibleColumns.includes('debitAccount') && (
                      <td className={clsx("px-6 py-3 whitespace-nowrap text-[var(--color-text-secondary)] truncate", fontSize)} title={debitAccountName}>
                        {debitAccountName}
                      </td>
                    )}

                    {visibleColumns.includes('creditAccount') && (
                      <td className={clsx("px-6 py-3 whitespace-nowrap text-[var(--color-text-secondary)] truncate", fontSize)} title={creditAccountName}>
                        {creditAccountName}
                      </td>
                    )}

                    {visibleColumns.includes('creationMode') && (
                      <td className="px-6 py-3 whitespace-nowrap text-center">
                        {(() => {
                          const mode = voucher.metadata?.creationMode || 
                                      (voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED ? 'STRICT' : 
                                       voucher.postingLockPolicy === PostingLockPolicy.FLEXIBLE_LOCKED ? 'FLEXIBLE' : '-');
                          
                          if (mode === '-') return <span className={clsx("text-gray-400", fontSize)}>-</span>;

                          return (
                            <span className={clsx(
                              "inline-flex items-center px-1 py-0.5 rounded font-bold uppercase tracking-tight border",
                              mode === 'STRICT' ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-emerald-50 text-emerald-600 border-emerald-100",
                              fontSize
                            )}>
                              {mode}
                            </span>
                          );
                        })()}
                      </td>
                    )}

                    {visibleColumns.includes('approvedAt') && (
                      <td className={clsx("px-6 py-3 whitespace-nowrap text-[var(--color-text-secondary)]", fontSize)}>
                        {voucher.approvedAt ? (
                          <div className="flex flex-col">
                            <span>{formatCompanyDate(voucher.approvedAt, settings)}</span>
                            <span className={clsx("opacity-70", fontSize === 'text-xs' ? 'text-[10px]' : 'text-xs')}>{formatCompanyTime(voucher.approvedAt, settings)}</span>
                          </div>
                        ) : (
                          <span className="text-gray-400 font-mono">-</span>
                        )}
                      </td>
                    )}

                    {visibleColumns.includes('status') && (
                      <td className="px-6 py-3 whitespace-nowrap text-center text-xs">
                        <div className="flex items-center justify-center">
                          {(() => {
                            const hasVisibleReversal = hasReversalMap.has(voucher.id);
                            const isReversed = !isNested && (
                              hasVisibleReversal 
                                ? isActuallyReversedMap.has(voucher.id) 
                                : !!voucher.metadata?.isReversed
                            );
                            const isPosted = !!voucher.postedAt;
                            
                            let label = voucher.status.charAt(0).toUpperCase() + voucher.status.slice(1);
                            let variant: any = getStatusVariant(voucher.status);
                            let Icon = null;

                            if (isReversed) {
                              label = 'Reversed';
                              variant = 'warning';
                              Icon = RotateCcw;
                            } else if (isPosted) {
                              label = 'Posted';
                              variant = 'success';
                              Icon = CheckCircle;
                            }

                            return (
                              <Badge 
                                variant={variant}
                                className={clsx(
                                  "flex items-center gap-1 px-2 py-0.5 rounded-full font-bold shadow-sm transition-all whitespace-nowrap uppercase tracking-tighter",
                                  (isPosted && !isReversed) && "bg-emerald-600 text-white border-none",
                                  isReversed && "bg-amber-500 text-white border-none",
                                  fontSize
                                )}
                                title={voucher.postedAt ? `Posted on ${formatCompanyDate(voucher.postedAt, settings)}` : label}
                              >
                                {Icon && <Icon size={fontSize === 'text-xs' ? 10 : 12} className="stroke-[3px]" />}
                                {label}
                              </Badge>
                            );
                          })()}
                        </div>
                      </td>
                    )}

                    {visibleColumns.includes('amount') && (
                      <td className={clsx("px-6 py-3 whitespace-nowrap text-[var(--color-text-primary)] text-right font-mono font-semibold", fontSize)}>
                        {typeof displayAmount === 'number' 
                          ? `${displayAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${voucher.currency}`
                          : displayAmount}
                      </td>
                    )}

                    {visibleColumns.includes('ref') && (
                      <td className={clsx("px-6 py-3 whitespace-nowrap text-[var(--color-text-muted)] truncate", fontSize)} title={voucher.reference || ''}>
                        {voucher.reference || '-'}
                      </td>
                    )}

                    {visibleColumns.includes('actions') && (
                      <td className="px-6 py-3 whitespace-nowrap text-right font-medium">
                        <div className="flex items-center justify-end gap-2 text-[var(--color-text-secondary)]">
                          <button 
                            onClick={(e) => { e.stopPropagation(); onViewPrint?.(voucher.id); }}
                            className="hover:text-primary-600 transition-colors p-1"
                            title="View Official / Print"
                          >
                            <Printer size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onEdit?.(voucher); }}
                            disabled={voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED || isNested}
                            className={clsx(
                              "transition-colors p-1",
                              (voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED || isNested)
                                ? "text-gray-300 cursor-not-allowed"
                                : "hover:text-primary-600"
                            )}
                            title="Edit Voucher"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); onDelete?.(voucher.id); }}
                            disabled={voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED || isNested}
                            className={clsx(
                              "transition-colors p-1",
                              (voucher.postingLockPolicy === PostingLockPolicy.STRICT_LOCKED || isNested)
                                ? "text-gray-300 cursor-not-allowed"
                                : "hover:text-red-600"
                            )}
                            title="Delete Voucher"
                          >
                            <Trash2 size={16} />
                          </button>
                          {(voucher.status.toLowerCase() === 'draft' || voucher.status.toLowerCase() === 'approved') && !voucher.postedAt && !isNested && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); onCancel?.(voucher.id); }}
                              className="hover:text-amber-600 transition-colors p-1"
                              title="Cancel / Void Voucher"
                            >
                              <Ban size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
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
