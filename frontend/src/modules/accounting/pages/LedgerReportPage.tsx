import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../../components/ui/Button';
import { accountingApi } from '../../../api/accountingApi';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { AccountSelector } from '../components/shared/AccountSelector';
import { CostCenterSelector } from '../components/shared/CostCenterSelector';
import { 
  ArrowRight, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Settings2,
  Check
} from 'lucide-react';
import { ReportContainer } from '../../../components/reports/ReportContainer';
import { clsx } from 'clsx';

// Storage keys for personalization
const STORAGE_KEY_WIDTHS = 'erp_ledger_report_column_widths';
const STORAGE_KEY_VISIBLE_COLUMNS = 'erp_ledger_report_visible_columns';

const DEFAULT_COLUMN_WIDTHS: Record<string, number> = {
  index: 36,
  date: 140,
  voucherNo: 180,
  description: 300,
  costCenter: 120,
  debit: 140,
  credit: 140,
  balance: 160,
};

const ALL_COLUMNS = [
  { id: 'index', label: '#', permanent: true },
  { id: 'date', label: 'Date', sortable: true, filterable: true },
  { id: 'voucherNo', label: 'Reference', sortable: true, filterable: true },
  { id: 'description', label: 'Particulars', sortable: true, filterable: true },
  { id: 'costCenter', label: 'Cost Center', sortable: true, filterable: true },
  { id: 'debit', label: 'Total Dr.', sortable: true },
  { id: 'credit', label: 'Total Cr.', sortable: true },
  { id: 'balance', label: 'Resulting Bal.', permanent: true },
];

interface LedgerParams {
  accountId: string;
  accountName: string;
  fromDate: string;
  toDate: string;
  costCenterId?: string;
  costCenterLabel?: string;
}

const LedgerInitiator: React.FC<{ 
  onSubmit: (params: LedgerParams) => void; 
  initialParams?: LedgerParams | null;
  isModal?: boolean;
}> = ({ onSubmit, initialParams }) => {
  const [accountId, setAccountId] = useState(initialParams?.accountId || '');
  const [accountName, setAccountName] = useState(initialParams?.accountName || ''); 
  const [costCenterId, setCostCenterId] = useState(initialParams?.costCenterId || '');
  const [costCenterLabel, setCostCenterLabel] = useState(initialParams?.costCenterLabel || '');
  const [fromDate, setFromDate] = useState(() => {
    if (initialParams?.fromDate) return initialParams.fromDate;
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState(() => initialParams?.toDate || new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) return;
    onSubmit({ accountId, accountName, fromDate, toDate, costCenterId: costCenterId || undefined, costCenterLabel: costCenterLabel || undefined });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="space-y-2 md:col-span-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            General Ledger Account <span className="text-red-500">*</span>
          </label>
          <div onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } }}>
            <AccountSelector 
              value={accountId}
              onChange={(account) => {
                if (account) { setAccountId(account.id); setAccountName(account.name); }
                else { setAccountId(''); setAccountName(''); }
              }}
              placeholder="Select account to analyze..."
            />
          </div>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">
            Cost Center <span className="text-[8px] text-slate-400 normal-case">(optional)</span>
          </label>
          <div onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } }}>
            <CostCenterSelector
              value={costCenterId}
              onChange={(cc) => {
                if (cc) { setCostCenterId(cc.id); setCostCenterLabel(`${cc.code} - ${cc.name}`); }
                else { setCostCenterId(''); setCostCenterLabel(''); }
              }}
              placeholder="All cost centers..."
            />
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">From Date</label>
          <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none" />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">To Date</label>
          <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none" />
        </div>
      </div>
      <div className="flex justify-start pt-6 border-t border-slate-100">
        <Button type="submit" disabled={!accountId} className="bg-slate-900 hover:bg-black text-white px-10 py-2.5 rounded text-xs font-bold uppercase tracking-widest">
          Execute Analysis
        </Button>
      </div>
    </form>
  );
};

interface LedgerEntry {
  id: string; date: string; voucherNo: string; description: string; debit: number; credit: number; runningBalance?: number; costCenterId?: string; costCenterCode?: string; costCenterName?: string;
}

