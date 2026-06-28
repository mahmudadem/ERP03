import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Printer, RefreshCw, Filter, RotateCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PaymentStatus,
  PIStatus,
  PurchaseInvoiceDTO,
  purchasesApi,
} from '../../../api/purchasesApi';
import { PartySelector, DatePicker } from '../../../components/shared/selectors';
import { clsx } from 'clsx';
import { listUsers, CompanyUser } from '../../../api/companyAdmin';
import { formatMoney } from '../../../utils/formatMoney';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type PIStatusFilter = PIStatus | 'ALL';
type PaymentFilter = PaymentStatus | 'ALL';

const STATUS_VALUES: PIStatusFilter[] = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'POSTED', 'CANCELLED'];
const PAYMENT_VALUES: PaymentFilter[] = ['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID'];

const statusChipClasses = (status: PIStatus): string => {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
    case 'PENDING_APPROVAL':
      return 'bg-amber-50 text-amber-800 ring-amber-600/10 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-500/20';
    case 'POSTED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/35 dark:text-emerald-300 dark:ring-emerald-500/20';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-950/35 dark:text-rose-300 dark:ring-rose-500/20';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
  }
};

const paymentChipClasses = (status: PaymentStatus): string => {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-600/10 dark:bg-emerald-950/35 dark:text-emerald-300 dark:ring-emerald-500/20';
    case 'PARTIALLY_PAID':
      return 'bg-amber-50 text-amber-800 ring-amber-600/10 dark:bg-amber-950/35 dark:text-amber-300 dark:ring-amber-500/20';
    case 'UNPAID':
      return 'bg-rose-50 text-rose-700 ring-rose-600/10 dark:bg-rose-950/35 dark:text-rose-300 dark:ring-rose-500/20';
    default:
      return 'bg-slate-50 text-slate-600 ring-slate-500/10 dark:bg-slate-900/35 dark:text-slate-300 dark:ring-slate-400/20';
  }
};

const PurchaseInvoicesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation(['purchases', 'common']);


  const [statusFilter, setStatusFilter] = useState<PIStatusFilter>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [personaFilter, setPersonaFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');

  // Local state buffers for filters
  const [localStatus, setLocalStatus] = useState<PIStatusFilter>('ALL');
  const [localPayment, setLocalPayment] = useState<PaymentFilter>('ALL');
  const [localVendor, setLocalVendor] = useState<string>('ALL');
  const [localPersona, setLocalPersona] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [localDateFrom, setLocalDateFrom] = useState<string>('');
  const [localDateTo, setLocalDateTo] = useState<string>('');

  const [invoices, setInvoices] = useState<PurchaseInvoiceDTO[]>([]);
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
    paymentFilter !== 'ALL' ||
    vendorFilter !== 'ALL' ||
    personaFilter !== 'ALL' ||
    searchFilter !== '' ||
    dateFrom !== '' ||
    dateTo !== '';

  const handleApply = () => {
    setStatusFilter(localStatus);
    setPaymentFilter(localPayment);
    setVendorFilter(localVendor);
    setPersonaFilter(localPersona);
    setSearchFilter(localSearch);
    setDateFrom(localDateFrom);
    setDateTo(localDateTo);
    setPage(1);
  };

  const handleClear = () => {
    setLocalStatus('ALL');
    setLocalPayment('ALL');
    setLocalVendor('ALL');
    setLocalPersona('ALL');
    setLocalSearch('');
    setLocalDateFrom('');
    setLocalDateTo('');

    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setVendorFilter('ALL');
    setPersonaFilter('ALL');
    setSearchFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handleOpenInvoice = (id: string) => {
    navigate(`/purchases/invoices/${id}`);
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [invoiceResult, usersResult] = await Promise.all([
        purchasesApi.listPIs({
          limit: 200,
        }),
        listUsers().catch(() => []),
      ]);

      const invoiceList = unwrap<PurchaseInvoiceDTO[]>(invoiceResult);
      setInvoices(Array.isArray(invoiceList) ? invoiceList : []);
      setUsers(Array.isArray(usersResult) ? usersResult : []);
    } catch (err: any) {
      console.error('Failed to load purchase invoices', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load purchase invoices.'
      );
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const statusCounts = useMemo(() => {
    const counts = { DRAFT: 0, PENDING_APPROVAL: 0, POSTED: 0, CANCELLED: 0 };
    invoices.forEach((inv) => {
      // Filter status counts by other active filters
      if (paymentFilter !== 'ALL' && inv.paymentStatus !== paymentFilter) {
        return;
      }
      if (vendorFilter !== 'ALL' && inv.vendorId !== vendorFilter) {
        return;
      }
      if (personaFilter !== 'ALL') {
        const invPersona = inv.persona || 'Direct';
        if (invPersona.toUpperCase() !== personaFilter.toUpperCase()) {
          return;
        }
      }
      const invDateStr = inv.invoiceDate || (inv.createdAt ? inv.createdAt.split('T')[0] : '');
      if (dateFrom && invDateStr < dateFrom) {
        return;
      }
      if (dateTo && invDateStr > dateTo) {
        return;
      }
      if (searchFilter) {
        const query = searchFilter.toLowerCase().trim();
        const numMatch = inv.invoiceNumber.toLowerCase().includes(query);
        const vendNameMatch = (inv.vendorName || '').toLowerCase().includes(query);
        const creator = userById[inv.createdBy];
        const creatorMatch = creator
          ? creator.name.toLowerCase().includes(query) || creator.email.toLowerCase().includes(query)
          : inv.createdBy.toLowerCase().includes(query);
        
        if (!numMatch && !vendNameMatch && !creatorMatch) {
          return;
        }
      }

      if (inv.status in counts) {
        counts[inv.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [invoices, paymentFilter, vendorFilter, personaFilter, dateFrom, dateTo, searchFilter, userById]);

  const statusFilterConfig = useMemo(() => ({
    options: [
      { value: 'DRAFT', label: t('invoicesList.statusOptions.DRAFT', 'Draft'), color: 'slate' },
      { value: 'PENDING_APPROVAL', label: t('invoicesList.statusOptions.PENDING_APPROVAL', 'Pending Approval'), color: 'amber' },
      { value: 'POSTED', label: t('invoicesList.statusOptions.POSTED', 'Posted'), color: 'emerald' },
      { value: 'CANCELLED', label: t('invoicesList.statusOptions.CANCELLED', 'Cancelled'), color: 'rose' },
    ],
    activeValue: statusFilter,
    onChange: (val: string) => {
      const targetStatus = val as PIStatusFilter;
      setStatusFilter(targetStatus);
      setLocalStatus(targetStatus);
      setPage(1);
    },
    counts: statusCounts,
  }), [statusFilter, statusCounts, t]);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== 'ALL' && inv.status !== statusFilter) {
        return false;
      }
      if (paymentFilter !== 'ALL' && inv.paymentStatus !== paymentFilter) {
        return false;
      }
      if (vendorFilter !== 'ALL' && inv.vendorId !== vendorFilter) {
        return false;
      }
      if (personaFilter !== 'ALL') {
        const invPersona = inv.persona || 'Direct';
        if (invPersona.toUpperCase() !== personaFilter.toUpperCase()) {
          return false;
        }
      }
      const invDateStr = inv.invoiceDate || (inv.createdAt ? inv.createdAt.split('T')[0] : '');
      if (dateFrom && invDateStr < dateFrom) {
        return false;
      }
      if (dateTo && invDateStr > dateTo) {
        return false;
      }
      if (searchFilter) {
        const query = searchFilter.toLowerCase().trim();
        const numMatch = inv.invoiceNumber.toLowerCase().includes(query);
        const vendNameMatch = (inv.vendorName || '').toLowerCase().includes(query);
        const creator = userById[inv.createdBy];
        const creatorMatch = creator
          ? creator.name.toLowerCase().includes(query) || creator.email.toLowerCase().includes(query)
          : inv.createdBy.toLowerCase().includes(query);
        
        if (!numMatch && !vendNameMatch && !creatorMatch) {
          return false;
        }
      }
      return true;
    });
  }, [invoices, statusFilter, paymentFilter, vendorFilter, personaFilter, dateFrom, dateTo, searchFilter, userById]);

  // Filter & Sort Data
  const sortedData = useMemo(() => {
    let sorted = [...filteredInvoices];
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
        const dateA = a.createdAt || a.invoiceDate || '';
        const dateB = b.createdAt || b.invoiceDate || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        return b.invoiceNumber.localeCompare(a.invoiceNumber);
      });
    }
    return sorted;
  }, [filteredInvoices, sortField, sortDirection]);

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

  const columns = useMemo<ColumnDefinition<PurchaseInvoiceDTO>[]>(
    () => [
      {
        key: 'invoiceNumber',
        label: t('invoicesList.columns.invoiceNumber', 'Invoice #'),
        width: '120px',
        priority: 1,
        sortable: true,
        accessor: 'invoiceNumber',
        render: (val: string) => (
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{val}</span>
        ),
      },
      {
        key: 'vendorName',
        label: t('invoicesList.columns.vendorName', 'Vendor'),
        width: '200px',
        priority: 1,
        sortable: true,
        accessor: 'vendorName',
        render: (val: string) => (
          <span className="font-medium text-slate-900 dark:text-slate-100">{val}</span>
        ),
      },
      {
        key: 'invoiceDate',
        label: t('invoicesList.columns.invoiceDate', 'Invoice Date and Time'),
        width: '180px',
        priority: 1,
        sortable: true,
        accessor: 'invoiceDate',
        render: (_val: string, row: PurchaseInvoiceDTO) => (
          <div className="flex flex-col">
            <span className="font-medium text-slate-900 dark:text-slate-100">{row.invoiceDate}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {row.createdAt ? new Date(row.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
          </div>
        ),
      },
      {
        key: 'grandTotalDoc',
        label: t('invoicesList.columns.grandTotal', 'Grand Total'),
        width: '130px',
        priority: 1,
        sortable: true,
        align: 'right',
        accessor: 'grandTotalDoc',
        render: (val: number, row: PurchaseInvoiceDTO) => (
          <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
            {formatMoney(val, row.currency)}
          </span>
        ),
      },
      {
        key: 'currency',
        label: t('invoicesList.columns.currency', 'Currency'),
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
        key: 'persona',
        label: t('invoicesList.columns.persona', 'Invoice Type/Persona'),
        width: '140px',
        priority: 1,
        sortable: true,
        accessor: 'persona',
        align: 'center',
        render: (val: string) => (
          <span className="capitalize px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
            {val || 'Direct'}
          </span>
        ),
      },
      {
        key: 'paymentStatus',
        label: t('invoicesList.columns.payments', 'Payments'),
        width: '120px',
        priority: 1,
        sortable: true,
        accessor: 'paymentStatus',
        render: (val: string) => (
          <span
            className={clsx(
              'rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
              paymentChipClasses(val as any)
            )}
          >
            {t(`invoicesList.paymentOptions.${val}`, val)}
          </span>
        ),
      },
      {
        key: 'status',
        label: t('invoicesList.columns.status', 'Status'),
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
            {t(`invoicesList.statusOptions.${val}`, val)}
          </span>
        ),
      },
      {
        key: 'createdBy',
        label: t('invoicesList.columns.createdBy', 'Created By'),
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
        key: 'dueDate',
        label: t('invoicesList.columns.dueDate', 'Due Date'),
        width: '120px',
        priority: 2,
        accessor: 'dueDate',
      },
      {
        key: 'postedAt',
        label: t('invoicesList.columns.postedAt', 'Posted At'),
        width: '150px',
        priority: 3,
        accessor: 'postedAt',
        render: (val: string) => {
          if (!val) return '-';
          const d = new Date(val);
          if (isNaN(d.getTime())) return val;
          return (
            <div className="flex flex-col">
              <span className="font-medium text-slate-900 dark:text-slate-100">{d.toLocaleDateString()}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          );
        }
      },
    ],
    [userById, t]
  );

  const rowActions = useMemo<RowAction<PurchaseInvoiceDTO>[]>(
    () => [
      {
        key: 'view',
        label: t('invoicesList.actions.view', 'View'),
        icon: Eye,
        onClick: (row) => handleOpenInvoice(row.id),
        primary: false,
      },
      {
        key: 'print',
        label: t('invoicesList.actions.print', 'Print'),
        icon: Printer,
        onClick: (row) => {
          toast.success(t('invoicesList.actions.printingToast', 'Printing invoice {{invoiceNumber}}...', { invoiceNumber: row.invoiceNumber }));
          window.print();
        },
        primary: false,
      }
    ],
    [navigate]
  );

  return (
    <OperationalListLayout<PurchaseInvoiceDTO>
      title={t('invoicesList.title')}
      subtitle=""
      compactHeader
      statusFilterConfig={statusFilterConfig}
      newButtonLabel={t('invoicesList.new')}
      onNewClick={() => navigate('/purchases/invoices/new')}
      onRefresh={load}
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
              placeholder={t('invoicesList.filters.searchPlaceholder', 'Invoice #, vendor, user...')}
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
              placeholder={t('invoicesList.allVendors', 'All Vendors')}
            />
          </div>

          {/* TYPE (Persona) */}
          <div className="w-32 flex-shrink-0">
            <select
              value={localPersona}
              onChange={(e) => setLocalPersona(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              <option value="ALL">{t('invoicesList.filters.allTypes', 'Type')}</option>
              <option value="DIRECT">{t('invoicesList.filters.direct', 'Direct')}</option>
              <option value="POS">{t('invoicesList.filters.pos', 'POS')}</option>
            </select>
          </div>

          {/* STATUS */}
          <div className="w-32 flex-shrink-0">
            <select
              value={localStatus}
              onChange={(e) => setLocalStatus(e.target.value as PIStatusFilter)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value === 'ALL' ? t('invoicesList.filters.statusPlaceholder', 'Status') : t(`invoicesList.statusOptions.${value}`, value)}
                </option>
              ))}
            </select>
          </div>

          {/* PAYMENT */}
          <div className="w-32 flex-shrink-0">
            <select
              value={localPayment}
              onChange={(e) => setLocalPayment(e.target.value as PaymentFilter)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
            >
              {PAYMENT_VALUES.map((value) => (
                <option key={value} value={value}>
                  {value === 'ALL' ? t('invoicesList.filters.paymentPlaceholder', 'Payment') : t(`invoicesList.paymentOptions.${value}`, value)}
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
              placeholder={t('invoicesList.filters.dateFrom', 'Date From')}
            />
            <span className="text-slate-400 font-medium">-</span>
            <DatePicker
              className="w-32"
              value={localDateTo}
              onChange={setLocalDateTo}
              placeholder={t('invoicesList.filters.dateTo', 'Date To')}
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
              <span>{t('invoicesList.filters.apply', 'Apply')}</span>
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-[0.98] duration-200"
              title={t('invoicesList.filters.clear', 'Clear')}
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      }
      columns={columns}
      data={paginatedData}
      emptyMessage={t('invoicesList.emptyTitle')}
      onRowClick={(row) => handleOpenInvoice(row.id)}
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

export default PurchaseInvoicesListPage;
