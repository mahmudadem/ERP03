import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
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
  Plus,
} from 'lucide-react';
import { companyModulesApi } from '../../../api/companyModules';
import { listUsers, CompanyUser } from '../../../api/companyAdmin';
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
import { subscribeToSettingsChanges } from '../../../utils/settingsSync';

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

function parseCustomerName(name: string): { primary: string; secondary: string } {
  if (!name) return { primary: '—', secondary: '' };
  const delimiters = [/ \/ /, / \| /, / - /];
  for (const delim of delimiters) {
    const parts = name.split(delim);
    if (parts.length > 1) {
      return {
        primary: parts[0].trim(),
        secondary: parts[1].trim(),
      };
    }
  }
  
  const hasArabic = /[\u0600-\u06FF]/.test(name);
  if (hasArabic) {
    return {
      primary: name,
      secondary: 'Client Partner',
    };
  } else {
    return {
      primary: name,
      secondary: 'Customer Account',
    };
  }
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
    className="group flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left transition-all duration-150 hover:border-slate-400 hover:bg-slate-50/50 hover:shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700/60"
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string;
  loading: boolean;
  subtext?: string;
  accent?: 'normal' | 'warning' | 'danger' | 'success';
  subtextAccent?: 'normal' | 'warning' | 'danger' | 'success';
  suffix?: string;
}

const KPI_BORDERS = {
  normal: 'border-l-[3px] border-l-blue-500 dark:border-l-blue-400',
  warning: 'border-l-[3px] border-l-amber-500 dark:border-l-amber-400',
  danger: 'border-l-[3px] border-l-red-500 dark:border-l-red-400',
  success: 'border-l-[3px] border-l-emerald-500 dark:border-l-emerald-400',
};

const KPI_DOTS = {
  normal: 'bg-slate-400',
  warning: 'bg-amber-500',
  danger: 'bg-red-500',
  success: 'bg-emerald-500',
};

const KPI_SUBTEXT_ACCENT = {
  normal: 'text-slate-400 dark:text-slate-500',
  warning: 'text-amber-600 dark:text-amber-400 font-medium',
  danger: 'text-red-600 dark:text-red-400 font-medium',
  success: 'text-emerald-600 dark:text-emerald-400 font-medium',
};

