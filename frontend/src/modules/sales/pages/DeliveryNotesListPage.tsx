import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Printer, RefreshCw, Filter, RotateCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { DeliveryNoteDTO, DNStatus, salesApi } from '../../../api/salesApi';
import { InventoryWarehouseDTO, inventoryApi } from '../../../api/inventoryApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { DatePicker } from '../../../components/shared/selectors/DatePicker';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';
import { listUsers, CompanyUser } from '../../../api/companyAdmin';
import { clsx } from 'clsx';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type DNStatusFilter = DNStatus | 'ALL';

const STATUS_VALUES: DNStatusFilter[] = ['ALL', 'DRAFT', 'POSTED', 'CANCELLED'];

const statusChipClasses = (status: DNStatus): string => {
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

const DeliveryNotesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [statusFilter, setStatusFilter] = useState<DNStatusFilter>('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Local state buffers for filters
  const [localStatus, setLocalStatus] = useState<DNStatusFilter>('ALL');
  const [localWarehouse, setLocalWarehouse] = useState<string>('ALL');
  const [localCustomer, setLocalCustomer] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [localDateFrom, setLocalDateFrom] = useState<string>('');
  const [localDateTo, setLocalDateTo] = useState<string>('');

  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteDTO[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryWarehouseDTO[]>([]);
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const warehouseNameById = useMemo(
    () =>
      warehouses.reduce<Record<string, string>>((acc, warehouse) => {
        acc[warehouse.id] = `${warehouse.code} - ${warehouse.name}`;
        return acc;
      }, {}),
    [warehouses]
  );

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
    warehouseFilter !== 'ALL' ||
    customerFilter !== 'ALL' ||
    searchFilter !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  const handleApply = () => {
    setStatusFilter(localStatus);
    setWarehouseFilter(localWarehouse);
    setCustomerFilter(localCustomer);
    setSearchFilter(localSearch);
    setDateFrom(localDateFrom);
    setDateTo(localDateTo);
    setPage(1);
  };

  const handleClear = () => {
    setLocalStatus('ALL');
    setLocalWarehouse('ALL');
    setLocalCustomer('ALL');
    setLocalSearch('');
    setLocalDateFrom('');
    setLocalDateTo('');

    setStatusFilter('ALL');
    setWarehouseFilter('ALL');
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

      const [dnResult, warehouseResult, customerResult, usersResult] = await Promise.all([
        salesApi.listDNs({
          limit: 200,
        }),
        inventoryApi.listWarehouses({ active: true, limit: 200 }),
        sharedApi.listParties({ role: 'CUSTOMER', active: true }),
        listUsers().catch(() => []),
      ]);

      const dnList = unwrap<DeliveryNoteDTO[]>(dnResult);
      const warehouseList = unwrap<InventoryWarehouseDTO[]>(warehouseResult);
      const customerList = unwrap<PartyDTO[]>(customerResult);
      setDeliveryNotes(Array.isArray(dnList) ? dnList : []);
      setWarehouses(Array.isArray(warehouseList) ? warehouseList : []);
      setCustomers(Array.isArray(customerList) ? customerList : []);
      setUsers(Array.isArray(usersResult) ? usersResult : []);
    } catch (err: any) {
      console.error('Failed to load delivery notes', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('sales.deliveryNotesList.loadError')
      );
      setDeliveryNotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusCounts = useMemo(() => {
    const counts = { DRAFT: 0, POSTED: 0, CANCELLED: 0 };
    deliveryNotes.forEach((dn) => {
      // Filter status counts by other active filters
      if (warehouseFilter !== 'ALL' && dn.warehouseId !== warehouseFilter) {
        return;
      }
      if (customerFilter !== 'ALL' && dn.customerId !== customerFilter) {
        return;
      }
      const dnDateStr = dn.deliveryDate || (dn.createdAt ? dn.createdAt.split('T')[0] : '');
      if (dateFrom && dnDateStr < dateFrom) {
        return;
      }
      if (dateTo && dnDateStr > dateTo) {
        return;
      }
      if (searchFilter) {
        const query = searchFilter.toLowerCase().trim();
        const numMatch = dn.dnNumber.toLowerCase().includes(query);
        const custNameMatch = (customerById[dn.customerId] || dn.customerName || '').toLowerCase().includes(query);
        const whName = warehouseNameById[dn.warehouseId] || dn.warehouseId;
        const whMatch = whName.toLowerCase().includes(query);
        const creator = userById[dn.createdBy];
        const creatorMatch = creator
          ? creator.name.toLowerCase().includes(query) || creator.email.toLowerCase().includes(query)
          : dn.createdBy.toLowerCase().includes(query);
        
        if (!numMatch && !custNameMatch && !whMatch && !creatorMatch) {
          return;
        }
      }

      if (dn.status in counts) {
        counts[dn.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [deliveryNotes, warehouseFilter, customerFilter, dateFrom, dateTo, searchFilter, customerById, warehouseNameById, userById]);

  const statusFilterConfig = useMemo(() => ({
    options: [
      { value: 'DRAFT', label: t('sales.deliveryNotesList.status.DRAFT', 'Draft'), color: 'slate' },
      { value: 'POSTED', label: t('sales.deliveryNotesList.status.POSTED', 'Posted'), color: 'emerald' },
      { value: 'CANCELLED', label: t('sales.deliveryNotesList.status.CANCELLED', 'Cancelled'), color: 'rose' },
    ],
    activeValue: statusFilter,
    onChange: (val: string) => {
      const targetStatus = val as DNStatusFilter;
      setStatusFilter(targetStatus);
      setLocalStatus(targetStatus);
      setPage(1);
    },
    counts: statusCounts,
  }), [statusFilter, statusCounts, t]);

  const filteredNotes = useMemo(() => {
    return deliveryNotes.filter((dn) => {
      if (statusFilter !== 'ALL' && dn.status !== statusFilter) return false;
      if (warehouseFilter !== 'ALL' && dn.warehouseId !== warehouseFilter) return false;
      if (customerFilter !== 'ALL' && dn.customerId !== customerFilter) return false;
      const dnDateStr = dn.deliveryDate || (dn.createdAt ? dn.createdAt.split('T')[0] : '');
      if (dateFrom && dnDateStr < dateFrom) {
        return false;
      }
      if (dateTo && dnDateStr > dateTo) {
        return false;
      }
      if (searchFilter) {
        const query = searchFilter.toLowerCase().trim();
        const numMatch = dn.dnNumber.toLowerCase().includes(query);
        const custNameMatch = (customerById[dn.customerId] || dn.customerName || '').toLowerCase().includes(query);
        const whName = warehouseNameById[dn.warehouseId] || dn.warehouseId;
        const whMatch = whName.toLowerCase().includes(query);
        const creator = userById[dn.createdBy];
        const creatorMatch = creator
          ? creator.name.toLowerCase().includes(query) || creator.email.toLowerCase().includes(query)
          : dn.createdBy.toLowerCase().includes(query);
        
        if (!numMatch && !custNameMatch && !whMatch && !creatorMatch) {
          return false;
        }
      }
      return true;
    });
  }, [deliveryNotes, statusFilter, warehouseFilter, customerFilter, dateFrom, dateTo, searchFilter, customerById, warehouseNameById, userById]);

  // Sort Data
  const sortedData = useMemo(() => {
    let sorted = [...filteredNotes];
    if (sortField && sortDirection) {
      sorted.sort((a, b) => {
        let aVal = (a as any)[sortField];
        let bVal = (b as any)[sortField];

        if (sortField === 'customerName') {
          aVal = customerById[a.customerId] || a.customerName || '';
          bVal = customerById[b.customerId] || b.customerName || '';
        } else if (sortField === 'warehouseName') {
          aVal = warehouseNameById[a.warehouseId] || a.warehouseId || '';
          bVal = warehouseNameById[b.warehouseId] || b.warehouseId || '';
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default Sort: Date and Time descending, then Document Number descending
      sorted.sort((a, b) => {
        const dateA = a.createdAt || a.deliveryDate || '';
        const dateB = b.createdAt || b.deliveryDate || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        return b.dnNumber.localeCompare(a.dnNumber);
      });
    }
    return sorted;
  }, [filteredNotes, sortField, sortDirection, customerById, warehouseNameById]);

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

  const handleOpenNote = (id: string) => {
    navigate(`/sales/delivery-notes/${id}`);
  };

  const columns = useMemo<ColumnDefinition<DeliveryNoteDTO>[]>(
    () => [
      {
        key: 'dnNumber',
        label: 'DN #',
        width: '120px',
        priority: 1,
        sortable: true,
        accessor: 'dnNumber',
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
        render: (_val: string, row: DeliveryNoteDTO) => (
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {customerById[row.customerId] || row.customerName}
          </span>
        ),
      },
      {
        key: 'deliveryDate',
        label: 'Delivery Date and time',
        width: '180px',
        priority: 1,
        sortable: true,
        accessor: 'deliveryDate',
        render: (_val: string, row: DeliveryNoteDTO) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-900 dark:text-slate-100">{row.deliveryDate}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {row.createdAt ? new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        ),
      },
      {
        key: 'warehouseName',
        label: 'Warehouse',
        width: '160px',
        priority: 1,
        sortable: true,
        accessor: (row) => warehouseNameById[row.warehouseId] || row.warehouseId,
        render: (val: string) => (
          <span className="text-slate-700 dark:text-slate-300">{val}</span>
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
            {t(`sales.deliveryNotesList.status.${val}`, val)}
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
    ],
    [customerById, warehouseNameById, userById, t]
  );

  const rowActions = useMemo<RowAction<DeliveryNoteDTO>[]>(
    () => [
      {
        key: 'view',
        label: 'View',
        icon: Eye,
        onClick: (row) => handleOpenNote(row.id),
        primary: false,
      },
      {
        key: 'print',
        label: 'Print',
        icon: Printer,
        onClick: (row) => {
          toast.success(`Printing delivery note ${row.dnNumber}...`);
          window.print();
        },
        primary: false,
      }
    ],
    [navigate]
  );

  return (
    <OperationalListLayout<DeliveryNoteDTO>
      title={t('sales.deliveryNotesList.title')}
      subtitle={t('sales.deliveryNotesList.subtitle')}
      statusFilterConfig={statusFilterConfig}
      newButtonLabel={t('sales.deliveryNotesList.newButton')}
      onNewClick={() => navigate('/sales/delivery-notes/new')}
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
              placeholder={t('sales.deliveryNotesList.filters.searchPlaceholder', 'DN #, customer, user...')}
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
              placeholder={t('sales.deliveryNotesList.filters.allCustomers', 'All Customers')}
            />
          </div>

          {/* WAREHOUSE */}
          <div className="w-full lg:w-44">
            <select
              value={localWarehouse}
              onChange={(e) => setLocalWarehouse(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              <option value="ALL">{t('sales.deliveryNotesList.filters.allWarehouses', 'All Warehouses')}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} - {warehouse.name}
                </option>
              ))}
            </select>
          </div>

          {/* STATUS */}
          <div className="w-full lg:w-36">
            <select
              value={localStatus}
              onChange={(e) => setLocalStatus(e.target.value as DNStatusFilter)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`sales.deliveryNotesList.status.${value}`, value)}
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
              placeholder={t('sales.deliveryNotesList.filters.dateFrom', 'Date From')}
            />
            <span className="text-slate-400 font-medium">-</span>
            <DatePicker
              className="w-36"
              value={localDateTo}
              onChange={setLocalDateTo}
              placeholder={t('sales.deliveryNotesList.filters.dateTo', 'Date To')}
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
              <span>{t('sales.deliveryNotesList.filters.apply', 'Apply')}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-[0.98] duration-200"
              title={t('sales.deliveryNotesList.filters.clear', 'Clear Filters')}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      }
      columns={columns}
      data={paginatedData}
      emptyMessage={t('sales.deliveryNotesList.empty.title')}
      onRowClick={(row) => handleOpenNote(row.id)}
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

export default DeliveryNotesListPage;
