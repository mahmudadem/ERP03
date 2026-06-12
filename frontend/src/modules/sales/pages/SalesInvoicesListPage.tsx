import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, Printer, Trash2, Filter, RotateCcw, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  PaymentStatus,
  SalesInvoiceDTO,
  salesApi,
  SIStatus,
} from '../../../api/salesApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { DatePicker } from '../../../components/shared/selectors/DatePicker';
import { listUsers, CompanyUser } from '../../../api/companyAdmin';
import { useUserPreferences } from '../../../hooks/useUserPreferences';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { useWindowManager } from '../../../context/WindowManagerContext';
import { clsx } from 'clsx';
import { useConfirm } from '../../../hooks/useConfirm';
import { formatMoney } from '../../../utils/formatMoney';
import { formatCompanyDate, formatCompanyTime, getCompanyToday } from '../../../utils/dateUtils';
import { accountingApi, FiscalYearDTO } from '../../../api/accountingApi';
import { OperationalListLayout } from '../../../components/shared/OperationalListLayout';
import { ColumnDefinition, RowAction } from '../../../components/ui/DataTable/types';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type SIStatusFilter = SIStatus | 'ALL';
type PaymentFilter = PaymentStatus | 'ALL';

const STATUS_VALUES: SIStatusFilter[] = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'POSTED', 'CANCELLED'];
const PAYMENT_VALUES: PaymentFilter[] = ['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID'];