const KPICard = ({
  label,
  value,
  loading,
  subtext,
  accent = 'normal',
  subtextAccent,
  suffix,
}: KPICardProps) => (
  <Card
    className={`p-2 px-3 flex flex-col justify-center rounded-lg shadow-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 ${KPI_BORDERS[accent]}`}
  >
    <div className="flex items-center justify-between">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {label}
      </div>
      <div className="flex items-baseline gap-1">
        {loading ? (
          <Skeleton className="h-5 w-16" />
        ) : (
          <>
            <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
              {value}
            </span>
            {suffix && (
              <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">
                {suffix}
              </span>
            )}
          </>
        )}
      </div>
    </div>
    {subtext && !loading && (
      <div className="mt-1 flex items-center gap-1.5 text-[9px] truncate">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${KPI_DOTS[subtextAccent || accent]}`} />
        <span className={`truncate ${KPI_SUBTEXT_ACCENT[subtextAccent || accent]}`}>
          {subtext}
        </span>
      </div>
    )}
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
    const { t } = useTranslation('common');
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
            {t(`Edit`)} <ArrowRight size={11} />
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
        <div className="text-sm text-slate-400">{t(`Not configured`)}</div>
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
  const { t } = useTranslation('common');
  const { companyId } = useCompanyAccess();

  // ── State ──────────────────────────────────────────────────────────────────
  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
  const [invoices, setInvoices] = useState<SalesInvoiceDTO[]>([]);
  const [orders, setOrders] = useState<SalesOrderDTO[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNoteDTO[]>([]);
  const [returns, setReturns] = useState<SalesReturnDTO[]>([]);
  const [users, setUsers] = useState<CompanyUser[]>([]);

  const [loadingSettings, setLoadingSettings] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(true);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingDNs, setLoadingDNs] = useState(false);
  const [loadingReturns, setLoadingReturns] = useState(true);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    return subscribeToSettingsChanges((changedCompanyId) => {
      if (!changedCompanyId || changedCompanyId === companyId) {
        setRefreshTrigger((prev) => prev + 1);
      }
    });
  }, [companyId]);

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

      const [_, __, ___, ____, usrRes] = await Promise.all([
        fetchInvoices(),
        fetchReturns(),
        showOps ? fetchOrders() : Promise.resolve(),
        showOps ? fetchDNs() : Promise.resolve(),
        listUsers().catch(() => null),
      ]);

      if (usrRes) {
        setUsers(unwrap<CompanyUser[]>(usrRes) || []);
      }

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
    if (refreshTrigger > 0) {
      _cache.clear();
      void boot();
    } else {
      if (didInit.current) return;
      didInit.current = true;
      void boot();
    }
  }, [boot, refreshTrigger]);

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

  // Recent activity: mix SI + SO, sorted by updatedAt desc, top 8
  interface ActivityItem {
    id: string;
    number: string;
    customer: string;
    type: 'Invoice' | 'Order' | 'Return' | 'Delivery';
    status: string;
    amount: number | null;
    currency: string;
    createdBy: string;
    createdAt: string;
    approvedAt?: string;
    date: string;
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
      amount: i.grandTotalDoc,
      currency: i.currency,
      createdBy: i.createdBy,
      createdAt: i.createdAt,
      approvedAt: i.postedAt,
      date: i.invoiceDate || i.createdAt.split('T')[0],
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
          amount: o.grandTotalDoc,
          currency: o.currency,
          createdBy: o.createdBy,
          createdAt: o.createdAt,
          approvedAt: o.confirmedAt,
          date: o.orderDate || o.createdAt.split('T')[0],
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
      amount: r.grandTotalDoc,
      currency: r.currency,
      createdBy: r.createdBy,
      createdAt: r.createdAt,
      approvedAt: r.postedAt,
      date: r.createdAt.split('T')[0],
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

  const recentOrders = useMemo(() => orders.slice(0, 10), [orders]);
  const recentInvoices = useMemo(() => invoices.slice(0, 10), [invoices]);
  const companyCurrency = invoices[0]?.currency || 'SYP';

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
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t(`Sales Hub`)}</h1>
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

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3.5 p-4">

      {/* ── Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-200/60 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 shadow-sm border border-indigo-100/50 dark:border-indigo-900/30">
            <TrendingUp size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
                Sales Overview Module
              </h1>
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-950/30 dark:text-indigo-400 dark:ring-indigo-400/20">
                Module Dashboard
              </span>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Track and publish invoices, monitor receivables, and configure sales order funnels.
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => navigate('/sales/orders/new')}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 shadow-sm"
          >
            <Plus size={14} />
            {t('sales.home.createOrder', 'Sales Order')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/sales/invoices/new')}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 shadow-sm"
          >
            <Plus size={14} />
            {t('sales.home.createInvoice', 'Invoice')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/sales/returns/new')}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500 shadow-sm"
          >
            <Plus size={14} />
            {t('sales.home.createReturn', 'Sales Return')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/sales/settings')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-805 dark:text-slate-200 dark:hover:bg-slate-700 shadow-sm"
            title="Sales Settings"
          >
            <Settings size={14} />
            {t('sales.home.settings', 'Settings')}
          </button>
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KPICard
          label="Total Revenue"
          value={formatCurrency(totalRevenue)}
          suffix={companyCurrency}
          loading={loadingInvoices}
          accent="normal"
          subtextAccent="success"
          subtext="Realized cash settlements"
        />
        <KPICard
          label="Outstanding AR"
          value={formatCurrency(outstandingAR)}
          suffix={companyCurrency}
          loading={loadingInvoices}
          accent="normal"
          subtextAccent="danger"
          subtext="Due collection ledger status"
        />
        <KPICard
          label="Overdue Invoices"
          value={String(overdueInvoices)}
          suffix="Active items"
          loading={loadingInvoices}
          accent={overdueInvoices > 0 ? 'danger' : 'normal'}
          subtextAccent={overdueInvoices > 0 ? 'danger' : 'normal'}
          subtext="Requiring immediate credit claims"
        />
        <KPICard
          label="Pending Approval"
          value={String(pendingApproval)}
          suffix="Invoices pending"
          loading={loadingInvoices}
          accent={pendingApproval > 0 ? 'warning' : 'normal'}
          subtextAccent={pendingApproval > 0 ? 'warning' : 'normal'}
          subtext="Awaiting bank transfers"
        />
      </div>

      {/* ── Main Workspace Grid (Left tables & Right sidebar) ── */}
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">

        {/* Left Column: Tables */}
        <div className="space-y-3.5">

          {/* RECENT SALES ORDERS (SO) */}
          {showOperationalDocuments && (
            <Card className="p-3.5 shadow-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Recent Sales Orders (SO)
                </h3>
                <button
                  type="button"
                  onClick={() => navigate('/sales/orders')}
                  className="text-[10px] font-bold text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                >
                  Fulfillment Queue
                </button>
              </div>
              <div className="border-b border-slate-100 dark:border-slate-700/60 mb-2.5" />
              {loadingOrders && recentOrders.length === 0 ? (
                <div className="h-[150px] flex flex-col justify-between border border-slate-300 dark:border-slate-700 p-3 rounded-lg">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-6 rounded" />)}
                </div>
              ) : recentOrders.length === 0 ? (
                <div className="h-[150px] flex items-center justify-center text-center text-xs text-slate-400 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50/20">
                  No recent orders.
                </div>
              ) : (
                <div className="h-[150px] overflow-auto border border-slate-300 dark:border-slate-700 rounded-lg custom-scroll">
                  <table className="w-full text-[11px] text-left border-collapse">
                    <thead className="sticky top-0 z-10">
                      <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900 shadow-sm">
                        <th className="py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t(`SO Number`)}</th>
                        <th className="py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t(`Date`)}</th>
                        <th className="py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t(`Customer / Client`)}</th>
                        <th className="py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden sm:table-cell">{t(`Currency`)}</th>
                        <th className="py-2 px-3 text-right text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t(`Raw Total`)}</th>
                        <th className="py-2 px-3 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">{t(`Created By`)}</th>
                        <th className="py-2 px-3 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">{t(`Created At`)}</th>
                        <th className="py-2 px-3 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">{t(`Approved At`)}</th>
                        <th className="py-2 px-3 text-right text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">{t(`Status`)}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {recentOrders.map((o) => {
                        const creatorName = userById[o.createdBy]?.name || o.createdBy;
                        return (
                          <tr
                            key={o.id}
                            className="group cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                            onClick={() => navigate(`/sales/orders/${o.id}`)}
                          >
                            <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                              {o.orderNumber}
                            </td>
                            <td className="py-2 px-3 text-slate-500 font-mono whitespace-nowrap">
                              {o.orderDate || o.createdAt.split('T')[0]}
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]" title={o.customerName}>
                              {o.customerName}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap hidden sm:table-cell">
                              {o.currency}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                              {formatCurrency(o.grandTotalDoc)}
                            </td>
                            <td className="py-2 px-3 text-slate-650 dark:text-slate-300 truncate max-w-[100px] hidden md:table-cell" title={creatorName}>
                              {creatorName}
                            </td>
                            <td className="py-2 px-3 text-slate-400 font-mono text-[9px] whitespace-nowrap hidden lg:table-cell">
                              {formatDateTime(o.createdAt)}
                            </td>
                            <td className="py-2 px-3 text-slate-400 font-mono text-[9px] whitespace-nowrap hidden lg:table-cell">
                              {o.confirmedAt ? formatDateTime(o.confirmedAt) : '—'}
                            </td>
                            <td className="py-2 px-3 text-right whitespace-nowrap">
                              <StatusBadge status={o.status} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}

          {/* RECENT SALES INVOICES (INV) */}
          <Card className="p-3.5 shadow-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="mb-2.5 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Recent Sales Invoices (INV)
              </h3>
              <button
                type="button"
                onClick={() => navigate('/sales/invoices')}
                className="text-[10px] font-bold text-indigo-650 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Postings Register
              </button>
            </div>
            <div className="border-b border-slate-100 dark:border-slate-700/60 mb-2.5" />
            {loadingInvoices && recentInvoices.length === 0 ? (
              <div className="h-[150px] flex flex-col justify-between border border-slate-300 dark:border-slate-700 p-3 rounded-lg">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-6 rounded" />)}
              </div>
            ) : recentInvoices.length === 0 ? (
              <div className="h-[150px] flex items-center justify-center text-center text-xs text-slate-400 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50/20">
                No recent invoices.
              </div>
            ) : (
              <div className="h-[150px] overflow-auto border border-slate-300 dark:border-slate-700 rounded-lg custom-scroll">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead className="sticky top-0 z-10">
                    <tr className="border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900 shadow-sm">
                      <th className="py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t(`Invoice ID`)}</th>
                      <th className="py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t(`Date`)}</th>
                      <th className="py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t(`Debtor Customer`)}</th>
                      <th className="py-2 px-3 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden sm:table-cell">{t(`Currency`)}</th>
                      <th className="py-2 px-3 text-right text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t(`Raw Total`)}</th>
                      <th className="py-2 px-3 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden md:table-cell">{t(`Created By`)}</th>
                      <th className="py-2 px-3 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">{t(`Created At`)}</th>
                      <th className="py-2 px-3 text-left text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 hidden lg:table-cell">{t(`Approved At`)}</th>
                      <th className="py-2 px-3 text-right text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 font-sans">{t(`Status`)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {recentInvoices.map((i) => {
                      const creatorName = userById[i.createdBy]?.name || i.createdBy;
                      return (
                        <tr
                          key={i.id}
                          className="group cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                          onClick={() => navigate(`/sales/invoices/${i.id}`)}
                        >
                          <td className="py-2 px-3 font-mono font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {i.invoiceNumber}
                          </td>
                          <td className="py-2 px-3 text-slate-500 font-mono whitespace-nowrap">
                            {i.invoiceDate || i.createdAt.split('T')[0]}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]" title={i.customerName}>
                            {i.customerName}
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-500 whitespace-nowrap hidden sm:table-cell">
                            {i.currency}
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-bold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                            {formatCurrency(i.grandTotalDoc)}
                          </td>
                          <td className="py-2 px-3 text-slate-650 dark:text-slate-300 truncate max-w-[100px] hidden md:table-cell" title={creatorName}>
                            {creatorName}
                          </td>
                          <td className="py-2 px-3 text-slate-400 font-mono text-[9px] whitespace-nowrap hidden lg:table-cell">
                            {formatDateTime(i.createdAt)}
                          </td>
                          <td className="py-2 px-3 text-slate-400 font-mono text-[9px] whitespace-nowrap hidden lg:table-cell">
                            {i.postedAt ? formatDateTime(i.postedAt) : '—'}
                          </td>
                          <td className="py-2 px-3 text-right whitespace-nowrap">
                            <StatusBadge status={i.status} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Top Client Accounts */}
          <Card className="p-3.5 shadow-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2.5">
              Top Client Accounts
            </h3>
            <div className="border-b border-slate-100 dark:border-slate-700/60 mb-2.5" />
            {loadingInvoices && topCustomers.length === 0 ? (
              <div className="h-[120px] flex flex-col justify-between border border-slate-300 dark:border-slate-700 p-3 rounded-lg">
                {[1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}
              </div>
            ) : topCustomers.length === 0 ? (
              <div className="h-[120px] flex items-center justify-center text-center text-xs text-slate-400 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50/20">
                No client data available.
              </div>
            ) : (
              <div className="h-[120px] overflow-auto pr-1 custom-scroll space-y-2">
                {topCustomers.map((c) => {
                  const { primary, secondary } = parseCustomerName(c.name);
                  const pct = Math.round((c.total / maxCustomerTotal) * 100);
                  return (
                    <div
                      key={c.name}
                      className="group relative overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700 bg-white p-2.5 transition-all hover:border-slate-400 hover:shadow-sm dark:bg-slate-800"
                    >
                      <div className="flex items-start justify-between mb-1">
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-100 font-cairo">
                            {primary}
                          </div>
                          {secondary && (
                            <div className="mt-0.5 truncate text-[9px] font-medium text-slate-400 dark:text-slate-500">
                              {secondary}
                            </div>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-100 font-mono">
                            {formatCurrency(c.total)} <span className="text-[9px] font-normal text-slate-400">{companyCurrency}</span>
                          </div>
                          <div className="text-[9px] font-bold tracking-wider text-slate-400 uppercase">
                            BALANCE
                          </div>
                        </div>
                      </div>
                      {/* Bottom edge thin progress bar */}
                      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-slate-100 dark:bg-slate-750">
                        <div
                          className="h-full bg-slate-800 dark:bg-slate-300 transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Sidebar */}
        <div className="space-y-3.5">

          {/* Quick Links */}
          <Card className="p-3.5 shadow-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Quick Navigation
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <QuickLinkTile
                icon={<FileText size={13} />}
                label="Invoices"
                onClick={() => navigate('/sales/invoices')}
              />
              <QuickLinkTile
                icon={<ShoppingCart size={13} />}
                label="Orders"
                onClick={() => navigate('/sales/orders')}
              />
              <QuickLinkTile
                icon={<Truck size={13} />}
                label="Delivery Notes"
                onClick={() => navigate('/sales/delivery-notes')}
              />
              <QuickLinkTile
                icon={<ClipboardList size={13} />}
                label="Quotations"
                onClick={() => navigate('/sales/quotes')}
              />
              <QuickLinkTile
                icon={<RotateCcw size={13} />}
                label="Returns"
                onClick={() => navigate('/sales/returns')}
              />
              <button
                type="button"
                onClick={() => navigate('/sales/settings')}
                className="group flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-left transition-all hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-750"
              >
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 group-hover:bg-indigo-50 group-hover:text-indigo-655 dark:bg-slate-700 dark:text-slate-400">
                  <Settings size={13} />
                </div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100">{t(`Settings`)}</div>
              </button>
            </div>
          </Card>

          {/* Recent Activity Log */}
          <Card className="p-3.5 shadow-sm border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Recent Activity
              </h3>
              <button
                type="button"
                onClick={() => {
                  void fetchInvoices(true);
                  if (showOperationalDocuments) {
                    void fetchOrders(true);
                    void fetchDNs(true);
                  }
                  void fetchReturns(true);
                  setLastRefreshed(new Date());
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                title="Refresh activity"
              >
                <RefreshCw size={11} className={loadingInvoices || loadingOrders ? 'animate-spin' : ''} />
              </button>
            </div>
            <div className="border-b border-slate-100 dark:border-slate-700/60 mb-3" />
            {loadingInvoices && recentActivity.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded" />)}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-400">{t(`No activity yet.`)}</div>
            ) : (
              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {recentActivity.map((item) => {
                  const creatorName = userById[item.createdBy]?.name || item.createdBy;
                  return (
                    <div
                      key={item.id}
                      onClick={() => navigate(item.route)}
                      className="group flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-100 dark:border-slate-700/60 bg-slate-50/30 p-2 transition-all hover:bg-slate-50 dark:bg-slate-800/20 dark:hover:bg-slate-700/40"
                    >
                      <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded bg-white text-slate-500 shadow-sm dark:bg-slate-750 dark:text-slate-400">
                        {item.type === 'Invoice' ? <FileText size={12} /> :
                         item.type === 'Order' ? <ShoppingCart size={12} /> :
                         item.type === 'Return' ? <RotateCcw size={12} /> : <Truck size={12} />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 font-mono">
                            {item.number}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {item.date}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-slate-500 dark:text-slate-400">
                          <span className="font-semibold text-slate-700 dark:text-slate-350">{item.customer}</span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-1 text-[9px] text-slate-400">
                          <span className="truncate max-w-[120px]" title={creatorName}>
                            {t(`By`)} {creatorName}
                          </span>
                          <span className="font-semibold text-slate-650 dark:text-slate-300 font-mono">
                            {item.amount !== null ? `${formatCurrency(item.amount)} ${item.currency}` : '—'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* ── Footer stamp ── */}
      <div className="flex items-center justify-center gap-1.5 pb-2 text-[10px] text-slate-300 dark:text-slate-655">
        <Layers size={10} />
        Sales module — cached data refreshes every 60 s per section
      </div>
    </div>
  );
};

export default SalesHomePage;
