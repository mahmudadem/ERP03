import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, Search, Filter, RotateCcw } from 'lucide-react';
import { PRStatus, PurchaseReturnDTO, ReturnContext, purchasesApi } from '../../../api/purchasesApi';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';
import { formatMoney } from '../../../utils/formatMoney';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';

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
      return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
    case 'POSTED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/35 dark:text-emerald-300 dark:ring-emerald-500/20';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-950/35 dark:text-rose-300 dark:ring-rose-500/20';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
  }
};

const PurchaseReturnsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['purchases', 'common']);
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
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('returnsList.errors.loadFailed', 'Failed to load purchase returns.'));
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
      { key: 'returnNumber', label: t('returnsList.columns.returnNumber', 'Return #'), width: '150px', priority: 1, sortable: true, accessor: 'returnNumber', align: 'center', render: (value) => <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{value}</span> },
      { key: 'vendorName', label: t('returnsList.columns.vendorName', 'Vendor'), width: '220px', priority: 1, sortable: true, accessor: 'vendorName', align: 'center', render: (value) => <span className="font-medium text-slate-900 dark:text-slate-100">{value}</span> },
      { key: 'returnDate', label: t('returnsList.columns.returnDate', 'Return Date'), width: '150px', priority: 1, sortable: true, accessor: 'returnDate', align: 'center' },
      { key: 'returnContext', label: t('returnsList.columns.context', 'Context'), width: '150px', priority: 1, sortable: true, accessor: 'returnContext', align: 'center', render: (value) => <span className="whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 ring-1 ring-blue-100">{value}</span> },
      { key: 'grandTotalDoc', label: t('returnsList.columns.grandTotal', 'Grand Total'), width: '140px', priority: 1, sortable: true, accessor: 'grandTotalDoc', align: 'right', render: (value, row) => <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatMoney(value, row.currency)}</span> },
      {
        key: 'status',
        label: t('returnsList.columns.status', 'Status'),
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
      { key: 'open', label: t('returnsList.actions.open', 'Open'), icon: Eye, onClick: (row) => navigate(`/purchases/returns/${row.id}`), primary: false },
    ],
    [navigate],
  );

  const handleApply = () => {
    setSearchFilter(localSearch);
    setPage(1);
  };

  const handleClear = () => {
    setLocalSearch('');
    setSearchFilter('');
    setStatusFilter('ALL');
    setContextFilter('ALL');
    setPage(1);
  };

  const hasActiveFilters = statusFilter !== 'ALL' || contextFilter !== 'ALL' || !!searchFilter;

  return (
    <OperationalListLayout<PurchaseReturnDTO>
      title={t('returnsList.title', 'Purchase Returns')}
      subtitle=""
      compactHeader
      newButtonLabel={t('returnsList.newReturn', 'New Return')}
      onNewClick={() => navigate('/purchases/returns/new')}
      onRefresh={load}
      loading={loading}
      error={error}
      filters={
        <div className="flex flex-row items-center gap-2.5 w-full overflow-x-auto whitespace-nowrap pb-1.5 lg:pb-0 scrollbar-thin">
          {/* SEARCH */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              placeholder={t("auto.PurchaseReturnsListPage.returnVendorStatus", "Return #, vendor, status...")}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* STATUS */}
          <div className="w-32 flex-shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as PRStatus | 'ALL');
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.value === 'ALL' ? t('returnsList.filters.statusPlaceholder', 'Status') : t(`returnsList.status.${status.value}`, status.label)}
                </option>
              ))}
            </select>
          </div>

          {/* CONTEXT */}
          <div className="w-40 flex-shrink-0">
            <select
              value={contextFilter}
              onChange={(e) => {
                setContextFilter(e.target.value as ReturnContext | 'ALL');
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              {CONTEXT_OPTIONS.map((context) => (
                <option key={context.value} value={context.value}>
                  {context.value === 'ALL' ? t('returnsList.filters.contextPlaceholder', 'Context') : t(`returnsList.context.${context.value}`, context.label)}
                </option>
              ))}
            </select>
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-all hover:shadow-md hover:shadow-primary-600/10 active:scale-[0.98] duration-200"
            >
              <Filter size={16} />
              <span>{t("auto.PurchaseReturnsListPage.apply", "Apply")}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-[0.98] duration-200"
              title={t("auto.PurchaseReturnsListPage.clear", "Clear")}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      }
      hasActiveFilters={hasActiveFilters}
      onClearFilters={handleClear}
      statusFilterConfig={{
        options: STATUS_OPTIONS.map((option) => ({
          value: option.value,
          label: option.value === 'ALL' ? t('returnsList.status.ALL', option.label) : t(`returnsList.status.${option.value}`, option.label),
          color: option.color,
        })),
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
      emptyMessage={t('returnsList.emptyMessage', 'No purchase returns found.')}
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
