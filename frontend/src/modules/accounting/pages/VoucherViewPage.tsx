import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { accountingApi, VoucherDetailDTO } from '../../../api/accountingApi';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { useVoucherActions } from '../../../hooks/useVoucherActions';
import { useAuth } from '../../../hooks/useAuth';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { formatCompanyDate } from '../../../utils/dateUtils';
import { errorHandler } from '../../../services/errorHandler';
import { getAction, getPrimaryActions, VoucherActionType } from '../utils/voucherActions';
import {
  ArrowLeft,
  FileText,
  CalendarDays,
  Banknote,
  User,
  Hash,
  Clock,
  ShieldCheck,
  Lock,
  XCircle,
  CheckCircle2,
  AlertCircle,
  Printer,
  RefreshCw,
  Check,
  Ban,
  BookOpen,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

/* ── Helpers ────────────────────────────────────────────── */

const fmt = (n: number | undefined | null) =>
  n != null && n !== 0
    ? n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PREFIXED_UUID_PATTERN = /^([A-Za-z]+)-([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const formatShortRef = (value: string, prefix: string) => `${prefix}-${value.slice(0, 8).toUpperCase()}`;

const normalizeReferenceLabel = (value: string | undefined | null, fallbackPrefix: string) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '—';

  const prefixedUuidMatch = trimmed.match(PREFIXED_UUID_PATTERN);
  if (prefixedUuidMatch) {
    return `${prefixedUuidMatch[1].toUpperCase()}-${prefixedUuidMatch[2].toUpperCase()}`;
  }

  if (UUID_PATTERN.test(trimmed)) {
    return formatShortRef(trimmed, fallbackPrefix);
  }

  return trimmed;
};

const shortenOpaqueValue = (value: string | undefined | null) => {
  const trimmed = (value || '').trim();
  if (!trimmed) return '—';
  if (trimmed.includes('@') || trimmed.includes(' ')) return trimmed;
  if (trimmed.length <= 18) return trimmed;
  return `${trimmed.slice(0, 12)}...`;
};

const isOpeningStockVoucher = (voucher: any) =>
  voucher?.metadata?.sourceType === 'OPENING_STOCK_DOCUMENT' ||
  /^OS-/i.test(voucher?.voucherNo || '') ||
  /^Opening Stock Document\b/i.test(voucher?.description || '');

const normalizeVoucherLabel = (voucher: any) => {
  const rawValue = voucher?.voucherNo || voucher?.id;
  return normalizeReferenceLabel(rawValue, isOpeningStockVoucher(voucher) ? 'OS' : 'VCH');
};

const normalizeReferenceValue = (voucher: any) => {
  const fallbackPrefix = isOpeningStockVoucher(voucher) ? 'OSD' : 'REF';
  return normalizeReferenceLabel(voucher?.reference, fallbackPrefix);
};

const normalizeDescription = (voucher: any) => {
  const description = (voucher?.description || '').trim();
  if (!description) return '';

  return description.replace(
    /\bOpening Stock Document ([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/i,
    (_match: string, documentId: string) => `Opening Stock Document ${formatShortRef(documentId, 'OSD')}`
  );
};

const NAVIGATION_PAGE_SIZE = 200;

const normalizeVoucherListResponse = (response: any, page: number, pageSize: number) => {
  const items = Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : [];
  const pagination = Array.isArray(response)
    ? { page: 1, pageSize: items.length, totalPages: 1 }
    : response?.pagination || { page, pageSize, totalPages: items.length < pageSize ? page : page + 1 };

  return { items, pagination };
};

const toNavigationItem = (item: any, page: number) => ({
  id: item.id,
  page,
  label: normalizeReferenceLabel(item.voucherNo || item.id, 'VCH'),
});

const resolveActorLabel = (
  displayName: string | undefined | null,
  email: string | undefined | null,
  actorId: string | undefined | null
) => {
  const friendlyName = (displayName || '').trim();
  if (friendlyName) return friendlyName;
  const friendlyEmail = (email || '').trim();
  if (friendlyEmail) return friendlyEmail;
  return shortenOpaqueValue(actorId);
};

const statusConfig: Record<string, { labelKey: string; defaultLabel: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  draft:     { labelKey: 'voucherView.status.draft', defaultLabel: 'Draft', bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-200', icon: <FileText className="w-3.5 h-3.5" /> },
  pending:   { labelKey: 'voucherView.status.pending', defaultLabel: 'Pending', bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200', icon: <Clock className="w-3.5 h-3.5" /> },
  approved:  { labelKey: 'voucherView.status.approved', defaultLabel: 'Approved', bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  posted:    { labelKey: 'voucherView.status.posted', defaultLabel: 'Posted', bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200', icon: <ShieldCheck className="w-3.5 h-3.5" /> },
  locked:    { labelKey: 'voucherView.status.locked', defaultLabel: 'Locked', bg: 'bg-indigo-50',   text: 'text-indigo-700',  border: 'border-indigo-200', icon: <Lock className="w-3.5 h-3.5" /> },
  rejected:  { labelKey: 'voucherView.status.rejected', defaultLabel: 'Rejected', bg: 'bg-red-50',      text: 'text-red-600',     border: 'border-red-200', icon: <XCircle className="w-3.5 h-3.5" /> },
  cancelled: { labelKey: 'voucherView.status.cancelled', defaultLabel: 'Cancelled', bg: 'bg-red-50/60',   text: 'text-red-500',     border: 'border-red-100', icon: <XCircle className="w-3.5 h-3.5" /> },
};

/* ── Component ──────────────────────────────────────────── */

const VoucherViewPage: React.FC = () => {
  const { t, i18n } = useTranslation('accounting');
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { settings } = useCompanySettings();
  const { user } = useAuth();
  const { permissions, isSuperAdmin, permissionsLoaded } = useCompanyAccess();
  const { executeAction } = useVoucherActions();

  const [voucher, setVoucher] = useState<VoucherDetailDTO | null>(null);
  const [accountMap, setAccountMap] = useState<Map<string, { code: string; name: string }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningAction, setRunningAction] = useState<VoucherActionType | null>(null);
  const [recordNavigation, setRecordNavigation] = useState<{
    previous: { id: string; page: number; label: string } | null;
    next: { id: string; page: number; label: string } | null;
    loading: boolean;
  }>({ previous: null, next: null, loading: false });
  const tr = useCallback(
    (key: string, defaultValue: string, options?: Record<string, unknown>) =>
      t(key, { defaultValue, ...(options || {}) }),
    [t]
  );
  const isRtl = i18n.dir() === 'rtl';

  const loadVoucher = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      // Fetch voucher and accounts in parallel
      const [voucherData, accounts] = await Promise.all([
        accountingApi.getVoucher(id),
        accountingApi.getAccounts().catch(() => []),
      ]);
      setVoucher(voucherData);

      // Build account lookup map
      const map = new Map<string, { code: string; name: string }>();
      (Array.isArray(accounts) ? accounts : (accounts as any)?.data || []).forEach((acc: any) => {
        map.set(acc.id, {
          code: acc.userCode || acc.systemCode || acc.code || acc.accountCode || '',
          name: acc.name || acc.accountName || ''
        });
      });
      setAccountMap(map);
    } catch (err: any) {
      setError(err?.message || tr('voucherView.messages.loadFailed', 'Failed to load voucher.'));
      errorHandler.showError(err);
    } finally {
      setLoading(false);
    }
  }, [id, tr]);

  useEffect(() => {
    loadVoucher();
  }, [loadVoucher]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    const loadNavigation = async () => {
      setRecordNavigation((prev) => ({ ...prev, loading: true }));
      try {
        let page = 1;
        let previous: { id: string; page: number; label: string } | null = null;
        let next: { id: string; page: number; label: string } | null = null;
        let previousPageItems: any[] = [];

        while (!cancelled) {
          const response = await accountingApi.listVouchers({
            page,
            pageSize: NAVIGATION_PAGE_SIZE,
            sort: 'date_desc',
          });
          const { items, pagination } = normalizeVoucherListResponse(response, page, NAVIGATION_PAGE_SIZE);
          const currentIndex = items.findIndex((item: any) => item.id === id);

          if (currentIndex >= 0) {
            previous = currentIndex > 0
              ? toNavigationItem(items[currentIndex - 1], page)
              : previousPageItems.length > 0
                ? toNavigationItem(previousPageItems[previousPageItems.length - 1], page - 1)
                : null;

            if (currentIndex < items.length - 1) {
              next = toNavigationItem(items[currentIndex + 1], page);
            } else if (page < pagination.totalPages) {
              const nextResponse = await accountingApi.listVouchers({
                page: page + 1,
                pageSize: NAVIGATION_PAGE_SIZE,
                sort: 'date_desc',
              });
              const nextItems = normalizeVoucherListResponse(nextResponse, page + 1, NAVIGATION_PAGE_SIZE).items;
              if (nextItems[0]) next = toNavigationItem(nextItems[0], page + 1);
            }

            break;
          }

          if (page >= pagination.totalPages || items.length === 0) break;
          previousPageItems = items;
          page += 1;
        }

        if (!cancelled) setRecordNavigation({ previous, next, loading: false });
      } catch {
        if (!cancelled) setRecordNavigation({ previous: null, next: null, loading: false });
      }
    };

    loadNavigation();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const buildVoucherRoute = useCallback(
    (target: { id: string; page: number }, view: 'view' | 'ledger' = 'view') => {
      const params = new URLSearchParams();
      params.set('nav', 'all-vouchers');
      params.set('page', String(target.page));
      params.set('pageSize', String(NAVIGATION_PAGE_SIZE));
      return `/accounting/vouchers/${target.id}/${view}?${params.toString()}`;
    },
    []
  );

  const hasPermission = useCallback((permission: string) => {
    if (!permissionsLoaded) return true;
    return (
      isSuperAdmin ||
      permissions.includes('*') ||
      permissions.some((p) => p === permission || permission.startsWith(`${p}.`))
    );
  }, [isSuperAdmin, permissions, permissionsLoaded]);

  const isActionPermitted = useCallback((actionType: VoucherActionType) => {
    switch (actionType) {
      case 'APPROVE':
        return hasPermission('accounting.vouchers.approve') || hasPermission('accounting.vouchers.edit');
      case 'REJECT':
        return hasPermission('accounting.vouchers.approve');
      case 'CONFIRM_CUSTODY':
      case 'PRINT':
        return hasPermission('accounting.vouchers.view');
      case 'POST':
        return hasPermission('accounting.vouchers.post');
      default:
        return true;
    }
  }, [hasPermission]);

  const primaryWorkflowActions = useMemo(() => {
    if (!voucher) return [];
    const actionCtx = { voucher, settings, user };
    return getPrimaryActions(actionCtx)
      .filter((action) => action.type !== 'PRINT')
      .filter((action) => isActionPermitted(action.type));
  }, [voucher, settings, user, isActionPermitted]);

  const rejectAction = useMemo(() => {
    if (!voucher) return null;
    const action = getAction({ voucher, settings, user }, 'REJECT');
    if (!action || action.isHidden || !isActionPermitted(action.type)) return null;
    return action;
  }, [voucher, settings, user, isActionPermitted]);

  const handleWorkflowAction = useCallback(async (actionType: VoucherActionType) => {
    if (!voucher?.id && !id) return;
    const voucherId = voucher?.id || id!;

    let extra: any;
    if (actionType === 'REJECT') {
      const reason = window.prompt(tr('voucherView.messages.rejectionReasonPrompt', 'Enter rejection reason'));
      if (reason === null) return;
      extra = { reason: reason.trim() || undefined };
    }

    try {
      setRunningAction(actionType);
      await executeAction(actionType, voucherId, extra);
      await loadVoucher();
    } catch {
      // Error feedback is already handled by useVoucherActions -> errorHandler
    } finally {
      setRunningAction(null);
    }
  }, [voucher?.id, id, executeAction, loadVoucher]);

  /* ── Loading ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-slate-300 animate-spin mx-auto mb-4" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{tr('voucherView.loading', 'Loading voucher')}</p>
        </div>
      </div>
    );
  }

  /* ── Error ───────────────────────────────────────────── */
  if (error || !voucher) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto" />
          <p className="text-sm text-red-600 font-medium">{error || tr('voucherView.messages.notFound', 'Voucher not found.')}</p>
          <button onClick={() => navigate(-1)} className="text-xs text-indigo-600 hover:underline font-semibold">
            {tr('voucherView.actions.goBack', 'Go back')}
          </button>
        </div>
      </div>
    );
  }

  /* ── Derived values ──────────────────────────────────── */
  const rawLines: any[] = voucher.lines || [];

  // Normalize lines — backend uses { side, amount } pattern
  const lines = rawLines.map((line: any) => {
    const acc = accountMap.get(line.accountId);
    const debit = line.side === 'Debit'
      ? (line.amount || line.debitAmount || line.debit || 0)
      : (line.debitAmount || line.debit || 0);
    const credit = line.side === 'Credit'
      ? (line.amount || line.creditAmount || line.credit || 0)
      : (line.creditAmount || line.credit || 0);

    return {
      accountCode: acc?.code || line.accountCode || '',
      accountName: acc?.name || line.accountName || '',
      accountId: line.accountId,
      description: line.notes || line.description || '',
      debit,
      credit,
      costCenterId: line.costCenterId || '',
      currency: line.currency || voucher.currency || '',
    };
  });

  const totalDebit = lines.reduce((s: number, l: any) => s + (l.debit || 0), 0);
  const totalCredit = lines.reduce((s: number, l: any) => s + (l.credit || 0), 0);

  const displayStatus = voucher.postedAt ? 'posted' : (voucher.status || 'draft');
  const sc = statusConfig[displayStatus] || statusConfig.draft;
  const displayVoucherNo = normalizeVoucherLabel(voucher);
  const displayReference = normalizeReferenceValue(voucher);
  const displayDescription = normalizeDescription(voucher);
  const displayCreatedBy = resolveActorLabel(voucher.createdByName, voucher.createdByEmail, voucher.createdBy);
  const displayPostedBy = resolveActorLabel(voucher.postedByName, voucher.postedByEmail, voucher.postedBy);
  const displayApprovedBy = resolveActorLabel(voucher.approvedByName, voucher.approvedByEmail, voucher.approvedBy);

  const typeName = (voucher.type || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());

  const formattedDate = formatCompanyDate(voucher.date, settings);
  const PreviousIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-5 print:space-y-3 print:px-0">

      {/* ── Top Bar ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          {tr('voucherView.actions.back', 'Back')}
        </button>

        <div className="ms-auto flex flex-wrap items-center justify-end gap-2">
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            className="inline-flex h-9 min-w-[260px] items-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
            aria-label={tr('voucherNavigation.ariaLabel', 'Record navigation')}
          >
            <button
              type="button"
              disabled={!recordNavigation.previous || recordNavigation.loading}
              onClick={() => recordNavigation.previous && navigate(buildVoucherRoute(recordNavigation.previous, 'view'))}
              title={recordNavigation.previous?.label || tr('voucherNavigation.noPrevious', 'No previous voucher')}
              className="flex h-full w-9 shrink-0 cursor-pointer items-center justify-center border-e border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PreviousIcon className="h-4 w-4" />
              <span className="sr-only">{tr('voucherNavigation.previous', 'Previous')}</span>
            </button>
            <div className="min-w-0 flex-1 px-3 text-center">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                {tr('voucherNavigation.currentVoucher', 'Current voucher')}
              </div>
              <div className="truncate font-mono text-xs font-bold text-slate-800" title={displayVoucherNo}>
                {displayVoucherNo}
              </div>
            </div>
            <button
              type="button"
              disabled={!recordNavigation.next || recordNavigation.loading}
              onClick={() => recordNavigation.next && navigate(buildVoucherRoute(recordNavigation.next, 'view'))}
              title={recordNavigation.next?.label || tr('voucherNavigation.noNext', 'No next voucher')}
              className="flex h-full w-9 shrink-0 cursor-pointer items-center justify-center border-s border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <NextIcon className="h-4 w-4" />
              <span className="sr-only">{tr('voucherNavigation.next', 'Next')}</span>
            </button>
          </div>

          {primaryWorkflowActions.map((action) => {
            const isRunning = runningAction === action.type;
            const commonClass = 'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors';

            let actionClass = 'text-slate-700 border border-slate-200 hover:bg-slate-50';
            if (action.type === 'APPROVE' || action.type === 'POST') {
              actionClass = 'text-white bg-emerald-600 hover:bg-emerald-700 border border-emerald-700';
            } else if (action.type === 'CONFIRM_CUSTODY') {
              actionClass = 'text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-700';
            }

            return (
              <button
                key={action.type}
                onClick={() => handleWorkflowAction(action.type)}
                disabled={!action.isEnabled || !!runningAction}
                title={action.tooltip || action.label}
                className={`${commonClass} ${actionClass} disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isRunning ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : action.type === 'CONFIRM_CUSTODY' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                {action.label}
              </button>
            );
          })}

          {rejectAction && (
            <button
              onClick={() => handleWorkflowAction('REJECT')}
              disabled={!rejectAction.isEnabled || !!runningAction}
              title={rejectAction.tooltip || rejectAction.label}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-red-600 border border-red-700 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
              {runningAction === 'REJECT' ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Ban className="w-3.5 h-3.5" />
              )}
              {tr('voucherView.actions.reject', 'Reject')}
            </button>
          )}

          <button
            onClick={() => navigate(buildVoucherRoute({ id: voucher.id || id!, page: 1 }, 'ledger'))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            {tr('voucherView.actions.ledgerImpact', 'Ledger impact')}
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            {tr('voucherView.actions.print', 'Print')}
          </button>
        </div>
      </div>

      {/* ── Header Card ───────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-black/10">
        {/* Title + Status */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center print:hidden">
              <FileText className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-800">
                {displayVoucherNo}
              </h1>
              <p className="text-xs text-slate-400 font-medium">{typeName}</p>
            </div>
          </div>

          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
            {sc.icon}
            {tr(sc.labelKey, sc.defaultLabel)}
          </span>
        </div>

        {/* Meta Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100">
          <MetaCell icon={<CalendarDays className="w-4 h-4 text-slate-400" />} label={tr('voucherView.meta.date', 'Date')} value={formattedDate} />
          <MetaCell icon={<Banknote className="w-4 h-4 text-slate-400" />} label={tr('voucherView.meta.currency', 'Currency')} value={voucher.currency || settings?.baseCurrency || '—'} />
          <MetaCell icon={<User className="w-4 h-4 text-slate-400" />} label={tr('voucherView.meta.createdBy', 'Created by')} value={displayCreatedBy} />
          <MetaCell icon={<Hash className="w-4 h-4 text-slate-400" />} label={tr('voucherView.meta.reference', 'Reference')} value={displayReference} />
        </div>

        {/* Description */}
        {displayDescription && (
          <div className="px-6 py-3 bg-slate-50/50 border-t border-slate-100">
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-0.5">{tr('voucherView.meta.description', 'Description')}</p>
            <p className="text-sm text-slate-700">{displayDescription}</p>
          </div>
        )}

        {/* Exchange rate info */}
        {voucher.currency && voucher.baseCurrency && voucher.currency !== voucher.baseCurrency && (
          <div className="px-6 py-2.5 bg-amber-50/60 border-t border-amber-100/50 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs text-amber-700 font-medium">
              {tr('voucherView.meta.exchangeRate', '1 {{from}} = {{rate}} {{to}}', { from: voucher.currency, rate: voucher.exchangeRate, to: voucher.baseCurrency })}
            </p>
          </div>
        )}
      </div>

      {/* ── Lines Table ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-black/10">
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/70">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">
            {tr('voucherView.lineItems.title', 'Line items')}
            <span className="ml-2 text-slate-400 font-bold">({lines.length})</span>
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-10">#</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-28">{tr('voucherView.lineItems.code', 'Code')}</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">{tr('voucherView.lineItems.account', 'Account')}</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">{tr('voucherView.lineItems.notes', 'Notes')}</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-32">{tr('voucherView.lineItems.debit', 'Debit')}</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400 w-32">{tr('voucherView.lineItems.credit', 'Credit')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lines.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-10 text-sm text-slate-400">{tr('voucherView.lineItems.empty', 'No line items.')}</td>
                </tr>
              ) : (
                lines.map((line: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-slate-400 font-mono">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {line.accountCode || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-700">
                      {line.accountName || line.accountId || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">
                      {line.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">
                      {line.debit > 0 ? (
                        <span className="text-slate-800 font-semibold">{fmt(line.debit)}</span>
                      ) : (
                        <span className="text-slate-200">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm tabular-nums">
                      {line.credit > 0 ? (
                        <span className="text-slate-800 font-semibold">{fmt(line.credit)}</span>
                      ) : (
                        <span className="text-slate-200">—</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Totals Footer */}
            {lines.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50/80">
                  <td colSpan={4} className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-widest text-slate-500">
                    {tr('voucherView.lineItems.totals', 'Totals {{currency}}', { currency: voucher.currency || '' })}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-slate-800 tabular-nums">
                    {fmt(totalDebit)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm font-bold text-slate-800 tabular-nums">
                    {fmt(totalCredit)}
                  </td>
                </tr>
                {Math.abs(totalDebit - totalCredit) > 0.005 && (
                  <tr className="bg-red-50/80">
                    <td colSpan={4} className="px-4 py-2 text-right text-[11px] font-black text-red-600 uppercase tracking-widest">
                      {tr('voucherView.lineItems.outOfBalance', 'Out of balance')}
                    </td>
                    <td colSpan={2} className="px-4 py-2 text-right font-mono text-sm font-bold text-red-600 tabular-nums">
                      {fmt(Math.abs(totalDebit - totalCredit))}
                    </td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* ── Audit Trail ────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden print:shadow-none print:border-black/10">
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/70">
          <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-500">{tr('voucherView.audit.title', 'Audit trail')}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-slate-100">
          <MetaCell label={tr('voucherView.audit.created', 'Created')} value={formatCompanyDate(voucher.createdAt, settings)} />
          <MetaCell label={tr('voucherView.audit.createdBy', 'Created by')} value={displayCreatedBy} />
          <MetaCell label={tr('voucherView.audit.posted', 'Posted')} value={voucher.postedAt ? formatCompanyDate(voucher.postedAt, settings) : '—'} />
          <MetaCell label={tr('voucherView.audit.postedBy', 'Posted by')} value={displayPostedBy} />
          {voucher.approvedAt && (
            <>
              <MetaCell label={tr('voucherView.audit.approved', 'Approved')} value={formatCompanyDate(voucher.approvedAt, settings)} />
              <MetaCell label={tr('voucherView.audit.approvedBy', 'Approved by')} value={displayApprovedBy} />
            </>
          )}
          {voucher.rejectedAt && (
            <>
              <MetaCell label={tr('voucherView.audit.rejected', 'Rejected')} value={formatCompanyDate(voucher.rejectedAt, settings)} />
              <MetaCell label={tr('voucherView.audit.rejectionReason', 'Rejection reason')} value={voucher.rejectionReason || '—'} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ── Sub-components ─────────────────────────────────────── */

const MetaCell: React.FC<{ icon?: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="bg-white px-5 py-3.5">
    <div className="flex items-center gap-1.5 mb-1">
      {icon}
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
    </div>
    <p className="text-sm font-semibold text-slate-700 truncate" title={value}>{value}</p>
  </div>
);

export default VoucherViewPage;
