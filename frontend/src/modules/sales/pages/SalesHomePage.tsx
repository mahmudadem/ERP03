import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  ShoppingCart,
  Truck,
  ClipboardList,
  RotateCcw,
  Settings,
  TrendingUp,
  AlertCircle,
  Clock,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowRight,
  DollarSign,
  Users,
  Layers,
} from 'lucide-react';
import { companyModulesApi } from '../../../api/companyModules';
import {
  DeliveryNoteDTO,
  SalesInvoiceDTO,
  SalesOrderDTO,
  SalesReturnDTO,
  SalesSettingsDTO,
  salesApi,
} from '../../../api/salesApi';
import { Card } from '../../../components/ui/Card';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import SalesInitializationWizard from '../wizards/SalesInitializationWizard';
import {
  resolveSalesWorkflowMode,
  shouldShowOperationalDocuments,
} from '../../../utils/documentPolicy';

// ─── Helpers ────────────────────────────────────────────────────────────────

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

/** Format ISO datetime or date string to human-readable date + time. */
function formatDateTime(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ─── Per-section In-Memory Cache ─────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Module-level cache map: survives re-renders, resets on page refresh
const _cache = new Map<string, CacheEntry<any>>();

function cacheGet<T>(key: string): T | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  _cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  PENDING_APPROVAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  CONFIRMED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  POSTED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  PARTIALLY_DELIVERED: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  FULLY_DELIVERED: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  CANCELLED: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400',
  CLOSED: 'bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400',
};

const StatusBadge = ({ status }: { status: string }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
      STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-600'
    }`}
  >
    {status.replace(/_/g, ' ')}
  </span>
);

// ─── Skeleton ────────────────────────────────────────────────────────────────

const Skeleton = ({ className = '' }: { className?: string }) => (
  <div className={`animate-pulse rounded bg-slate-200 dark:bg-slate-700 ${className}`} />
);

// ─── Quick Link Tile ──────────────────────────────────────────────────────────

interface QuickLinkProps {
  icon: React.ReactNode;
  label: string;
  sublabel?: string;
  onClick: () => void;
}

const QuickLinkTile = ({ icon, label, sublabel, onClick }: QuickLinkProps) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-all duration-150 hover:border-slate-300 hover:bg-slate-50/50 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/60"
  >
    <div
      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-600 dark:bg-slate-700/50 dark:text-slate-400 dark:group-hover:bg-indigo-950/40 dark:group-hover:text-indigo-400 transition-colors duration-150"
    >
      {icon}
    </div>
    <div className="min-w-0">
      <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{label}</div>
      {sublabel && <div className="text-[10px] text-slate-400">{sublabel}</div>}
    </div>
  </button>
);

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  loading: boolean;
  subtext?: string;
  accent?: 'normal' | 'warning' | 'danger' | 'success';
}

const KPI_ACCENT = {
  normal: '',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  success: 'text-emerald-600 dark:text-emerald-400',
};

const KPICard = ({ label, value, icon, iconBg, loading, subtext, accent = 'normal' }: KPICardProps) => (
  <Card className="flex items-center gap-4 p-4">
    <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
      {icon}
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
      {loading ? (
        <Skeleton className="mt-1 h-7 w-24" />
      ) : (
        <div className={`mt-0.5 text-2xl font-bold leading-none ${KPI_ACCENT[accent]} text-slate-900 dark:text-slate-100`}>
          {value}
        </div>
      )}
      {subtext && !loading && (
        <div className="mt-0.5 text-[10px] text-slate-400">{subtext}</div>
      )}
    </div>
  </Card>
);

// ─── Section Header ───────────────────────────────────────────────────────────

const SectionHeader = ({
  title,
  onRefresh,
  refreshing,
  action,
}: {
  title: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  action?: React.ReactNode;
}) => (
  <div className="mb-3 flex items-center justify-between">
    <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
      {title}
    </h2>
    <div className="flex items-center gap-2">
      {action}
      {onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
          title="Refresh this section"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      )}
    </div>
  </div>
);

// ─── Pipeline Row ─────────────────────────────────────────────────────────────

interface PipelineRowProps {
  icon: React.ReactNode;
  label: string;
  statuses: { status: string; label: string; count: number; color: string }[];
  total: number;
  loading: boolean;
  onBadgeClick: (status: string) => void;
  onClick: () => void;
}

const PipelineRow = ({ icon, label, statuses, total, loading, onBadgeClick, onClick }: PipelineRowProps) => (
  <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm dark:bg-slate-700 dark:text-slate-400">
      {icon}
    </div>
    <div className="min-w-[80px] text-sm font-medium text-slate-700 dark:text-slate-300">{label}</div>
    <div className="flex flex-1 flex-wrap items-center gap-1.5">
      {loading
        ? [1, 2, 3].map((i) => <Skeleton key={i} className="h-5 w-16" />)
        : statuses.map((s) => (
            <button
              key={s.status}
              type="button"
              onClick={() => onBadgeClick(s.status)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold transition-all hover:scale-105 active:scale-95 cursor-pointer hover:shadow-sm ${s.color} hover:opacity-90`}
            >
              {s.count} {s.label}
            </button>
          ))}
    </div>
    <div className="flex items-center gap-1.5">
      {loading ? (
        <Skeleton className="h-5 w-10" />
      ) : (
        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">{total}</span>
      )}
      <button
        type="button"
        onClick={onClick}
        className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600"
        title={`Go to ${label}`}
      >
        <ArrowRight size={13} />
      </button>
    </div>
  </div>
);

