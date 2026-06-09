import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Search } from 'lucide-react';
import { PRStatus, PurchaseReturnDTO, ReturnContext, purchasesApi } from '../../../api/purchasesApi';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';
import { formatMoney } from '../../../utils/formatMoney';
import { clsx } from 'clsx';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const STATUS_OPTIONS: Array<{ label: string; value: PRStatus | 'ALL'; color: string }> = [
  { label: 'All', value: 'ALL', color: 'bg-slate-400' },
  { label: 'Draft', value: 'DRAFT', color: 'bg-slate-500' },
  { label: 'Posted', value: 'POSTED', color: 'bg-emerald-500' },
  { label: 'Cancelled', value: 'CANCELLED', color: 'bg-rose-500' },
];

const CONTEXT_OPTIONS: Array<{ label: string; value: ReturnContext | 'ALL' }> = [
  { label: 'All Contexts', value: 'ALL' },
  { label: 'After Invoice', value: 'AFTER_INVOICE' },
  { label: 'Before Invoice', value: 'BEFORE_INVOICE' },
];

const statusChipClasses = (status: PRStatus): string => {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    case 'POSTED':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
};

const PurchaseReturnsListPage: React.FC = () => {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<PRStatus | 'ALL'>('ALL');
  const [contextFilter, setContextFilter] = useState<ReturnContext | 'ALL'>('ALL');
  const [localSearch, setLocalSearch] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [returns, setReturns] = useState<PurchaseReturnDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await purchasesApi.listReturns({});
      setReturns(unwrap<PurchaseReturnDTO[]>(result) || []);
    } catch (err: any) {
      console.error('Failed to load purchase returns', err);
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || 'Failed to load purchase returns.');
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredReturns = useMemo(() => {
    const term = searchFilter.trim().toLowerCase();
    return returns.filter((entry) => {
      if (statusFilter !== 'ALL' && entry.status !== statusFilter) return false;
      if (contextFilter !== 'ALL' && entry.returnContext !== contextFilter) return false;
      if (!term) return true;
      return [entry.returnNumber, entry.vendorName, entry.vendorId, entry.returnContext, entry.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [contextFilter, returns, searchFilter, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: returns.length };
    STATUS_OPTIONS.forEach((option) => {
      if (option.value !== 'ALL') counts[option.value] = returns.filter((entry) => entry.status === option.value).length;
    });
    return counts;
  }, [returns]);

  const pagedReturns = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredReturns.slice(start, start + pageSize);
  }, [filteredReturns, page, pageSize]);

  const columns = useMemo<ColumnDefinition<PurchaseReturnDTO>[]>(
    () => [
      { key: 'returnNumber', label: 'Return #', width: '150px', priority: 1, sortable: true, accessor: 'returnNumber', align: 'center', render: (value) => <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{value}</span> },
      { key: 'vendorName', label: 'Vendor', width: '220px', priority: 1, sortable: true, accessor: 'vendorName', align: 'center', render: (value) => <span className="font-medium text-slate-900 dark:text-slate-100">{value}</span> },
      { key: 'returnDate', label: 'Return Date', width: '150px', priority: 1, sortable: true, accessor: 'returnDate', align: 'center' },
      { key: 'returnContext', label: 'Context', width: '150px', priority: 1, sortable: true, accessor: 'returnContext', align: 'center', render: (value) => <span className="whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 ring-1 ring-blue-100">{value}</span> },
      { key: 'grandTotalDoc', label: 'Grand Total', width: '140px', priority: 1, sortable: true, accessor: 'grandTotalDoc', align: 'right', render: (value, row) => <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatMoney(value, row.currency)}</span> },
      {
        key: 'status',
        label: 'Status',
        width: '130px',
        priority: 1,
        sortable: true,
        accessor: 'status',
        align: 'center',
        render: (value) => (
          <span className={clsx('whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset', statusChipClasses(value))}>
            {value}
          </span>
        ),
      },
    ],
    [],
  );

  const rowActions = useMemo<RowAction<PurchaseReturnDTO>[]>(
    () => [
      { key: 'open', label: 'Open', icon: Eye, onClick: (row) => navigate(`/purchases/returns/${row.id}`), primary: false },
    ],
    [navigate],
  );

  const hasActiveFilters = statusFilter !== 'ALL' || contextFilter !== 'ALL' || !!searchFilter;

  return (
    <OperationalListLayout<PurchaseReturnDTO>
      title="Purchase Returns"
      subtitle="Track supplier return documents before or after purchase invoicing."
      newButtonLabel="New Return"
      onNewClick={() => navigate('/purchases/returns/new')}
      onRefresh={load}
      loading={loading}
      error={error}
      filters={
        <div className="flex w-full flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setSearchFilter(localSearch);
                  setPage(1);
                }
              }}
              placeholder="Return #, vendor, status..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as PRStatus | 'ALL');
              setPage(1);
            }}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:w-40"
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status.value} value={status.value}>{status.label}</option>
            ))}
          </select>
          <select
            value={contextFilter}
            onChange={(event) => {
              setContextFilter(event.target.value as ReturnContext | 'ALL');
              setPage(1);
            }}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:w-44"
          >
            {CONTEXT_OPTIONS.map((context) => (
              <option key={context.value} value={context.value}>{context.label}</option>
            ))}
          </select>
          <button type="button" className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white" onClick={() => { setSearchFilter(localSearch); setPage(1); }}>
            Apply
          </button>
        </div>
      }
      hasActiveFilters={hasActiveFilters}
      onClearFilters={() => {
        setStatusFilter('ALL');
        setContextFilter('ALL');
        setLocalSearch('');
        setSearchFilter('');
        setPage(1);
      }}
      statusFilterConfig={{
        options: STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label, color: option.color })),
        activeValue: statusFilter,
        onChange: (value) => {
          setStatusFilter(value as PRStatus | 'ALL');
          setPage(1);
        },
        counts: statusCounts,
      }}
      columns={columns}
      data={pagedReturns}
      rowActions={rowActions}
      onRowClick={(row) => navigate(`/purchases/returns/${row.id}`)}
      emptyMessage="No purchase returns found."
      pagination={{
        page,
        pageSize,
        totalItems: filteredReturns.length,
        totalPages: Math.max(1, Math.ceil(filteredReturns.length / pageSize)),
        onPageChange: setPage,
        onPageSizeChange: (nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        },
        pageSizeOptions: [10, 25, 50, 100],
      }}
    />
  );
};

export default PurchaseReturnsListPage;
