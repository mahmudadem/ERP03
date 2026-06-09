import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Search } from 'lucide-react';
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
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    case 'SENT':
      return 'bg-blue-100 text-blue-700 ring-blue-200';
    case 'ACCEPTED':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    case 'REJECTED':
      return 'bg-rose-100 text-rose-700 ring-rose-200';
    case 'EXPIRED':
      return 'bg-amber-100 text-amber-700 ring-amber-200';
    case 'CONVERTED':
      return 'bg-violet-100 text-violet-700 ring-violet-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
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

  const hasActiveFilters = statusFilter !== 'ALL' || !!customerFilter || !!searchFilter;

  return (
    <OperationalListLayout<QuoteDTO>
      title={t('sales.quotesList.title')}
      subtitle={t('sales.quotesList.subtitle')}
      newButtonLabel={t('sales.quotesList.newQuote')}
      onNewClick={() => navigate('/sales/quotes/new')}
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
              placeholder="Quote #, customer, status..."
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="w-full lg:w-64">
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
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as QuoteStatus | 'ALL');
              setPage(1);
            }}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 lg:w-40"
          >
            <option value="ALL">{t('sales.quotesList.allStatuses')}</option>
            {ALL_STATUSES.map((status) => (
              <option key={status} value={status}>{t(`sales.quotesList.statuses.${status}`)}</option>
            ))}
          </select>
          <button type="button" className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white" onClick={() => { setSearchFilter(localSearch); setPage(1); }}>
            {t('actions.apply', 'Apply')}
          </button>
        </div>
      }
      hasActiveFilters={hasActiveFilters}
      onClearFilters={() => {
        setStatusFilter('ALL');
        setCustomerFilter('');
        setLocalSearch('');
        setSearchFilter('');
        setPage(1);
      }}
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
