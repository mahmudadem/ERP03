import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Printer, RefreshCw, Filter, RotateCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { POStatus, PurchaseOrderDTO, purchasesApi } from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';
import { PartySelector, DatePicker } from '../../../components/shared/selectors';
import { formatMoney } from '../../../utils/formatMoney';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';
import { listUsers, CompanyUser } from '../../../api/companyAdmin';
import { clsx } from 'clsx';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type POStatusFilter = POStatus | 'ALL';

const STATUS_OPTIONS: Array<{ label: string; value: POStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Confirmed', value: 'CONFIRMED' },
  { label: 'Partially Received', value: 'PARTIALLY_RECEIVED' },
  { label: 'Fully Received', value: 'FULLY_RECEIVED' },
  { label: 'Closed', value: 'CLOSED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const statusChipClasses = (status: POStatus): string => {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
    case 'CONFIRMED':
      return 'bg-indigo-50 text-indigo-700 ring-indigo-600/10 dark:bg-indigo-950/35 dark:text-indigo-300 dark:ring-indigo-500/20';
    case 'PARTIALLY_RECEIVED':
      return 'bg-amber-50 text-amber-800 ring-amber-600/10 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-500/20';
    case 'FULLY_RECEIVED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/35 dark:text-emerald-300 dark:ring-emerald-500/20';
    case 'CLOSED':
      return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-950/35 dark:text-rose-300 dark:ring-rose-500/20';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
  }
};

const PurchaseOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [orders, setOrders] = useState<PurchaseOrderDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<POStatus | 'ALL'>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Local state buffers for filters
  const [localStatus, setLocalStatus] = useState<POStatus | 'ALL'>('ALL');
  const [localVendor, setLocalVendor] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [localDateFrom, setLocalDateFrom] = useState<string>('');
  const [localDateTo, setLocalDateTo] = useState<string>('');

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

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
    vendorFilter !== 'ALL' ||
    searchFilter !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  const handleApply = () => {
    setStatusFilter(localStatus);
    setVendorFilter(localVendor);
    setSearchFilter(localSearch);
    setDateFrom(localDateFrom);
    setDateTo(localDateTo);
    setPage(1);
  };

  const handleClear = () => {
    setLocalStatus('ALL');
    setLocalVendor('ALL');
    setLocalSearch('');
    setLocalDateFrom('');
    setLocalDateTo('');

    setStatusFilter('ALL');
    setVendorFilter('ALL');
    setSearchFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const [result, usersResult] = await Promise.all([
        purchasesApi.listPOs({
          limit: 200,
        }),
        listUsers().catch(() => []),
      ]);

      const list = unwrap<PurchaseOrderDTO[]>(result);
      setOrders(Array.isArray(list) ? list : []);
      setUsers(Array.isArray(usersResult) ? usersResult : []);
    } catch (err: any) {
      console.error('Failed to load purchase orders', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load purchase orders.'
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusCounts = useMemo(() => {
    const counts = {
      DRAFT: 0,
      CONFIRMED: 0,
      PARTIALLY_RECEIVED: 0,
      FULLY_RECEIVED: 0,
      CLOSED: 0,
      CANCELLED: 0,
    };
    orders.forEach((order) => {
      // Filter status counts by other active filters
      if (vendorFilter !== 'ALL' && order.vendorId !== vendorFilter) {
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
        const vendNameMatch = (order.vendorName || '').toLowerCase().includes(query);
        const creator = userById[order.createdBy];
        const creatorMatch = creator
          ? creator.name.toLowerCase().includes(query) || creator.email.toLowerCase().includes(query)
          : order.createdBy.toLowerCase().includes(query);
        
        if (!numMatch && !vendNameMatch && !creatorMatch) {
          return;
        }
      }

      if (order.status in counts) {
        counts[order.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [orders, vendorFilter, dateFrom, dateTo, searchFilter, userById]);

  const statusFilterConfig = useMemo(() => ({
    options: [
      { value: 'DRAFT', label: t('purchases.ordersList.status.DRAFT', 'Draft'), color: 'slate' },
      { value: 'CONFIRMED', label: t('purchases.ordersList.status.CONFIRMED', 'Confirmed'), color: 'indigo' },
      { value: 'PARTIALLY_RECEIVED', label: t('purchases.ordersList.status.PARTIALLY_RECEIVED', 'Partially Received'), color: 'amber' },
      { value: 'FULLY_RECEIVED', label: t('purchases.ordersList.status.FULLY_RECEIVED', 'Fully Received'), color: 'emerald' },
      { value: 'CLOSED', label: t('purchases.ordersList.status.CLOSED', 'Closed'), color: 'gray' },
      { value: 'CANCELLED', label: t('purchases.ordersList.status.CANCELLED', 'Cancelled'), color: 'rose' },
    ],
    activeValue: statusFilter,
    onChange: (val: string) => {
      const targetStatus = val as POStatus | 'ALL';
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
      if (vendorFilter !== 'ALL' && order.vendorId !== vendorFilter) {
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
        const vendNameMatch = (order.vendorName || '').toLowerCase().includes(query);
        const creator = userById[order.createdBy];
        const creatorMatch = creator
          ? creator.name.toLowerCase().includes(query) || creator.email.toLowerCase().includes(query)
          : order.createdBy.toLowerCase().includes(query);
        
        if (!numMatch && !vendNameMatch && !creatorMatch) {
          return false;
        }
      }
      return true;
    });
  }, [orders, statusFilter, vendorFilter, dateFrom, dateTo, searchFilter, userById]);

  const handleOpenOrder = (id: string) => {
    navigate(`/purchases/orders/${id}`);
  };

  // Filter & Sort Data
  const sortedData = useMemo(() => {
    let sorted = [...filteredOrders];
    if (sortField && sortDirection) {
      sorted.sort((a, b) => {
        const aVal = (a as any)[sortField];
        const bVal = (b as any)[sortField];

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
  }, [filteredOrders, sortField, sortDirection]);

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

  const columns = useMemo<ColumnDefinition<PurchaseOrderDTO>[]>(
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
        key: 'vendorName',
        label: 'Customer/Party',
        width: '200px',
        priority: 1,
        sortable: true,
        accessor: 'vendorName',
        render: (val: string) => (
          <span className="font-medium text-slate-900 dark:text-slate-100">{val}</span>
        ),
      },
      {
        key: 'orderDate',
        label: 'Order Date and time',
        width: '180px',
        priority: 1,
        sortable: true,
        accessor: 'orderDate',
        render: (_val: string, row: PurchaseOrderDTO) => (
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
        render: (val: number, row: PurchaseOrderDTO) => (
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
            {val}
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
    [userById]
  );

  const rowActions = useMemo<RowAction<PurchaseOrderDTO>[]>(
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
    <OperationalListLayout<PurchaseOrderDTO>
      title="Purchase Orders"
      subtitle=""
      compactHeader
      statusFilterConfig={statusFilterConfig}
      newButtonLabel="New PO"
      onNewClick={() => navigate('/purchases/orders/new')}
      onRefresh={loadOrders}
      loading={loading}
      error={error}
      hasActiveFilters={false}
      onClearFilters={undefined}
      filters={
        <div className="flex flex-row items-center gap-2.5 w-full overflow-x-auto whitespace-nowrap pb-1.5 lg:pb-0 scrollbar-thin">
          {/* SEARCH */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder={t('purchases.ordersList.filters.searchPlaceholder', 'Order #, vendor, user...')}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApply()}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          {/* VENDOR */}
          <div className="w-52 flex-shrink-0">
            <PartySelector
              role="VENDOR"
              value={localVendor === 'ALL' ? '' : localVendor}
              onChange={(party) => setLocalVendor(party ? party.id : 'ALL')}
              placeholder={t('purchases.ordersList.filters.allVendors', 'All Vendors')}
            />
          </div>

          {/* STATUS */}
          <div className="w-32 flex-shrink-0">
            <select
              value={localStatus}
              onChange={(e) => setLocalStatus(e.target.value as POStatus | 'ALL')}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.value === 'ALL' ? t('purchases.ordersList.filters.statusPlaceholder', 'Status') : status.label}
                </option>
              ))}
            </select>
          </div>

          {/* DATE RANGE */}
          <div className="flex gap-2 items-center flex-shrink-0">
            <DatePicker
              className="w-32"
              value={localDateFrom}
              onChange={setLocalDateFrom}
              placeholder={t('purchases.ordersList.filters.dateFrom', 'Date From')}
            />
            <span className="text-slate-400 font-medium">-</span>
            <DatePicker
              className="w-32"
              value={localDateTo}
              onChange={setLocalDateTo}
              placeholder={t('purchases.ordersList.filters.dateTo', 'Date To')}
            />
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={handleApply}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 transition-all hover:shadow-md hover:shadow-primary-600/10 active:scale-[0.98] duration-200"
            >
              <Filter size={16} />
              <span>{t('purchases.ordersList.filters.apply', 'Apply')}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-[0.98] duration-200"
              title={t('purchases.ordersList.filters.clear', 'Clear')}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      }
      columns={columns}
      data={paginatedData}
      emptyMessage="No purchase orders found."
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

export default PurchaseOrdersListPage;
