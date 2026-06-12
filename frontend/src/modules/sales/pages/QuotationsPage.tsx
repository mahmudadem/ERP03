import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Search, Filter, RotateCcw } from 'lucide-react';
import { clsx } from 'clsx';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';
import { QuoteDTO, QuoteStatus, salesOperationalApi } from '../../../api/salesOperationalApi';
import { formatMoney } from '../../../utils/formatMoney';

const ALL_STATUSES: QuoteStatus[] = ['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'];

const STATUS_OPTIONS: Array<{ label: string; value: QuoteStatus | 'ALL'; color: string }> = [
  { label: 'All', value: 'ALL', color: 'bg-slate-400' },
  { label: 'Draft', value: 'DRAFT', color: 'bg-slate-500' },
  { label: 'Sent', value: 'SENT', color: 'bg-blue-500' },
  { label: 'Accepted', value: 'ACCEPTED', color: 'bg-emerald-500' },
  { label: 'Rejected', value: 'REJECTED', color: 'bg-rose-500' },
  { label: 'Expired', value: 'EXPIRED', color: 'bg-amber-500' },
  { label: 'Converted', value: 'CONVERTED', color: 'bg-violet-500' },
];

const statusChipClasses = (status: QuoteStatus): string => {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
    case 'SENT':
      return 'bg-blue-50 text-blue-700 ring-blue-600/10 dark:bg-blue-950/35 dark:text-blue-300 dark:ring-blue-500/20';
    case 'ACCEPTED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/35 dark:text-emerald-300 dark:ring-emerald-500/20';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-950/35 dark:text-rose-300 dark:ring-rose-500/20';
    case 'EXPIRED':
      return 'bg-amber-50 text-amber-800 ring-amber-600/10 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-500/20';
    case 'CONVERTED':
      return 'bg-violet-50 text-violet-700 ring-violet-600/10 dark:bg-violet-950/35 dark:text-violet-300 dark:ring-violet-500/20';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
  }
};

const formatDate = (dateStr?: string): string => dateStr ? dateStr.slice(0, 10) : '-';

const QuotationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'ALL'>('ALL');
  const [customerFilter, setCustomerFilter] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [quotes, setQuotes] = useState<QuoteDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await salesOperationalApi.listQuotes({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        customerId: customerFilter || undefined,
        limit: 500,
      });
      setQuotes(Array.isArray(result) ? result : []);
    } catch (err: any) {
      console.error('Failed to load quotations', err);
      setError(err?.response?.data?.error?.message || err?.response?.data?.message || err?.message || t('sales.quotesList.loadError'));
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, customerFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredQuotes = useMemo(() => {
    const term = searchFilter.trim().toLowerCase();
    if (!term) return quotes;
    return quotes.filter((quote) =>
      [quote.quoteNumber, quote.customerName, quote.customerId, quote.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [quotes, searchFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: quotes.length };
    ALL_STATUSES.forEach((status) => {
      counts[status] = quotes.filter((quote) => quote.status === status).length;
    });
    return counts;
  }, [quotes]);

  const pagedQuotes = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredQuotes.slice(start, start + pageSize);
  }, [filteredQuotes, page, pageSize]);

  const columns = useMemo<ColumnDefinition<QuoteDTO>[]>(
    () => [
      {
        key: 'quoteNumber',
        label: t('sales.quotesList.quoteNumber'),
        width: '150px',
        priority: 1,
        sortable: true,
        accessor: 'quoteNumber',
        align: 'center',
        render: (value, row) => (
          <div className="flex items-center justify-center gap-2">
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{value}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">v{row.version}</span>
          </div>
        ),
      },
      { key: 'customerName', label: t('sales.quotesList.customer'), width: '220px', priority: 1, sortable: true, accessor: 'customerName', align: 'center', render: (value) => <span className="font-medium text-slate-900 dark:text-slate-100">{value}</span> },
      { key: 'quoteDate', label: t('sales.quotesList.quoteDate'), width: '130px', priority: 1, sortable: true, accessor: 'quoteDate', align: 'center', render: (value) => formatDate(value) },
      { key: 'validUntil', label: t('sales.quotesList.validUntil'), width: '130px', priority: 2, sortable: true, accessor: 'validUntil', align: 'center', render: (value) => formatDate(value) },
      { key: 'grandTotalDoc', label: t('sales.quotesList.grandTotal'), width: '140px', priority: 1, sortable: true, accessor: 'grandTotalDoc', align: 'right', render: (value, row) => <span className="font-mono font-bold text-slate-900 dark:text-slate-100">{formatMoney(value, row.currency)}</span> },
      {
        key: 'status',
        label: t('sales.quotesList.status'),
        width: '130px',
        priority: 1,
        sortable: true,
        accessor: 'status',
        align: 'center',
        render: (value) => (
          <span className={clsx('whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset', statusChipClasses(value))}>
            {String(t(`sales.quotesList.statuses.${value}`, value))}
          </span>
        ),
      },
    ],
    [t],
  );

  const rowActions = useMemo<RowAction<QuoteDTO>[]>(
    () => [
      { key: 'open', label: t('actions.open', 'Open'), icon: Eye, onClick: (row) => navigate(`/sales/quotes/${row.id}`), primary: false },
    ],
    [navigate, t],
  );

  const handleApply = () => {
    setSearchFilter(localSearch);
    setPage(1);
  };

  const handleClear = () => {
    setLocalSearch('');
    setSearchFilter('');
    setStatusFilter('ALL');
    setCustomerFilter('');
    setPage(1);
  };

  const hasActiveFilters = statusFilter !== 'ALL' || !!customerFilter || !!searchFilter;

  return (
    <OperationalListLayout<QuoteDTO>
      title={t('sales.quotesList.title')}
      subtitle=""
      compactHeader
      newButtonLabel={t('sales.quotesList.newQuote')}
      onNewClick={() => navigate('/sales/quotes/new')}
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
              placeholder="Quote #, customer, status..."
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* CUSTOMER */}
          <div className="w-52 flex-shrink-0">
            <PartySelector
              role="CUSTOMER"
              value={customerFilter}
              onChange={(party) => {
                setCustomerFilter(party?.id ?? '');
                setPage(1);
              }}
              placeholder={t('sales.quotesList.allCustomers')}
            />
          </div>

          {/* STATUS */}
          <div className="w-32 flex-shrink-0">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as QuoteStatus | 'ALL');
                setPage(1);
              }}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              <option value="ALL">{t('sales.quotesList.allStatuses')}</option>
              {ALL_STATUSES.map((status) => (
                <option key={status} value={status}>{t(`sales.quotesList.statuses.${status}`)}</option>
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
              <span>{t('actions.apply', 'Apply')}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-[0.98] duration-200"
              title={t('actions.clear', 'Clear')}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      }
      hasActiveFilters={hasActiveFilters}
      onClearFilters={handleClear}
      statusFilterConfig={{
        options: STATUS_OPTIONS.map((option) => ({ value: option.value, label: option.label, color: option.color })),
        activeValue: statusFilter,
        onChange: (value) => {
          setStatusFilter(value as QuoteStatus | 'ALL');
          setPage(1);
        },
        counts: statusCounts,
      }}
      columns={columns}
      data={pagedQuotes}
      rowActions={rowActions}
      onRowClick={(row) => navigate(`/sales/quotes/${row.id}`)}
      emptyMessage={t('sales.quotesList.emptyTitle')}
      pagination={{
        page,
        pageSize,
        totalItems: filteredQuotes.length,
        totalPages: Math.max(1, Math.ceil(filteredQuotes.length / pageSize)),
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

export default QuotationsPage;