const LedgerReportContent: React.FC<{ 
  params: LedgerParams;
  pagination?: { page: number; pageSize: number; onPageChange: (page: number) => void; onPageSizeChange: (size: number) => void; totalItems: number; };
  setTotalItems?: (total: number) => void;
  visibleColumns?: string[];
  density?: 'compact' | 'comfortable';
}> = ({ params, pagination, setTotalItems, visibleColumns: _ignore, density = 'comfortable' }) => {
  const isCompact = density === 'compact';
  const { settings } = useCompanySettings();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [openingBalance, setOpeningBalance] = useState(0);

  // Advanced Table States
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WIDTHS);
    return saved ? JSON.parse(saved) : DEFAULT_COLUMN_WIDTHS;
  });

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_VISIBLE_COLUMNS);
    const savedIds = saved ? JSON.parse(saved) : ALL_COLUMNS.map(c => c.id);
    // Ensure all permanent columns are present
    const permanentIds = ALL_COLUMNS.filter(c => c.permanent).map(c => c.id);
    const combined = Array.from(new Set([...permanentIds, ...savedIds]));
    return combined;
  });

  const [sortField, setSortField] = useState<keyof LedgerEntry | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [localFilter, setLocalFilter] = useState('');
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WIDTHS, JSON.stringify(columnWidths));
  }, [columnWidths]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_VISIBLE_COLUMNS, JSON.stringify(visibleColumns));
  }, [visibleColumns]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const offset = pagination ? (pagination.page - 1) * pagination.pageSize : 0;
        const response = await accountingApi.getGeneralLedger(params.accountId, params.fromDate, params.toDate, pagination?.pageSize || 100, offset, params.costCenterId);
        setEntries(response.data || []);
        if (setTotalItems && response.meta) {
          setTotalItems(response.meta.totalItems);
          setOpeningBalance(response.meta.openingBalance || 0);
        }
      } catch (error) { console.error('Ledger error:', error); } finally { setLoading(false); }
    };
    fetchData();
  }, [params, pagination?.page, pagination?.pageSize]);

  // Derived Data
  const filteredAndSortedEntries = useMemo(() => {
    let result = [...entries];
    
    if (localFilter) {
      const term = localFilter.toLowerCase();
      result = result.filter(e => 
        e.voucherNo.toLowerCase().includes(term) || 
        (e.description || '').toLowerCase().includes(term) ||
        (e.costCenterCode || '').toLowerCase().includes(term)
      );
    }

    if (sortField) {
      result.sort((a, b) => {
        const aVal = a[sortField];
        const bVal = b[sortField];
        if (aVal === bVal) return 0;
        if (aVal === undefined) return 1;
        if (bVal === undefined) return -1;
        const mod = sortDirection === 'asc' ? 1 : -1;
        return aVal < bVal ? -1 * mod : 1 * mod;
      });
    }

    return result;
  }, [entries, sortField, sortDirection, localFilter]);

  const summary = useMemo(() => {
    const periodTotals = filteredAndSortedEntries.reduce((acc, entry) => ({
      debit: acc.debit + (entry.debit || 0),
      credit: acc.credit + (entry.credit || 0),
    }), { debit: 0, credit: 0 });
    return {
      opening: openingBalance,
      debit: periodTotals.debit,
      credit: periodTotals.credit,
      closing: openingBalance + (periodTotals.debit - periodTotals.credit),
      net: periodTotals.debit - periodTotals.credit
    };
  }, [filteredAndSortedEntries, openingBalance]);

  // Column resizing logic
  const resizingRef = useRef<{ column: string; startX: number; startWidth: number } | null>(null);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { column, startX, startWidth } = resizingRef.current;
    const deltaX = e.clientX - startX;
    setColumnWidths(prev => ({
      ...prev,
      [column]: Math.max(30, startWidth + deltaX)
    }));
  }, []);

  const handleResizeEnd = useCallback(() => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = '';
  }, [handleResizeMove]);

  const handleResizeStart = (column: string, e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = { column, startX: e.clientX, startWidth: columnWidths[column] || 100 };
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
  };

  const handleSort = (field: keyof LedgerEntry) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="flex gap-1.5">
         {[1,2,3].map(i => <div key={i} className="w-2 h-2 bg-slate-200 rounded-full animate-bounce" style={{ animationDelay: (i*0.2)+'s' }} />)}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* HEADER: Audit Context */}
      <div className="shrink-0 bg-slate-50 border-b border-slate-200 grid grid-cols-2 md:grid-cols-4">
         <div className="p-2.5 border-r border-slate-200">
            <span className="text-[8px] font-black text-slate-400 font-mono uppercase tracking-[0.2em] block mb-0.5">Target Account</span>
            <span className="text-xs font-bold text-slate-900 border-l-2 border-slate-900 pl-2 block truncate">{params.accountName}</span>
         </div>
         <div className="p-2.5 border-r border-slate-200">
            <span className="text-[8px] font-black text-slate-400 font-mono uppercase tracking-[0.2em] block mb-0.5">Audit Period</span>
            <span className="text-[11px] font-bold text-slate-700 block">{formatCompanyDate(params.fromDate, settings)} <ArrowRight className="inline mx-1 text-slate-300" size={10} /> {formatCompanyDate(params.toDate, settings)}</span>
         </div>
         <div className="p-2.5 border-r border-slate-200">
            <span className="text-[8px] font-black text-slate-400 font-mono uppercase tracking-[0.2em] block mb-0.5">Opening</span>
            <span className="text-xs font-black text-slate-900 tabular-nums">{summary.opening.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
         </div>
         <div className="p-2.5">
            <span className="text-[8px] font-black text-slate-400 font-mono uppercase tracking-[0.2em] block mb-0.5">Period Net</span>
            <span className="text-xs font-black text-slate-900 tabular-nums">{summary.net.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
         </div>
      </div>

      {/* FILTER & SETTINGS BAR */}
      <div className="shrink-0 bg-white border-b border-slate-100 px-4 py-2 flex items-center justify-between">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input 
            type="text" 
            placeholder="Quick filter particulars or references..." 
            value={localFilter}
            onChange={(e) => setLocalFilter(e.target.value)}
            className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded text-xs w-80 outline-none focus:border-slate-400"
          />
        </div>
        
        <div className="relative" ref={settingsRef}>
          <button 
            onClick={() => setShowColumnSettings(!showColumnSettings)}
            className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 transition-colors"
          >
            <Settings2 size={14} />
            Column Registry
          </button>
          
          {showColumnSettings && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 shadow-xl z-50 p-4 rounded-sm">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3 pb-2 border-b border-slate-100">Visibility Dashboard</h4>
              <div className="space-y-1">
                {ALL_COLUMNS.map(col => (
                  <label key={col.id} className="flex items-center justify-between p-2 hover:bg-slate-50 cursor-pointer rounded transition-colors">
                    <span className="text-xs font-semibold text-slate-700">{col.label}</span>
                    <input 
                      type="checkbox" 
                      checked={visibleColumns.includes(col.id)} 
                      disabled={col.permanent}
                      onChange={() => {
                        if (col.permanent) return;
                        setVisibleColumns(prev => 
                          prev.includes(col.id) ? prev.filter(c => c !== col.id) : [...prev, col.id]
                        );
                      }}
                      className="rounded border-slate-300 text-slate-900 focus:ring-0"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* BODY: Pro Table */}
      <div className="flex-1 min-h-0 overflow-auto custom-scroll bg-slate-50/50">
        <table className="w-full text-left border-collapse table-fixed bg-white">
          <thead className="sticky top-0 z-20 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
            <tr>
              {ALL_COLUMNS.filter(c => visibleColumns.includes(c.id)).map(col => (
                <th 
                  key={col.id} 
                  className={clsx(
                    "relative group border-b border-r border-slate-200 h-8 last:border-r-0",
                    col.id === 'index' ? 'px-0.5' : 'px-3'
                  )}
                  style={{ width: columnWidths[col.id] || 150 }}
                >
                  <div className="flex items-center justify-between gap-1 overflow-hidden">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-500 truncate">{col.label}</span>
                    {col.sortable && (
                      <button 
                        onClick={() => handleSort(col.id as keyof LedgerEntry)}
                        className={clsx(
                          "p-1 rounded hover:bg-slate-100 transition-colors shrink-0",
                          sortField === col.id ? "text-slate-900" : "text-slate-300 opacity-0 group-hover:opacity-100"
                        )}
                      >
                        {sortField === col.id ? (
                          sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                        ) : <ArrowUpDown size={12} />}
                      </button>
                    )}
                  </div>
                  {/* Resize Handle */}
                  <div 
                    onMouseDown={(e) => handleResizeStart(col.id, e)}
                    className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-slate-300 transition-colors z-30" 
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-900">
            {filteredAndSortedEntries.length === 0 ? (
              <tr><td colSpan={visibleColumns.length} className="py-20 text-center text-slate-400 text-xs font-medium uppercase tracking-widest bg-white">Zero matched transactions in registry</td></tr>
            ) : (
              filteredAndSortedEntries.map((entry, idx) => (
                <tr 
                  key={entry.id} 
                  className={clsx(
                    isCompact ? 'text-[10px]' : 'text-[12px]',
                    'transition-colors group border-b border-slate-100',
                    idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50',
                    'hover:bg-blue-50/30'
                  )}
                >
                  {visibleColumns.includes('index') && (
                    <td className={clsx(
                      isCompact ? 'py-0.5' : 'py-1',
                      'px-0.5 text-center font-mono text-[9px] text-slate-400 border-r border-slate-100'
                    )}>
                      {(pagination ? (pagination.page - 1) * pagination.pageSize : 0) + idx + 1}
                    </td>
                  )}
                  {visibleColumns.includes('date') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1'} font-mono text-slate-500 border-r border-slate-100`}>{formatCompanyDate(entry.date, settings)}</td>}
                  {visibleColumns.includes('voucherNo') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1'} font-bold tabular-nums border-r border-slate-100 truncate`}><button className="hover:text-blue-700 outline-none">{entry.voucherNo}</button></td>}
                  {visibleColumns.includes('description') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1'} text-slate-500 truncate border-r border-slate-100`} title={entry.description}>{entry.description || '--'}</td>}
                  {visibleColumns.includes('costCenter') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1'} text-slate-600 font-mono text-[10px] truncate border-r border-slate-100`} title={entry.costCenterName || ''}>{entry.costCenterCode ? `${entry.costCenterCode} - ${entry.costCenterName || ''}` : ''}</td>}
                  {visibleColumns.includes('debit') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1'} text-right font-mono font-bold border-r border-slate-100`}>{entry.debit > 0 ? entry.debit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</td>}
                  {visibleColumns.includes('credit') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1'} text-right font-mono font-bold text-rose-700 border-r border-slate-100`}>{entry.credit > 0 ? entry.credit.toLocaleString(undefined, { minimumFractionDigits: 2 }) : ''}</td>}
                  {visibleColumns.includes('balance') && <td className={`px-3 ${isCompact ? 'py-0.5' : 'py-1'} text-right font-mono font-black text-slate-900 bg-slate-100/20`}>{(entry.runningBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* FOOTER: Static Summary */}
      <div className="shrink-0 bg-white border-t border-slate-300 shadow-[0_-1px_3px_rgba(0,0,0,0.05)] grid grid-cols-2 md:grid-cols-6 items-center z-10">
         <div className="md:col-span-3 p-4 flex items-center gap-3">
            <div className="w-1.5 h-1.5 bg-slate-200 rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Analysis Segment Summary</span>
         </div>
         <div className="p-4 border-l border-slate-100 text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Total Period Dr.</span>
            <span className="font-mono text-sm font-black text-slate-900 tabular-nums">{summary.debit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
         </div>
         <div className="p-4 border-l border-slate-100 text-right">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block leading-none mb-1">Total Period Cr.</span>
            <span className="font-mono text-sm font-black text-slate-900 tabular-nums">{summary.credit.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
         </div>
         <div className="p-4 border-l border-slate-300 bg-slate-50 text-right shadow-inner">
            <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block leading-none mb-1">Final Analysis Result</span>
            <span className="font-mono text-base font-black text-slate-900 tabular-nums">{summary.closing.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
         </div>
      </div>
    </div>
  );
};

export default function LedgerReportPage() {
  return (
    <ReportContainer<LedgerParams>
      title="General Ledger"
      subtitle=""
      initiator={LedgerInitiator}
      ReportContent={LedgerReportContent}
      config={{ 
        paginated: true, 
        defaultPageSize: 100,
        availableColumns: ALL_COLUMNS
      }}
    />
  );
}
