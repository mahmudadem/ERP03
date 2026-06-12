import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X, Eye, Printer, Filter, RotateCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { SOStatus, SalesOrderDTO, salesApi } from '../../../api/salesApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { DatePicker } from '../../../components/shared/selectors/DatePicker';
import { formatMoney } from '../../../utils/formatMoney';
import { listUsers, CompanyUser } from '../../../api/companyAdmin';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';
import { clsx } from 'clsx';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type SOStatusFilter = SOStatus | 'ALL';

const STATUS_VALUES: SOStatusFilter[] = [
  'ALL',
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_DELIVERED',
  'FULLY_DELIVERED',
  'CLOSED',
  'CANCELLED',
];

const SUMMARY_STATUSES: SOStatus[] = [
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_DELIVERED',
  'FULLY_DELIVERED',
  'CLOSED',
  'CANCELLED',
];

const statusChipClasses = (status: SOStatus): string => {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    case 'CONFIRMED':
      return 'bg-indigo-100 text-indigo-700 ring-indigo-200';
    case 'PARTIALLY_DELIVERED':
      return 'bg-amber-100 text-amber-700 ring-amber-200';
    case 'FULLY_DELIVERED':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    case 'CLOSED':
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
};

const SalesOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('common');
  const [orders, setOrders] = useState<SalesOrderDTO[]>([]);
  const [customers, setCustomers] = useState<PartyDTO[]>([]);

  const stateStatus = (location.state as any)?.statusFilter;
  const initialStatus = stateStatus && STATUS_VALUES.includes(stateStatus) ? stateStatus : 'ALL';

  const [statusFilter, setStatusFilter] = useState<SOStatusFilter>(initialStatus);
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Local state buffers for filters
  const [localStatus, setLocalStatus] = useState<SOStatusFilter>(initialStatus);
  const [localCustomer, setLocalCustomer] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [localDateFrom, setLocalDateFrom] = useState<string>('');
  const [localDateTo, setLocalDateTo] = useState<string>('');

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

  const [users, setUsers] = useState<CompanyUser[]>([]);
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

  const userById = useMemo(
    () =>
      users.reduce<Record<string, { name: string; email: string }>>((acc, u) => {
        acc[u.userId] = {
          name: `${u.firstName} ${u.lastName}`.trim() || u.email,
          email: u.email,
        };
        return acc;
      }, {}),
    [users]
  );

  const hasActiveFilters =
    statusFilter !== 'ALL' ||
    customerFilter !== 'ALL' ||
    searchFilter !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  const handleApply = () => {
    setStatusFilter(localStatus);
    setCustomerFilter(localCustomer);
    setSearchFilter(localSearch);
    setDateFrom(localDateFrom);
    setDateTo(localDateTo);
    setPage(1);
  };

  const handleClear = () => {
    setLocalStatus('ALL');
    setLocalCustomer('ALL');
    setLocalSearch('');
    setLocalDateFrom('');
    setLocalDateTo('');

    setStatusFilter('ALL');
    setCustomerFilter('ALL');
    setSearchFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [soResult, customerResult, usersResult] = await Promise.all([
        salesApi.listSOs({
          limit: 200,
        }),
        sharedApi.listParties({ role: 'CUSTOMER', active: true }),
        listUsers().catch(() => []),
      ]);

      const list = unwrap<SalesOrderDTO[]>(soResult);
      const customerList = unwrap<PartyDTO[]>(customerResult);
      setOrders(Array.isArray(list) ? list : []);
      setCustomers(Array.isArray(customerList) ? customerList : []);
      setUsers(Array.isArray(usersResult) ? usersResult : []);
    } catch (err: any) {
      console.error('Failed to load sales orders', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('sales.ordersList.loadError')
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusCounts = useMemo(() => {
    const counts = {
      DRAFT: 0,
      CONFIRMED: 0,
      PARTIALLY_DELIVERED: 0,
      FULLY_DELIVERED: 0,
      CLOSED: 0,
      CANCELLED: 0,
    };
    orders.forEach((order) => {
      // Filter status counts by other active filters
      if (customerFilter !== 'ALL' && order.customerId !== customerFilter) {
        return;
      }
      const orderDateStr = order.orderDate || (order.createdAt ? order.createdAt.split('T')[0] : '');
      if (dateFrom && orderDateStr < dateFrom) {
        return;
      }
      if (dateTo && orderDateStr > dateTo) {
        return;
      }
      if (searchFilter) {
        const query = searchFilter.toLowerCase().trim();
        const numMatch = order.orderNumber.toLowerCase().includes(query);
        const custNameMatch = (customerById[order.customerId] || order.customerName || '').toLowerCase().includes(query);
        const creator = userById[order.createdBy];
        const creatorMatch = creator
          ? creator.name.toLowerCase().includes(query) || creator.email.toLowerCase().includes(query)
          : order.createdBy.toLowerCase().includes(query);
        
        if (!numMatch && !custNameMatch && !creatorMatch) {
          return;
        }
      }

      if (order.status in counts) {
        counts[order.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [orders, customerFilter, dateFrom, dateTo, searchFilter, customerById, userById]);

  const statusFilterConfig = useMemo(() => ({
    options: [
      { value: 'DRAFT', label: t('sales.ordersList.status.DRAFT', 'Draft'), color: 'slate' },
      { value: 'CONFIRMED', label: t('sales.ordersList.status.CONFIRMED', 'Confirmed'), color: 'indigo' },
      { value: 'PARTIALLY_DELIVERED', label: t('sales.ordersList.status.PARTIALLY_DELIVERED', 'Partially Delivered'), color: 'amber' },
      { value: 'FULLY_DELIVERED', label: t('sales.ordersList.status.FULLY_DELIVERED', 'Fully Delivered'), color: 'emerald' },
      { value: 'CLOSED', label: t('sales.ordersList.status.CLOSED', 'Closed'), color: 'gray' },
      { value: 'CANCELLED', label: t('sales.ordersList.status.CANCELLED', 'Cancelled'), color: 'rose' },
    ],
    activeValue: statusFilter,
    onChange: (val: string) => {
      const targetStatus = val as SOStatusFilter;
      setStatusFilter(targetStatus);
      setLocalStatus(targetStatus);
      setPage(1);
    },
    counts: statusCounts,
  }), [statusFilter, statusCounts, t]);

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }
      if (customerFilter !== 'ALL' && order.customerId !== customerFilter) {
        return false;
      }
      const orderDateStr = order.orderDate || (order.createdAt ? order.createdAt.split('T')[0] : '');
      if (dateFrom && orderDateStr < dateFrom) {
        return false;
      }
      if (dateTo && orderDateStr > dateTo) {
        return false;
      }
      if (searchFilter) {
        const query = searchFilter.toLowerCase().trim();
        const numMatch = order.orderNumber.toLowerCase().includes(query);
        const custNameMatch = (customerById[order.customerId] || order.customerName || '').toLowerCase().includes(query);
        const creator = userById[order.createdBy];
        const creatorMatch = creator
          ? creator.name.toLowerCase().includes(query) || creator.email.toLowerCase().includes(query)
          : order.createdBy.toLowerCase().includes(query);
        
        if (!numMatch && !custNameMatch && !creatorMatch) {
          return false;
        }
      }
      return true;
    });
  }, [orders, statusFilter, customerFilter, dateFrom, dateTo, searchFilter, customerById, userById]);

  const handleOpenOrder = (id: string) => {
    navigate(`/sales/orders/${id}`);
  };

  // Filter & Sort Data
  const sortedData = useMemo(() => {
    let sorted = [...filteredOrders];
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
      // Default Sort: Date and Time descending, then Document Number descending
      sorted.sort((a, b) => {
        const dateA = a.createdAt || a.orderDate || '';
        const dateB = b.createdAt || b.orderDate || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        return b.orderNumber.localeCompare(a.orderNumber);
      });
    }
    return sorted;
  }, [filteredOrders, sortField, sortDirection, customerById]);

  const totalPages = Math.ceil(sortedData.length / pageSize);
  const paginatedData = useMemo(() => {
    return sortedData.slice((page - 1) * pageSize, page * pageSize);
  }, [sortedData, page, pageSize]);

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

  const columns = useMemo<ColumnDefinition<SalesOrderDTO>[]>(
    () => [
      {
        key: 'orderNumber',
        label: 'Order #',
        width: '120px',
        priority: 1,
        sortable: true,
        accessor: 'orderNumber',
        render: (val: string) => (
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{val}</span>
        ),
      },
      {
        key: 'customerName',
        label: 'Customer/Party',
        width: '200px',
        priority: 1,
        sortable: true,
        accessor: 'customerName',
        render: (_val: string, row: SalesOrderDTO) => (
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {customerById[row.customerId] || row.customerName}
          </span>
        ),
      },
      {
        key: 'orderDate',
        label: 'Order Date and time',
        width: '180px',
        priority: 1,
        sortable: true,
        accessor: 'orderDate',
        render: (_val: string, row: SalesOrderDTO) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-900 dark:text-slate-100">{row.orderDate}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {row.createdAt ? new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        ),
      },
      {
        key: 'grandTotalDoc',
        label: 'Grand Total',
        width: '130px',
        priority: 1,
        sortable: true,
        align: 'right',
        accessor: 'grandTotalDoc',
        render: (val: number, row: SalesOrderDTO) => (
          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
            {formatMoney(val, row.currency)}
          </span>
        ),
      },
      {
        key: 'currency',
        label: 'Currency',
        width: '80px',
        priority: 1,
        sortable: true,
        accessor: 'currency',
        align: 'center',
        render: (val: string) => (
          <span className="font-mono text-slate-600 dark:text-slate-400">{val}</span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '120px',
        priority: 1,
        sortable: true,
        accessor: 'status',
        render: (val: string) => (
          <span
            className={clsx(
              'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
              statusChipClasses(val as any)
            )}
          >
            {t(`sales.ordersList.status.${val}`, val)}
          </span>
        ),
      },
      {
        key: 'createdBy',
        label: 'Created By',
        width: '150px',
        priority: 2,
        accessor: 'createdBy',
        render: (val: string) => {
          const u = userById[val];
          if (!u) return <span className="text-xs text-slate-400 font-mono">{val}</span>;
          return (
            <div className="flex flex-col">
              <span className="font-medium text-slate-900 dark:text-slate-100">{u.name}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{u.email}</span>
            </div>
          );
        }
      },
      {
        key: 'expectedDeliveryDate',
        label: 'Expected Delivery',
        width: '140px',
        priority: 2,
        accessor: 'expectedDeliveryDate',
      },
      {
        key: 'confirmedAt',
        label: 'Confirmed At',
        width: '120px',
        priority: 3,
        accessor: 'confirmedAt',
      },
    ],
    [customerById, userById, t]
  );

  const rowActions = useMemo<RowAction<SalesOrderDTO>[]>(
    () => [
      {
        key: 'view',
        label: 'View',
        icon: Eye,
        onClick: (row) => handleOpenOrder(row.id),
        primary: false,
      },
      {
        key: 'print',
        label: 'Print',
        icon: Printer,
        onClick: (row) => {
          toast.success(`Printing order ${row.orderNumber}...`);
          window.print();
        },
        primary: false,
      }
    ],
    [navigate]
  );

  return (
    <OperationalListLayout<SalesOrderDTO>
      title={t('sales.ordersList.title')}
      subtitle={t('sales.ordersList.subtitle')}
      statusFilterConfig={statusFilterConfig}
      newButtonLabel={t('sales.ordersList.newButton')}
      onNewClick={() => navigate('/sales/orders/new')}
      onRefresh={load}
      loading={loading}
      error={error}
      hasActiveFilters={false}
      onClearFilters={undefined}
      filters={
        <div className="flex flex-row items-center gap-3 w-full flex-wrap">
          {/* SEARCH */}
          <div className="relative flex-1 min-w-[200px] w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={t('sales.ordersList.filters.searchPlaceholder', 'Order #, customer, user...')}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* CUSTOMER */}
          <div className="w-full lg:w-64">
            <PartySelector
              role="CUSTOMER"
              value={localCustomer === 'ALL' ? '' : localCustomer}
              onChange={(party) => setLocalCustomer(party ? party.id : 'ALL')}
              placeholder={t('sales.ordersList.filters.allCustomers', 'All Customers')}
            />
          </div>

          {/* STATUS */}
          <div className="w-full lg:w-36">
            <select
              value={localStatus}
              onChange={(e) => setLocalStatus(e.target.value as SOStatusFilter)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`sales.ordersList.status.${value}`, value)}
                </option>
              ))}
            </select>
          </div>

          {/* DATE RANGE */}
          <div className="flex gap-2 items-center w-full lg:w-auto">
            <DatePicker
              className="w-36"
              value={localDateFrom}
              onChange={setLocalDateFrom}
              placeholder={t('sales.ordersList.filters.dateFrom', 'Date From')}
            />
            <span className="text-slate-400 font-medium">-</span>
            <DatePicker
              className="w-36"
              value={localDateTo}
              onChange={setLocalDateTo}
              placeholder={t('sales.ordersList.filters.dateTo', 'Date To')}
            />
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button
              type="button"
              onClick={handleApply}
              className="flex-grow lg:flex-grow-0 inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-all hover:shadow-md hover:shadow-primary-600/10 active:scale-[0.98] duration-200"
            >
              <Filter size={16} />
              <span>{t('sales.ordersList.filters.apply', 'Apply')}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-[0.98] duration-200"
              title={t('sales.ordersList.filters.clear', 'Clear Filters')}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      }
      columns={columns}
      data={paginatedData}
      emptyMessage={t('sales.ordersList.empty.title')}
      onRowClick={(row) => handleOpenOrder(row.id)}
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

export default SalesOrdersListPage;