// ─── Settings Summary Panel ───────────────────────────────────────────────────

const SettingsSummary = ({
  settings,
  loading,
  onNavigate,
}: {
  settings: SalesSettingsDTO | null;
  loading: boolean;
  onNavigate: () => void;
}) => {
  const rows: { label: string; value: string }[] = settings
    ? [
        { label: 'Workflow', value: settings.workflowMode },
        { label: 'Invoice prefix', value: `${settings.siNumberPrefix} (next: #${settings.siNumberNextSeq})` },
        { label: 'SO prefix', value: `${settings.soNumberPrefix} (next: #${settings.soNumberNextSeq})` },
        { label: 'DN prefix', value: `${settings.dnNumberPrefix} (next: #${settings.dnNumberNextSeq})` },
        { label: 'SR prefix', value: `${settings.srNumberPrefix} (next: #${settings.srNumberNextSeq})` },
        { label: 'Quote prefix', value: `${settings.quoteNumberPrefix} (next: #${settings.quoteNumberNextSeq})` },
        { label: 'Payment terms', value: `${settings.defaultPaymentTermsDays} days` },
        {
          label: 'Direct invoicing',
          value: settings.allowDirectInvoicing ? 'Allowed' : 'Blocked',
        },
        {
          label: 'Credit override',
          value: settings.allowCreditOverride ? 'Allowed' : 'Blocked',
        },
        {
          label: 'Over-delivery',
          value: settings.allowOverDelivery
            ? `Yes (±${settings.overDeliveryTolerancePct}%)`
            : 'No',
        },
      ]
    : [];

  return (
    <Card className="p-4">
      <SectionHeader
        title="Module Settings"
        action={
          <button
            type="button"
            onClick={onNavigate}
            className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
          >
            Edit <ArrowRight size={11} />
          </button>
        }
      />
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </div>
      ) : !settings ? (
        <div className="text-sm text-slate-400">Not configured</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between py-1.5">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{r.label}</span>
              <span className="ml-4 text-right text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                {r.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SalesHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { companyId } = useCompanyAccess();

  // ── State ──────────────────────────────────────────────────────────────────
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
  const [invoices, setInvoices] = useState<SalesInvoiceDTO[]>([]);
  const [orders, setOrders] = useState<SalesOrderDTO[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteDTO[]>([]);
  const [returns, setReturns] = useState<SalesReturnDTO[]>([]);

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingDNs, setLoadingDNs] = useState(false);
  const [loadingReturns, setLoadingReturns] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const didInit = useRef(false);

  // ── Cache helpers scoped to company ───────────────────────────────────────
  const cKey = useCallback((section: string) => `sales:${companyId}:${section}`, [companyId]);

  // ── Per-section fetchers ───────────────────────────────────────────────────

  const fetchSettings = useCallback(async (force = false): Promise<SalesSettingsDTO | null> => {
    const key = cKey('settings');
    if (!force) {
      const cached = cacheGet<SalesSettingsDTO>(key);
      if (cached) { setSettings(cached); setLoadingSettings(false); return cached; }
    }
    setLoadingSettings(true);
    try {
      const raw = await salesApi.getSettings();
      const s = unwrap<SalesSettingsDTO | null>(raw);
      if (s) cacheSet(key, s, 5 * 60 * 1000); // 5 min TTL
      setSettings(s);
      return s;
    } finally {
      setLoadingSettings(false);
    }
  }, [cKey]);

  const fetchInvoices = useCallback(async (force = false) => {
    const key = cKey('invoices');
    if (!force) {
      const cached = cacheGet<SalesInvoiceDTO[]>(key);
      if (cached) { setInvoices(cached); setLoadingInvoices(false); return; }
    }
    setLoadingInvoices(true);
    try {
      const raw = await salesApi.listSIs({ limit: 500 });
      const list = unwrap<SalesInvoiceDTO[]>(raw);
      const arr = Array.isArray(list) ? list : [];
      cacheSet(key, arr, 60 * 1000);
      setInvoices(arr);
    } finally {
      setLoadingInvoices(false);
    }
  }, [cKey]);

  const fetchOrders = useCallback(async (force = false) => {
    const key = cKey('orders');
    if (!force) {
      const cached = cacheGet<SalesOrderDTO[]>(key);
      if (cached) { setOrders(cached); setLoadingOrders(false); return; }
    }
    setLoadingOrders(true);
    try {
      const raw = await salesApi.listSOs({ limit: 200 });
      const list = unwrap<SalesOrderDTO[]>(raw);
      const arr = Array.isArray(list) ? list : [];
      cacheSet(key, arr, 60 * 1000);
      setOrders(arr);
    } finally {
      setLoadingOrders(false);
    }
  }, [cKey]);

  const fetchDNs = useCallback(async (force = false) => {
    const key = cKey('dns');
    if (!force) {
      const cached = cacheGet<DeliveryNoteDTO[]>(key);
      if (cached) { setDeliveryNotes(cached); setLoadingDNs(false); return; }
    }
    setLoadingDNs(true);
    try {
      const raw = await salesApi.listDNs({ limit: 200 });
      const list = unwrap<DeliveryNoteDTO[]>(raw);
      const arr = Array.isArray(list) ? list : [];
      cacheSet(key, arr, 60 * 1000);
      setDeliveryNotes(arr);
    } finally {
      setLoadingDNs(false);
    }
  }, [cKey]);

  const fetchReturns = useCallback(async (force = false) => {
    const key = cKey('returns');
    if (!force) {
      const cached = cacheGet<SalesReturnDTO[]>(key);
      if (cached) { setReturns(cached); setLoadingReturns(false); return; }
    }
    setLoadingReturns(true);
    try {
      const raw = await salesApi.listReturns();
      const list = unwrap<SalesReturnDTO[]>(raw);
      const arr = Array.isArray(list) ? list : [];
      cacheSet(key, arr, 60 * 1000);
      setReturns(arr);
    } finally {
      setLoadingReturns(false);
    }
  }, [cKey]);

  // ── Boot sequence ──────────────────────────────────────────────────────────
  const boot = useCallback(async () => {
    if (!companyId) return;
    try {
      setLoadError(null);

      // Check module initialization
      const modules = await companyModulesApi.list(companyId);
      const salesModule = modules.find((m) => m.moduleCode === 'sales');
      if (salesModule && !salesModule.initialized) {
        setInitialized(false);
        setLoadingSettings(false);
        setLoadingInvoices(false);
        setLoadingReturns(false);
        return;
      }

      const s = await fetchSettings();
      if (!s) {
        setInitialized(false);
        return;
      }
      setInitialized(true);

      const showOps = shouldShowOperationalDocuments(resolveSalesWorkflowMode(s));

      await Promise.all([
        fetchInvoices(),
        fetchReturns(),
        showOps ? fetchOrders() : Promise.resolve(),
        showOps ? fetchDNs() : Promise.resolve(),
      ]);

      setLastRefreshed(new Date());
    } catch (err: any) {
      console.error('Sales hub boot failed', err);
      setLoadError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Failed to load sales module.',
      );
      setInitialized((p) => (p === null ? false : p));
    }
  }, [companyId, fetchSettings, fetchInvoices, fetchReturns, fetchOrders, fetchDNs]);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void boot();
  }, [boot]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const showOperationalDocuments = shouldShowOperationalDocuments(resolveSalesWorkflowMode(settings));
  const today = todayIso();

  const postedInvoices = invoices.filter((i) => i.status === 'POSTED');
  const totalRevenue = postedInvoices.reduce((s, i) => s + i.grandTotalBase, 0);
  const outstandingAR = postedInvoices.reduce((s, i) => s + Math.max(i.outstandingAmountBase, 0), 0);
  const overdueInvoices = postedInvoices.filter(
    (i) => !!i.dueDate && i.dueDate < today && i.outstandingAmountBase > 0,
  ).length;
  const pendingApproval = invoices.filter((i) => i.status === 'PENDING_APPROVAL').length;

  // Status breakdowns
  const siStatuses = ['DRAFT', 'PENDING_APPROVAL', 'POSTED', 'CANCELLED'].map((s) => ({
    status: s,
    label: s.replace(/_/g, ' '),
    count: invoices.filter((i) => i.status === s).length,
    color: STATUS_COLORS[s] ?? 'bg-slate-100 text-slate-600',
  })).filter((s) => s.count > 0);

  const soStatuses = ['DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'FULLY_DELIVERED', 'CLOSED', 'CANCELLED'].map((s) => ({
    status: s,
    label: s.replace(/_/g, ' '),
    count: orders.filter((o) => o.status === s).length,
    color: STATUS_COLORS[s] ?? 'bg-slate-100 text-slate-600',
  })).filter((s) => s.count > 0);

  const dnStatuses = ['DRAFT', 'POSTED', 'CANCELLED'].map((s) => ({
    status: s,
    label: s,
    count: deliveryNotes.filter((d) => d.status === s).length,
    color: STATUS_COLORS[s] ?? 'bg-slate-100 text-slate-600',
  })).filter((s) => s.count > 0);

  const srStatuses = ['DRAFT', 'POSTED', 'CANCELLED'].map((s) => ({
    status: s,
    label: s,
    count: returns.filter((r) => r.status === s).length,
    color: STATUS_COLORS[s] ?? 'bg-slate-100 text-slate-600',
  })).filter((s) => s.count > 0);

  // Recent activity: mix SI + SO, sorted by updatedAt desc, top 8
  interface ActivityItem {
    id: string;
    number: string;
    customer: string;
    type: 'Invoice' | 'Order' | 'Return' | 'Delivery';
    status: string;
    amount: number | null;
    updatedAt: string;
    route: string;
  }

  const recentActivity: ActivityItem[] = [
    ...invoices.map((i): ActivityItem => ({
      id: i.id,
      number: i.invoiceNumber,
      customer: i.customerName,
      type: 'Invoice',
      status: i.status,
      amount: i.grandTotalBase,
      updatedAt: i.updatedAt || i.createdAt,
      route: `/sales/invoices/${i.id}`,
    })),
    ...(showOperationalDocuments
      ? orders.map((o): ActivityItem => ({
          id: o.id,
          number: o.orderNumber,
          customer: o.customerName,
          type: 'Order',
          status: o.status,
          amount: o.grandTotalBase,
          updatedAt: o.updatedAt || o.createdAt,
          route: `/sales/orders/${o.id}`,
        }))
      : []),
    ...returns.map((r): ActivityItem => ({
      id: r.id,
      number: r.returnNumber,
      customer: r.customerName,
      type: 'Return',
      status: r.status,
      amount: r.grandTotalBase,
      updatedAt: r.updatedAt || r.createdAt,
      route: `/sales/returns/${r.id}`,
    })),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 10);

  // Top customers
  const topCustomers = Array.from(
    postedInvoices
      .reduce<Map<string, { name: string; total: number }>>((acc, inv) => {
        const cur = acc.get(inv.customerId);
        if (cur) cur.total += inv.grandTotalBase;
        else acc.set(inv.customerId, { name: inv.customerName, total: inv.grandTotalBase });
        return acc;
      }, new Map())
      .values(),
  )
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const maxCustomerTotal = topCustomers[0]?.total || 1;

  // ── Loading / Error / Init states ──────────────────────────────────────────
  if (loadingSettings && initialized === null) {
    return (
      <div className="space-y-6 p-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (loadError && initialized === null) {
    return (
      <div className="space-y-4 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Hub</h1>
        <Card className="flex items-center gap-3 p-5 text-sm text-red-700 dark:text-red-400">
          <AlertCircle size={18} className="flex-shrink-0" />
          {loadError}
        </Card>
      </div>
    );
  }

  if (initialized === false) {
    return (
      <SalesInitializationWizard
        onComplete={() => {
          setInitialized(true);
          didInit.current = false;
          void boot();
        }}
      />
    );
  }

  const TYPE_BADGE: Record<string, string> = {
    Invoice: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50',
    Order: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50',
    Return: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50',
    Delivery: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200/50 dark:border-slate-700/50',
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 p-4">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 shadow-sm border border-indigo-100/50 dark:border-indigo-900/30">
            <Layers size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-50">
                Sales Hub
              </h1>
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-950/30 dark:text-indigo-400 dark:ring-indigo-400/20">
                Module Dashboard
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500">
              <Clock size={12} className="text-slate-400 dark:text-slate-500" />
              <span>Last updated:</span>
              <span className="font-medium text-slate-600 dark:text-slate-400">
                {formatDateTime(lastRefreshed.toISOString())}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {showOperationalDocuments && (
            <button
              type="button"
              onClick={() => navigate('/sales/orders/new')}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              + New SO
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/sales/invoices/new')}
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-700 dark:bg-primary-600 dark:hover:bg-primary-500"
          >
            + New Invoice
          </button>
          <button
            type="button"
            onClick={() => navigate('/sales/settings')}
            className="rounded-lg border border-slate-300 p-1.5 text-slate-500 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700"
            title="Sales Settings"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* ── Quick Links ── */}
      <div>
        <SectionHeader title="Quick Links" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
          <QuickLinkTile
            icon={<FileText size={14} />}
            label="Invoices"
            sublabel={loadingInvoices ? '…' : `${invoices.length} total`}
            onClick={() => navigate('/sales/invoices')}
          />
          <QuickLinkTile
            icon={<ShoppingCart size={14} />}
            label="Orders"
            sublabel={loadingOrders ? '…' : `${orders.length} total`}
            onClick={() => navigate('/sales/orders')}
          />
          <QuickLinkTile
            icon={<Truck size={14} />}
            label="Delivery Notes"
            sublabel={loadingDNs ? '…' : `${deliveryNotes.length} total`}
            onClick={() => navigate('/sales/delivery-notes')}
          />
          <QuickLinkTile
            icon={<ClipboardList size={14} />}
            label="Quotations"
            onClick={() => navigate('/sales/quotes')}
          />
          <QuickLinkTile
            icon={<RotateCcw size={14} />}
            label="Returns"
            sublabel={loadingReturns ? '…' : `${returns.length} total`}
            onClick={() => navigate('/sales/returns')}
          />
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div>
        <SectionHeader
          title="Financials"
          onRefresh={() => { void fetchInvoices(true); setLastRefreshed(new Date()); }}
          refreshing={loadingInvoices}
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KPICard
            label="Total Revenue"
            value={formatCurrency(totalRevenue)}
            icon={<DollarSign size={20} className="text-slate-500 dark:text-slate-400" />}
            iconBg="bg-slate-50 dark:bg-slate-800/60"
            loading={loadingInvoices}
            subtext={`${postedInvoices.length} posted invoices`}
          />
          <KPICard
            label="Outstanding AR"
            value={formatCurrency(outstandingAR)}
            icon={<TrendingUp size={20} className="text-slate-500 dark:text-slate-400" />}
            iconBg="bg-slate-50 dark:bg-slate-800/60"
            loading={loadingInvoices}
          />
          <KPICard
            label="Overdue Invoices"
            value={String(overdueInvoices)}
            icon={<AlertCircle size={20} className={overdueInvoices > 0 ? "text-red-500" : "text-slate-500 dark:text-slate-400"} />}
            iconBg={overdueInvoices > 0 ? "bg-red-50 dark:bg-red-950/20" : "bg-slate-50 dark:bg-slate-800/60"}
            loading={loadingInvoices}
            accent={overdueInvoices > 0 ? 'danger' : 'normal'}
            subtext={overdueInvoices > 0 ? 'Require immediate action' : 'All current'}
          />
          <KPICard
            label="Pending Approval"
            value={String(pendingApproval)}
            icon={<Clock size={20} className={pendingApproval > 0 ? "text-amber-500" : "text-slate-500 dark:text-slate-400"} />}
            iconBg={pendingApproval > 0 ? "bg-amber-50 dark:bg-amber-950/20" : "bg-slate-50 dark:bg-slate-800/60"}
            loading={loadingInvoices}
            accent={pendingApproval > 0 ? 'warning' : 'normal'}
          />
        </div>
      </div>

      {/* ── Pipeline Overview + Settings (2-col) ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">

        {/* Pipeline */}
        <Card className="p-4">
          <SectionHeader
            title="Document Pipeline"
            onRefresh={() => {
              void fetchInvoices(true);
              if (showOperationalDocuments) { void fetchOrders(true); void fetchDNs(true); }
              void fetchReturns(true);
              setLastRefreshed(new Date());
            }}
            refreshing={loadingInvoices || loadingOrders || loadingDNs || loadingReturns}
          />
          <div className="space-y-2">
            <PipelineRow
              icon={<FileText size={15} />}
              label="Invoices"
              statuses={siStatuses}
              total={invoices.length}
              loading={loadingInvoices}
              onBadgeClick={(status) => navigate('/sales/invoices', { state: { statusFilter: status } })}
              onClick={() => navigate('/sales/invoices')}
            />
            {showOperationalDocuments && (
              <>
                <PipelineRow
                  icon={<ShoppingCart size={15} />}
                  label="Orders"
                  statuses={soStatuses}
                  total={orders.length}
                  loading={loadingOrders}
                  onBadgeClick={(status) => navigate('/sales/orders', { state: { statusFilter: status } })}
                  onClick={() => navigate('/sales/orders')}
                />
                <PipelineRow
                  icon={<Truck size={15} />}
                  label="Delivery Notes"
                  statuses={dnStatuses}
                  total={deliveryNotes.length}
                  loading={loadingDNs}
                  onBadgeClick={(status) => navigate('/sales/delivery-notes', { state: { statusFilter: status } })}
                  onClick={() => navigate('/sales/delivery-notes')}
                />
              </>
            )}
            <PipelineRow
              icon={<RotateCcw size={15} />}
              label="Returns"
              statuses={srStatuses}
              total={returns.length}
              loading={loadingReturns}
              onBadgeClick={(status) => navigate('/sales/returns', { state: { statusFilter: status } })}
              onClick={() => navigate('/sales/returns')}
            />
            {/* Quotations — nav only, no count */}
            <div className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2.5 dark:border-slate-700 dark:bg-slate-800/50">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm dark:bg-slate-700 dark:text-slate-400">
                <ClipboardList size={15} />
              </div>
              <div className="min-w-[80px] text-sm font-medium text-slate-700 dark:text-slate-300">Quotations</div>
              <div className="flex-1">
                <span className="text-[11px] text-slate-400">View in list page</span>
              </div>
              <button
                type="button"
                onClick={() => navigate('/sales/quotes')}
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600"
                title="Go to Quotations"
              >
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </Card>

        {/* Settings Summary */}
        <SettingsSummary
          settings={settings}
          loading={loadingSettings}
          onNavigate={() => navigate('/sales/settings')}
        />
      </div>

      {/* ── Recent Activity ── */}
      <Card className="p-4">
        <SectionHeader
          title="Recent Activity"
          action={
            <button
              type="button"
              onClick={() => navigate('/sales/invoices')}
              className="flex items-center gap-1 text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
            >
              All invoices <ArrowRight size={11} />
            </button>
          }
        />
        {loadingInvoices && recentActivity.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
          </div>
        ) : recentActivity.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">No activity yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Number</th>
                  <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Customer</th>
                  <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Type</th>
                  <th className="pb-2 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">Status</th>
                  <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Amount</th>
                  <th className="pb-2 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400">Date &amp; Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {recentActivity.map((item) => (
                  <tr
                    key={item.id}
                    className="group cursor-pointer rounded-lg transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    onClick={() => navigate(item.route)}
                  >
                    <td className="py-2 pr-3 font-mono text-xs font-semibold text-slate-700 dark:text-slate-200">
                      {item.number}
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600 dark:text-slate-300">
                      {item.customer}
                    </td>
                    <td className="py-2 pr-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_BADGE[item.type] ?? ''}`}>
                        {item.type}
                      </span>
                    </td>
                    <td className="py-2 pr-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-2 pr-3 text-right font-mono text-xs text-slate-700 dark:text-slate-200">
                      {item.amount !== null ? formatCurrency(item.amount) : '—'}
                    </td>
                    <td className="py-2 text-right text-[11px] text-slate-400">
                      {formatDateTime(item.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── Top Customers ── */}
      <Card className="p-4">
        <SectionHeader
          title="Top Customers"
          action={
            <div className="flex items-center gap-1 text-[11px] text-slate-400">
              <Users size={11} />
              by revenue (posted only)
            </div>
          }
        />
        {loadingInvoices && topCustomers.length === 0 ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-8 rounded-lg" />)}
          </div>
        ) : topCustomers.length === 0 ? (
          <div className="py-4 text-center text-sm text-slate-400">No posted invoices yet.</div>
        ) : (
          <div className="space-y-2">
            {topCustomers.map((c, idx) => {
              const pct = Math.round((c.total / maxCustomerTotal) * 100);
              return (
                <div key={c.name} className="group relative flex items-center gap-3">
                  <div className="w-5 flex-shrink-0 text-center text-[11px] font-bold text-slate-400">
                    {idx + 1}
                  </div>
                  <div className="relative min-w-0 flex-1 overflow-hidden rounded-lg">
                    {/* Bar */}
                    <div
                      className="absolute inset-y-0 left-0 rounded-lg bg-slate-100 transition-all duration-500 dark:bg-slate-800/65"
                      style={{ width: `${pct}%` }}
                    />
                    <div className="relative flex items-center justify-between px-3 py-2">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {c.name}
                      </span>
                      <span className="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">
                        {formatCurrency(c.total)}
                      </span>
                    </div>
                  </div>
                  <div className="w-10 flex-shrink-0 text-right text-[10px] text-slate-400">
                    {pct}%
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* ── Footer stamp ── */}
      <div className="flex items-center justify-center gap-1.5 pb-2 text-[10px] text-slate-300 dark:text-slate-600">
        <Layers size={10} />
        Sales module — cached data refreshes every 60 s per section
      </div>
    </div>
  );
};

export default SalesHomePage;
