import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Filter, Printer, RotateCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';
import { ReturnContext, SalesReturnDTO, salesApi, SRStatus } from '../../../api/salesApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { DatePicker } from '../../../components/shared/selectors/DatePicker';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatMoney } from '../../../utils/formatMoney';
import { formatCompanyDate, formatCompanyTime, getCompanyToday } from '../../../utils/dateUtils';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type SRStatusFilter = SRStatus | 'ALL';
type ContextFilter = ReturnContext | 'ALL';

const STATUS_VALUES: SRStatusFilter[] = ['ALL', 'DRAFT', 'POSTED', 'CANCELLED'];
const CONTEXT_VALUES: ContextFilter[] = ['ALL', 'AFTER_INVOICE', 'BEFORE_INVOICE', 'DIRECT'];

const statusChipClasses = (status: SRStatus): string => {
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

const SalesReturnsListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('common');
  const { settings: companySettings } = useCompanySettings();
  const defaultDateTo = useMemo(() => getCompanyToday(companySettings), [companySettings]);

  const stateStatus = (location.state as any)?.statusFilter;
  const initialStatus = stateStatus && STATUS_VALUES.includes(stateStatus) ? stateStatus : 'ALL';

  const [statusFilter, setStatusFilter] = useState<SRStatusFilter>(initialStatus);
  const [contextFilter, setContextFilter] = useState<ContextFilter>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>(defaultDateTo);

  const [localStatus, setLocalStatus] = useState<SRStatusFilter>(initialStatus);
  const [localContext, setLocalContext] = useState<ContextFilter>('ALL');
  const [localCustomer, setLocalCustomer] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [localDateFrom, setLocalDateFrom] = useState<string>('');
  const [localDateTo, setLocalDateTo] = useState<string>(defaultDateTo);

  useEffect(() => {
    const sStatus = (location.state as any)?.statusFilter;
    if (sStatus && STATUS_VALUES.includes(sStatus)) {
      setStatusFilter(sStatus);
      setLocalStatus(sStatus);
      try {
        window.history.replaceState({ ...location.state, statusFilter: undefined }, '');
      } catch (e) {}
    }
  }, [location.state]);

  const [returns, setReturns] = useState<SalesReturnDTO[]>([]);
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const customerById = useMemo(
    () =>
      customers.reduce<Record<string, string>>((acc, customer) => {
        acc[customer.id] = customer.displayName;
        return acc;
      }, {}),
    [customers]
  );

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    contextFilter !== 'ALL' ||
    customerFilter !== 'ALL' ||
    searchFilter !== '' ||
    dateFrom !== '' ||
    dateTo !== defaultDateTo;

  const handleApply = () => {
    setStatusFilter(localStatus);
    setContextFilter(localContext);
    setCustomerFilter(localCustomer);
    setSearchFilter(localSearch);
    setDateFrom(localDateFrom);
    setDateTo(localDateTo);
    setPage(1);
  };

  const handleClear = () => {
    setLocalStatus('ALL');
    setLocalContext('ALL');
    setLocalCustomer('ALL');
    setLocalSearch('');
    setLocalDateFrom('');
    setLocalDateTo(defaultDateTo);

    setStatusFilter('ALL');
    setContextFilter('ALL');
    setCustomerFilter('ALL');
    setSearchFilter('');
    setDateFrom('');
    setDateTo(defaultDateTo);
    setPage(1);
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [returnResult, customerResult] = await Promise.all([
        salesApi.listReturns({}),
        sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      ]);
      const list = unwrap<SalesReturnDTO[]>(returnResult);
      const customerList = unwrap<PartyDTO[]>(customerResult);
      setReturns(Array.isArray(list) ? list : []);
      setCustomers(Array.isArray(customerList) ? customerList : []);
    } catch (err: any) {
      console.error('Failed to load sales returns', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('sales.returnsList.loadError')
      );
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDateTo((current) => current || defaultDateTo);
    setLocalDateTo((current) => current || defaultDateTo);
  }, [defaultDateTo]);

  const matchesNonStatusFilters = (entry: SalesReturnDTO): boolean => {
    if (contextFilter !== 'ALL' && entry.returnContext !== contextFilter) {
      return false;
    }
    if (customerFilter !== 'ALL' && entry.customerId !== customerFilter) {
      return false;
    }
    if (dateFrom && entry.returnDate < dateFrom) {
      return false;
    }
    if (dateTo && entry.returnDate > dateTo) {
      return false;
    }
    if (searchFilter) {
      const query = searchFilter.toLowerCase().trim();
      const customerName = customerById[entry.customerId] || entry.customerName || '';
      const haystack = [
        entry.returnNumber,
        customerName,
        entry.reason,
        entry.notes,
        entry.createdBy,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  };

  const statusCounts = useMemo(() => {
    const counts = { DRAFT: 0, POSTED: 0, CANCELLED: 0 };
    returns.forEach((entry) => {
      if (!matchesNonStatusFilters(entry)) {
        return;
      }
      if (entry.status in counts) {
        counts[entry.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [returns, contextFilter, customerFilter, dateFrom, dateTo, searchFilter, customerById]);

  const statusFilterConfig = useMemo(
    () => ({
      options: [
        { value: 'DRAFT', label: t('sales.returnsList.status.DRAFT', 'Draft'), color: 'slate' },
        { value: 'POSTED', label: t('sales.returnsList.status.POSTED', 'Posted'), color: 'emerald' },
        { value: 'CANCELLED', label: t('sales.returnsList.status.CANCELLED', 'Cancelled'), color: 'rose' },
      ],
      activeValue: statusFilter,
      onChange: (value: string) => {
        const nextStatus = value as SRStatusFilter;
        setStatusFilter(nextStatus);
        setLocalStatus(nextStatus);
        setPage(1);
      },
      counts: statusCounts,
    }),
    [statusFilter, statusCounts, t]
  );

  const filteredReturns = useMemo(
    () =>
      returns.filter((entry) => {
        if (statusFilter !== 'ALL' && entry.status !== statusFilter) {
          return false;
        }
        return matchesNonStatusFilters(entry);
      }),
    [returns, statusFilter, contextFilter, customerFilter, dateFrom, dateTo, searchFilter, customerById]
  );

  const sortedData = useMemo(() => {
    const sorted = [...filteredReturns];
    if (sortField && sortDirection) {
      sorted.sort((a, b) => {
        let aVal = (a as any)[sortField];
        let bVal = (b as any)[sortField];
        if (sortField === 'customerName') {
          aVal = customerById[a.customerId] || a.customerName || '';
          bVal = customerById[b.customerId] || b.customerName || '';
        }
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      sorted.sort((a, b) => {
        const dateA = a.createdAt || a.returnDate || '';
        const dateB = b.createdAt || b.returnDate || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        return b.returnNumber.localeCompare(a.returnNumber);
      });
    }
    return sorted;
  }, [filteredReturns, sortField, sortDirection, customerById]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(
    () => sortedData.slice((page - 1) * pageSize, page * pageSize),
    [sortedData, page, pageSize]
  );

  const handleSort = (field: string) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') setSortDirection(null);
      else setSortDirection('asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setPage(1);
  };

  const columns = useMemo<ColumnDefinition<SalesReturnDTO>[]>(
    () => [
      {
        key: 'returnNumber',
        label: t('sales.returnsList.headers.returnNumber', 'Return #'),
        width: '130px',
        priority: 1,
        sortable: true,
        accessor: 'returnNumber',
        align: 'center',
        render: (value: string) => (
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{value}</span>
        ),
      },
      {
        key: 'customerName',
        label: t('sales.returnsList.headers.customer', 'Customer'),
        width: '210px',
        priority: 1,
        sortable: true,
        accessor: 'customerName',
        align: 'center',
        render: (_value: string, row) => (
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {customerById[row.customerId] || row.customerName}
          </span>
        ),
      },
      {
        key: 'returnDate',
        label: t('sales.returnsList.headers.returnDate', 'Return Date'),
        width: '170px',
        priority: 1,
        sortable: true,
        accessor: 'returnDate',
        align: 'center',
        render: (_value: string, row) => (
          <div className="flex flex-col items-center text-center">
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formatCompanyDate(row.returnDate, companySettings)}
            </span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {row.createdAt ? formatCompanyTime(row.createdAt, companySettings) : ''}
            </span>
          </div>
        ),
      },
      {
        key: 'returnContext',
        label: t('sales.returnsList.headers.context', 'Context'),
        width: '150px',
        priority: 1,
        sortable: true,
        accessor: 'returnContext',
        align: 'center',
        render: (value: string) => (
          <span className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700 ring-1 ring-inset ring-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:ring-blue-800">
            {t(`sales.returnsList.context.${value}`, value)}
          </span>
        ),
      },
      {
        key: 'grandTotalDoc',
        label: t('sales.returnsList.headers.grandTotal', 'Grand Total'),
        width: '140px',
        priority: 1,
        sortable: true,
        accessor: 'grandTotalDoc',
        align: 'center',
        render: (value: number, row) => (
          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
            {formatMoney(value, row.currency)}
          </span>
        ),
      },
      {
        key: 'currency',
        label: t('sales.invoicesList.columns.currency', 'Currency'),
        width: '90px',
        priority: 2,
        sortable: true,
        accessor: 'currency',
        align: 'center',
        render: (value: string) => (
          <span className="font-mono text-slate-600 dark:text-slate-400">{value}</span>
        ),
      },
      {
        key: 'reasonCode',
        label: t('sales.returnsList.headers.reason', 'Reason'),
        width: '150px',
        priority: 2,
        sortable: true,
        accessor: 'reasonCode',
        align: 'center',
        render: (value: string) => (
          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{value || '-'}</span>
        ),
      },
      {
        key: 'status',
        label: t('sales.returnsList.headers.status', 'Status'),
        width: '130px',
        priority: 1,
        sortable: true,
        accessor: 'status',
        align: 'center',
        render: (value: string) => (
          <span
            className={clsx(
              'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
              statusChipClasses(value as SRStatus)
            )}
          >
            {t(`sales.returnsList.status.${value}`, value)}
          </span>
        ),
      },
      {
        key: 'postedAt',
        label: t('sales.returnsList.headers.postedAt', 'Posted At'),
        width: '160px',
        priority: 3,
        sortable: true,
        accessor: 'postedAt',
        align: 'center',
        render: (value: string) => {
          if (!value) return '-';
          return (
            <div className="flex flex-col items-center text-center">
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {formatCompanyDate(value, companySettings)}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {formatCompanyTime(value, companySettings)}
              </span>
            </div>
          );
        },
      },
    ],
    [companySettings, customerById, t]
  );

  const rowActions = useMemo<RowAction<SalesReturnDTO>[]>(
    () => [
      {
        key: 'view',
        label: t('sales.returnsList.open', 'Open'),
        icon: Eye,
        onClick: (row) => navigate(`/sales/returns/${row.id}`),
      },
      {
        key: 'print',
        label: t('actions.print', 'Print'),
        icon: Printer,
        onClick: (row) => {
          toast.success(t('sales.returnsList.printQueued', 'Printing sales return {{number}}...', { number: row.returnNumber }));
          window.print();
        },
      },
    ],
    [navigate, t]
  );

  return (
    <OperationalListLayout<SalesReturnDTO>
      title={t('sales.returnsList.title')}
      subtitle=""
      compactHeader
      statusFilterConfig={statusFilterConfig}
      newButtonLabel={t('sales.returnsList.newButton')}
      onNewClick={() => navigate('/sales/returns/new')}
      onRefresh={load}
      loading={loading}
      error={error}
      hasActiveFilters={hasActiveFilters}
      onClearFilters={handleClear}
      filters={
        <div className="flex w-full flex-row items-center gap-2.5 overflow-x-auto whitespace-nowrap pb-1.5 scrollbar-thin lg:pb-0">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={t('sales.returnsList.filters.searchPlaceholder', 'Return #, customer, reason...')}
              value={localSearch}
              onChange={(event) => setLocalSearch(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && handleApply()}
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="w-52 flex-shrink-0">
            <PartySelector
              role="CUSTOMER"
              value={localCustomer === 'ALL' ? '' : localCustomer}
              onChange={(party) => setLocalCustomer(party ? party.id : 'ALL')}
              placeholder={t('sales.returnsList.filters.allCustomers', 'All Customers')}
            />
          </div>

          <div className="w-40 flex-shrink-0">
            <select
              value={localContext}
              onChange={(event) => setLocalContext(event.target.value as ContextFilter)}
              className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {CONTEXT_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value === 'ALL'
                    ? t('sales.returnsList.filters.contextPlaceholder', 'Context')
                    : t(`sales.returnsList.context.${value}`, value)}
                </option>
              ))}
            </select>
          </div>

          <div className="w-32 flex-shrink-0">
            <select
              value={localStatus}
              onChange={(event) => setLocalStatus(event.target.value as SRStatusFilter)}
              className="w-full cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            >
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value === 'ALL'
                    ? t('sales.returnsList.filters.statusPlaceholder', 'Status')
                    : t(`sales.returnsList.status.${value}`, value)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <DatePicker
              className="w-32"
              value={localDateFrom}
              onChange={setLocalDateFrom}
              placeholder={t('sales.returnsList.filters.dateFrom', 'Date From')}
            />
            <span className="font-medium text-slate-400">-</span>
            <DatePicker
              className="w-32"
              value={localDateTo}
              onChange={setLocalDateTo}
              placeholder={t('sales.returnsList.filters.dateTo', 'Date To')}
            />
          </div>

          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-primary-700 hover:shadow-md hover:shadow-primary-600/10 active:scale-[0.98]"
            >
              <Filter size={16} />
              <span>{t('sales.invoicesList.filters.apply', 'Apply')}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              title={t('sales.returnsList.clearFilters', 'Clear filters')}
              className="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition-all duration-200 hover:bg-slate-50 hover:text-rose-600 active:scale-[0.98] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-rose-400"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      }
      columns={columns}
      data={paginatedData}
      emptyMessage={t('sales.returnsList.empty.title')}
      onRowClick={(row) => navigate(`/sales/returns/${row.id}`)}
      sorting={{
        field: sortField,
        direction: sortDirection,
        onSort: handleSort,
      }}
      pagination={{
        page,
        pageSize,
        totalItems: sortedData.length,
        totalPages,
        onPageChange: setPage,
        onPageSizeChange: (size) => {
          setPageSize(size);
          setPage(1);
        },
        pageSizeOptions: [10, 25, 50, 100],
      }}
      rowActions={rowActions}
      idKey="id"
    />
  );
};

export default SalesReturnsListPage;