const parseMonthDay = (value?: string): { month: number; day: number } | null => {
  const match = String(value || '').match(/^(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  const month = Number(match[1]);
  const day = Number(match[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { month, day };
};

const computeFiscalStartFromProfile = (todayIso: string, fiscalYearStart?: string): string => {
  const parsed = parseMonthDay(fiscalYearStart);
  if (!parsed) return `${todayIso.slice(0, 4)}-01-01`;

  const today = new Date(`${todayIso}T00:00:00`);
  const currentYearStart = new Date(today.getFullYear(), parsed.month - 1, parsed.day);
  const startYear = today >= currentYearStart ? today.getFullYear() : today.getFullYear() - 1;
  return `${startYear}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
};

const resolveFiscalStart = (years: FiscalYearDTO[], todayIso: string, fallbackStart?: string): string => {
  const active = years.find((year) =>
    (year.status === 'OPEN' || year.status === 'LOCKED') &&
    todayIso >= year.startDate &&
    todayIso <= year.endDate
  ) || years.find((year) => year.status === 'OPEN' || year.status === 'LOCKED');

  return active?.startDate || computeFiscalStartFromProfile(todayIso, fallbackStart);
};

const statusChipClasses = (status: SIStatus): string => {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700 ring-slate-200';
    case 'PENDING_APPROVAL':
      return 'bg-amber-100 text-amber-800 ring-amber-200';
    case 'POSTED':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
};

const paymentChipClasses = (status: PaymentStatus): string => {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-100 text-emerald-700 ring-emerald-200';
    case 'PARTIALLY_PAID':
      return 'bg-amber-100 text-amber-700 ring-amber-200';
    case 'UNPAID':
      return 'bg-rose-100 text-rose-700 ring-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
};

const SalesInvoicesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const { uiMode } = useUserPreferences();
  const { company } = useCompanyAccess();
  const { settings: companySettings } = useCompanySettings();
  const { openWindow } = useWindowManager();
  const isWindowsMode = uiMode === 'windows';
  const { confirm, confirmDialog } = useConfirm();
  const defaultDateTo = useMemo(() => getCompanyToday(companySettings), [companySettings]);
  const defaultDateFromFallback = useMemo(
    () => computeFiscalStartFromProfile(defaultDateTo, company?.fiscalYearStart),
    [company?.fiscalYearStart, defaultDateTo]
  );

  const location = useLocation();
  const stateStatus = (location.state as any)?.statusFilter;
  const initialStatus = stateStatus && STATUS_VALUES.includes(stateStatus) ? stateStatus : 'ALL';

  const [statusFilter, setStatusFilter] = useState<SIStatusFilter>(initialStatus);
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [personaFilter, setPersonaFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>(defaultDateFromFallback);
  const [dateTo, setDateTo] = useState<string>(defaultDateTo);

  // Local state buffers for filters
  const [localStatus, setLocalStatus] = useState<SIStatusFilter>(initialStatus);
  const [localPayment, setLocalPayment] = useState<PaymentFilter>('ALL');
  const [localCustomer, setLocalCustomer] = useState<string>('ALL');
  const [localPersona, setLocalPersona] = useState<string>('ALL');
  const [localSearch, setLocalSearch] = useState<string>('');
  const [localDateFrom, setLocalDateFrom] = useState<string>(defaultDateFromFallback);
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

  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoiceDTO[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc' | null>(null);
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [defaultFiscalDateFrom, setDefaultFiscalDateFrom] = useState<string>(defaultDateFromFallback);
  const defaultDateRangeAppliedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const syncDefaultDateRange = async () => {
      const today = getCompanyToday(companySettings);
      let fiscalStart = computeFiscalStartFromProfile(today, company?.fiscalYearStart);

      try {
        const fiscalYears = await accountingApi.listFiscalYears();
        fiscalStart = resolveFiscalStart(Array.isArray(fiscalYears) ? fiscalYears : [], today, company?.fiscalYearStart);
      } catch {
        // Keep the list usable before Accounting fiscal years are initialized.
      }

      if (cancelled) return;
      setDefaultFiscalDateFrom(fiscalStart);
      if (!defaultDateRangeAppliedRef.current) {
        setDateFrom(fiscalStart);
        setLocalDateFrom(fiscalStart);
        setDateTo(today);
        setLocalDateTo(today);
        defaultDateRangeAppliedRef.current = true;
      } else {
        setDateFrom((current) => current || fiscalStart);
        setLocalDateFrom((current) => current || fiscalStart);
        setDateTo((current) => current || today);
        setLocalDateTo((current) => current || today);
      }
    };

    void syncDefaultDateRange();
    return () => {
      cancelled = true;
    };
  }, [company?.fiscalYearStart, companySettings]);

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
    paymentFilter !== 'ALL' ||
    customerFilter !== 'ALL' ||
    personaFilter !== 'ALL' ||
    searchFilter !== '' ||
    dateFrom !== defaultFiscalDateFrom ||
    dateTo !== defaultDateTo;

  const handleApply = () => {
    setStatusFilter(localStatus);
    setPaymentFilter(localPayment);
    setCustomerFilter(localCustomer);
    setPersonaFilter(localPersona);
    setSearchFilter(localSearch);
    setDateFrom(localDateFrom);
    setDateTo(localDateTo);
    setPage(1);
  };

  const handleClear = () => {
    setLocalStatus('ALL');
    setLocalPayment('ALL');
    setLocalCustomer('ALL');
    setLocalPersona('ALL');
    setLocalSearch('');
    setLocalDateFrom(defaultFiscalDateFrom);
    setLocalDateTo(defaultDateTo);

    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setCustomerFilter('ALL');
    setPersonaFilter('ALL');
    setSearchFilter('');
    setDateFrom(defaultFiscalDateFrom);
    setDateTo(defaultDateTo);
    setPage(1);
  };

  const handleOpenInvoice = (id: string, number: string) => {
    if (isWindowsMode) {
      openWindow({
        type: 'sales_invoice',
        title: `Sales Invoice - ${number}`,
        data: { invoiceId: id },
        size: { width: 1100, height: 750 }
      });
    } else {
      navigate(`/sales/invoices/${id}`);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [invoiceResult, customerResult, usersResult] = await Promise.all([
        salesApi.listSIs({
          limit: 200,
        }),
        sharedApi.listParties({ role: 'CUSTOMER', active: true }),
        listUsers().catch(() => []),
      ]);

      const invoiceList = unwrap<SalesInvoiceDTO[]>(invoiceResult);
      const customerList = unwrap<PartyDTO[]>(customerResult);
      setInvoices(Array.isArray(invoiceList) ? invoiceList : []);
      setCustomers(Array.isArray(customerList) ? customerList : []);
      setUsers(Array.isArray(usersResult) ? usersResult : []);
    } catch (err: any) {
      console.error('Failed to load sales invoices', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('sales.invoicesList.loadError')
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
      if (customerFilter !== 'ALL' && inv.customerId !== customerFilter) {
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
        const custNameMatch = (customerById[inv.customerId] || inv.customerName || '').toLowerCase().includes(query);
        const creator = userById[inv.createdBy];
        const creatorMatch = creator
          ? creator.name.toLowerCase().includes(query) || creator.email.toLowerCase().includes(query)
          : inv.createdBy.toLowerCase().includes(query);

        if (!numMatch && !custNameMatch && !creatorMatch) {
          return;
        }
      }

      if (inv.status in counts) {
        counts[inv.status as keyof typeof counts]++;
      }
    });
    return counts;
  }, [invoices, paymentFilter, customerFilter, personaFilter, dateFrom, dateTo, searchFilter, customerById, userById]);

  const statusFilterConfig = useMemo(() => ({
    options: [
      { value: 'DRAFT', label: t('sales.invoicesList.status.DRAFT', 'Draft'), color: 'slate' },
      { value: 'PENDING_APPROVAL', label: t('sales.invoicesList.status.PENDING_APPROVAL', 'Pending Approval'), color: 'amber' },
      { value: 'POSTED', label: t('sales.invoicesList.status.POSTED', 'Posted'), color: 'emerald' },
      { value: 'CANCELLED', label: t('sales.invoicesList.status.CANCELLED', 'Cancelled'), color: 'rose' },
    ],
    activeValue: statusFilter,
    onChange: (val: string) => {
      const targetStatus = val as SIStatusFilter;
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
      if (customerFilter !== 'ALL' && inv.customerId !== customerFilter) {
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
        const custNameMatch = (customerById[inv.customerId] || inv.customerName || '').toLowerCase().includes(query);
        const creator = userById[inv.createdBy];
        const creatorMatch = creator
          ? creator.name.toLowerCase().includes(query) || creator.email.toLowerCase().includes(query)
          : inv.createdBy.toLowerCase().includes(query);

        if (!numMatch && !custNameMatch && !creatorMatch) {
          return false;
        }
      }
      return true;
    });
  }, [invoices, statusFilter, paymentFilter, customerFilter, personaFilter, dateFrom, dateTo, searchFilter, customerById, userById]);

  // Filter & Sort Data
  const sortedData = useMemo(() => {
    let sorted = [...filteredInvoices];
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
        const dateA = a.createdAt || a.invoiceDate || '';
        const dateB = b.createdAt || b.invoiceDate || '';
        if (dateA !== dateB) {
          return dateB.localeCompare(dateA);
        }
        return b.invoiceNumber.localeCompare(a.invoiceNumber);
      });
    }
    return sorted;
  }, [filteredInvoices, sortField, sortDirection, customerById]);

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

  const columns = useMemo<ColumnDefinition<SalesInvoiceDTO>[]>(
    () => [
      {
        key: 'invoiceNumber',
        label: 'Invoice #',
        width: '120px',
        priority: 1,
        sortable: true,
        accessor: 'invoiceNumber',
        align: 'center',
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
        align: 'center',
        render: (_val: string, row: SalesInvoiceDTO) => (
          <span className="font-medium text-slate-900 dark:text-slate-100">
            {customerById[row.customerId] || row.customerName}
          </span>
        ),
      },
      {
        key: 'invoiceDate',
        label: 'Invoice Date and time',
        width: '180px',
        priority: 1,
        sortable: true,
        accessor: 'invoiceDate',
        align: 'center',
        render: (_val: string, row: SalesInvoiceDTO) => (
          <div className="flex flex-col items-center text-center">
            <span className="font-medium text-slate-900 dark:text-slate-100">{formatCompanyDate(row.invoiceDate, companySettings)}</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {row.createdAt ? formatCompanyTime(row.createdAt, companySettings) : ''}
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
        align: 'center',
        accessor: 'grandTotalDoc',
        render: (val: number, row: SalesInvoiceDTO) => (
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
        key: 'persona',
        label: 'Invoice Type/Persona',
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
        label: 'Payments',
        width: '120px',
        priority: 1,
        sortable: true,
        accessor: 'paymentStatus',
        align: 'center',
        render: (val: string) => (
          <span
            className={clsx(
              'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
              paymentChipClasses(val as any)
            )}
          >
            {t(`sales.invoicesList.payment.${val}`, val)}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: '150px',
        priority: 1,
        sortable: true,
        accessor: 'status',
        align: 'center',
        render: (val: string) => (
          <span
            className={clsx(
              'inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset',
              statusChipClasses(val as any)
            )}
          >
            {t(`sales.invoicesList.status.${val}`, val)}
          </span>
        ),
      },
      {
        key: 'createdBy',
        label: 'Created By',
        width: '150px',
        priority: 2,
        accessor: 'createdBy',
        align: 'center',
        render: (val: string) => {
          const u = userById[val];
          if (!u) return <span className="text-xs text-slate-400 font-mono">{val}</span>;
          return (
            <div className="flex flex-col items-center text-center">
              <span className="font-medium text-slate-900 dark:text-slate-100">{u.name}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">{u.email}</span>
            </div>
          );
        }
      },
      {
        key: 'dueDate',
        label: 'Due Date',
        width: '120px',
        priority: 2,
        accessor: 'dueDate',
        align: 'center',
        render: (val: string) => formatCompanyDate(val, companySettings),
      },
      {
        key: 'postedAt',
        label: 'Posted At',
        width: '150px',
        priority: 3,
        accessor: 'postedAt',
        align: 'center',
        render: (val: string) => {
          if (!val) return '-';
          const d = new Date(val);
          if (isNaN(d.getTime())) return val;
          return (
            <div className="flex flex-col items-center text-center">
              <span className="font-medium text-slate-900 dark:text-slate-100">{formatCompanyDate(d, companySettings)}</span>
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {formatCompanyTime(d, companySettings)}
              </span>
            </div>
          );
        }
      },
    ],
    [companySettings, customerById, userById, t]
  );

  const rowActions = useMemo<RowAction<SalesInvoiceDTO>[]>(
    () => [
      {
        key: 'view',
        label: 'View',
        icon: Eye,
        onClick: (row) => handleOpenInvoice(row.id, row.invoiceNumber),
        primary: false,
      },
      {
        key: 'print',
        label: 'Print',
        icon: Printer,
        onClick: (row) => {
          toast.success(`Printing invoice ${row.invoiceNumber}...`);
          window.print();
        },
        primary: false,
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: Trash2,
        variant: 'danger',
        isEnabled: (row) => row.status === 'DRAFT',
        onClick: async (row) => {
          const isConfirmed = await confirm({
            title: t('sales.invoicesList.deleteConfirm.title', 'Delete Invoice'),
            message: `Are you sure you want to delete invoice ${row.invoiceNumber}? This action is irreversible.`,
            confirmLabel: t('actions.delete', 'Delete'),
            cancelLabel: t('actions.cancel', 'Cancel'),
            tone: 'danger',
          });
          if (isConfirmed) {
            try {
              await salesApi.deleteSI(row.id);
              toast.success(`Deleted invoice ${row.invoiceNumber}`);
              load();
            } catch (err) {
              toast.error('Failed to delete invoice');
            }
          }
        },
        primary: false,
      }
    ],
    [isWindowsMode, openWindow, navigate]
  );

  return (
    <>
      <OperationalListLayout<SalesInvoiceDTO>
        title={t('sales.invoicesList.title')}
        subtitle=""
        compactHeader
        statusFilterConfig={statusFilterConfig}
        newButtonLabel={t('sales.invoicesList.newButton')}
        onNewClick={() => {
          if (isWindowsMode) {
            openWindow({
              type: 'sales_invoice',
              title: t('sales.invoicesList.newWindowTitle', { defaultValue: 'New Sales Invoice' }),
              data: { invoiceId: 'new' },
              size: { width: 1100, height: 750 }
            });
          } else {
            navigate('/sales/invoices/new');
          }
        }}
        onRefresh={load}
        loading={loading}
        error={error}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={handleClear}
        filters={
          <div className="flex flex-row items-center gap-2.5 w-full overflow-x-auto whitespace-nowrap pb-1.5 lg:pb-0 scrollbar-thin">
            {/* SEARCH */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder={t('sales.invoicesList.filters.searchPlaceholder', 'Invoice #, customer, user...')}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 pl-10 pr-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>

            {/* CUSTOMER */}
            <div className="w-52 flex-shrink-0">
              <PartySelector
                role="CUSTOMER"
                value={localCustomer === 'ALL' ? '' : localCustomer}
                onChange={(party) => setLocalCustomer(party ? party.id : 'ALL')}
                placeholder={t('sales.invoicesList.filters.allCustomers', 'All Customers')}
              />
            </div>

            {/* TYPE (Persona) */}
            <div className="w-32 flex-shrink-0">
              <select
                value={localPersona}
                onChange={(e) => setLocalPersona(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
              >
                <option value="ALL">{t('sales.invoicesList.filters.typePlaceholder', 'Type')}</option>
                <option value="DIRECT">{t('sales.invoicesList.filters.direct', 'Direct')}</option>
                <option value="POS">{t('sales.invoicesList.filters.pos', 'POS')}</option>
              </select>
            </div>

            {/* STATUS */}
            <div className="w-32 flex-shrink-0">
              <select
                value={localStatus}
                onChange={(e) => setLocalStatus(e.target.value as SIStatusFilter)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-primary-500 outline-none cursor-pointer"
              >
                {STATUS_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value === 'ALL' ? t('sales.invoicesList.filters.statusPlaceholder', 'Status') : t(`sales.invoicesList.status.${value}`, value)}
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
                    {value === 'ALL' ? t('sales.invoicesList.filters.paymentPlaceholder', 'Payment') : t(`sales.invoicesList.payment.${value}`, value)}
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
                placeholder={t('sales.invoicesList.filters.dateFrom', 'Date From')}
              />
              <span className="text-slate-400 font-medium">-</span>
              <DatePicker
                className="w-32"
                value={localDateTo}
                onChange={setLocalDateTo}
                placeholder={t('sales.invoicesList.filters.dateTo', 'Date To')}
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
                <span>{t('sales.invoicesList.filters.apply', 'Apply')}</span>
              </button>
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex items-center justify-center p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-rose-600 dark:hover:text-rose-400 transition-all active:scale-[0.98] duration-200"
                title={t('sales.invoicesList.filters.clear', 'Clear Filters')}
              >
                <RotateCcw size={16} />
              </button>
            </div>
          </div>
        }
        columns={columns}
        data={paginatedData}
        emptyMessage={t('sales.invoicesList.empty.title')}
        onRowClick={(row) => handleOpenInvoice(row.id, row.invoiceNumber)}
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
      {confirmDialog}
    </>
  );
};

export default SalesInvoicesListPage;
