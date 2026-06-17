import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  FileText,
  RefreshCw,
} from 'lucide-react';
import { accountingApi, GeneralLedgerEntry, VoucherDetailDTO } from '../../../api/accountingApi';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { formatCompanyDate } from '../../../utils/dateUtils';

const fmt = (n: number | undefined | null) =>
  Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const NAVIGATION_PAGE_SIZE = 200;

const normalizeVoucherListResponse = (response: any, page: number, pageSize: number) => {
  const items = Array.isArray(response) ? response : Array.isArray(response?.items) ? response.items : [];
  const pagination = Array.isArray(response)
    ? { page: 1, pageSize: items.length, totalPages: 1 }
    : response?.pagination || { page, pageSize, totalPages: items.length < pageSize ? page : page + 1 };

  return { items, pagination };
};

const normalizeVoucherLabel = (item: any) => {
  const value = String(item?.voucherNo || item?.id || '').trim();
  if (!value) return '-';
  return value.length > 22 ? `${value.slice(0, 18)}...` : value;
};

const toNavigationItem = (item: any, page: number) => ({
  id: item.id,
  page,
  label: normalizeVoucherLabel(item),
});

const VoucherLedgerImpactPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation('accounting');
  const { settings } = useCompanySettings();

  const [voucher, setVoucher] = useState<VoucherDetailDTO | null>(null);
  const [entries, setEntries] = useState<GeneralLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [voucherData, ledgerImpact] = await Promise.all([
        accountingApi.getVoucher(id),
        accountingApi.getVoucherLedgerImpact(id),
      ]);
      setVoucher(voucherData);
      setEntries(Array.isArray(ledgerImpact?.data) ? ledgerImpact.data : []);
    } catch (err: any) {
      setError(err?.message || tr('voucherLedgerImpact.loadFailed', 'Failed to load ledger impact.'));
    } finally {
      setLoading(false);
    }
  }, [id, tr]);

  useEffect(() => {
    load();
  }, [load]);

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
    (target: { id: string; page: number }, view: 'view' | 'ledger' = 'ledger') => {
      const params = new URLSearchParams();
      params.set('nav', 'all-vouchers');
      params.set('page', String(target.page));
      params.set('pageSize', String(NAVIGATION_PAGE_SIZE));
      return `/accounting/vouchers/${target.id}/${view}?${params.toString()}`;
    },
    []
  );

  const totals = useMemo(
    () =>
      entries.reduce(
        (acc, entry) => {
          acc.debit += entry.debit || 0;
          acc.credit += entry.credit || 0;
          acc.baseAmount += Math.abs(entry.baseAmount || 0);
          return acc;
        },
        { debit: 0, credit: 0, baseAmount: 0 }
      ),
    [entries]
  );

  const voucherNo = voucher?.voucherNo || (voucher as any)?.voucherNumber || voucher?.id || id || '';
  const voucherStatus = String(voucher?.status || '').toLowerCase();
  const isPosted = !!voucher?.postedAt || voucherStatus === 'posted';
  const baseCurrency = voucher?.baseCurrency || settings?.baseCurrency || '';
  const PreviousIcon = isRtl ? ChevronRight : ChevronLeft;
  const NextIcon = isRtl ? ChevronLeft : ChevronRight;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto mb-4 h-8 w-8 animate-spin text-slate-300" />
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
            {tr('voucherLedgerImpact.loading', 'Loading ledger impact')}
          </p>
        </div>
      </div>
    );
  }

  if (error || !voucher) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
          <p className="text-sm font-medium text-red-600">
            {error || tr('voucherLedgerImpact.notFound', 'Voucher not found.')}
          </p>
          <button onClick={() => navigate(-1)} className="text-xs font-semibold text-indigo-600 hover:underline">
            {tr('voucherLedgerImpact.goBack', 'Go back')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-7xl flex-col gap-4 px-4 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {tr('voucherLedgerImpact.back', 'Back')}
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
              onClick={() => recordNavigation.previous && navigate(buildVoucherRoute(recordNavigation.previous, 'ledger'))}
              title={recordNavigation.previous?.label || tr('voucherNavigation.noPrevious', 'No previous voucher')}
              className="flex h-full w-9 shrink-0 cursor-pointer items-center justify-center border-e border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <PreviousIcon className="h-4 w-4" />
              <span className="sr-only">{tr('voucherNavigation.previous', 'Previous')}</span>
            </button>
            <div className="min-w-0 flex-1 px-3 text-center">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                {tr('voucherNavigation.currentLedger', 'Current ledger')}
              </div>
              <div className="truncate font-mono text-xs font-bold text-slate-800" title={voucherNo}>
                {voucherNo}
              </div>
            </div>
            <button
              type="button"
              disabled={!recordNavigation.next || recordNavigation.loading}
              onClick={() => recordNavigation.next && navigate(buildVoucherRoute(recordNavigation.next, 'ledger'))}
              title={recordNavigation.next?.label || tr('voucherNavigation.noNext', 'No next voucher')}
              className="flex h-full w-9 shrink-0 cursor-pointer items-center justify-center border-s border-slate-200 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <NextIcon className="h-4 w-4" />
              <span className="sr-only">{tr('voucherNavigation.next', 'Next')}</span>
            </button>
          </div>

          <Link
            to={buildVoucherRoute({ id: voucher.id, page: 1 }, 'view')}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <FileText className="h-4 w-4" />
            {tr('voucherLedgerImpact.viewVoucher', 'View voucher')}
          </Link>
        </div>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 px-6 py-5">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">
                {tr('voucherLedgerImpact.title', 'Ledger Impact')}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                {tr('voucherLedgerImpact.subtitle', 'Posted ledger entries created by voucher {{voucherNo}}.', { voucherNo })}
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {tr('voucherLedgerImpact.readOnly', 'Read only')}
          </span>
        </div>

        <div className="grid grid-cols-2 border-b border-slate-100 md:grid-cols-5">
          <Meta label={tr('voucherLedgerImpact.meta.voucher', 'Voucher')} value={voucherNo} />
          <Meta label={tr('voucherLedgerImpact.meta.date', 'Date')} value={formatCompanyDate(voucher.date, settings)} />
          <Meta label={tr('voucherLedgerImpact.meta.status', 'Status')} value={voucher.status || '-'} />
          <Meta label={tr('voucherLedgerImpact.meta.currency', 'Currency')} value={voucher.currency || baseCurrency || '-'} />
          <Meta label={tr('voucherLedgerImpact.meta.lines', 'Ledger lines')} value={String(entries.length)} />
        </div>

        <div className="grid grid-cols-1 border-b border-slate-100 bg-slate-50/60 md:grid-cols-3">
          <Summary label={tr('voucherLedgerImpact.summary.totalDebit', 'Total debit')} value={fmt(totals.debit)} />
          <Summary label={tr('voucherLedgerImpact.summary.totalCredit', 'Total credit')} value={fmt(totals.credit)} />
          <Summary
            label={tr('voucherLedgerImpact.summary.balanceCheck', 'Balance check')}
            value={Math.abs(totals.debit - totals.credit) < 0.005 ? tr('voucherLedgerImpact.balanced', 'Balanced') : fmt(Math.abs(totals.debit - totals.credit))}
          />
        </div>

        {!isPosted || entries.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <BookOpen className="mx-auto mb-4 h-10 w-10 text-slate-300" />
            <h2 className="text-sm font-black uppercase tracking-widest text-slate-500">
              {tr('voucherLedgerImpact.emptyTitle', 'No ledger entries yet')}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
              {isPosted
                ? tr('voucherLedgerImpact.emptyPosted', 'This posted voucher has no ledger rows. That may indicate a data integrity issue and should be reviewed.')
                : tr('voucherLedgerImpact.emptyDraft', 'This voucher has not posted to the ledger yet. Ledger impact appears only after posting succeeds.')}
            </p>
          </div>
        ) : (
          <div className="min-h-0 overflow-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">{tr('voucherLedgerImpact.columns.date', 'Date')}</th>
                  <th className="px-4 py-3">{tr('voucherLedgerImpact.columns.account', 'Account')}</th>
                  <th className="px-4 py-3">{tr('voucherLedgerImpact.columns.description', 'Description')}</th>
                  <th className="px-4 py-3">{tr('voucherLedgerImpact.columns.costCenter', 'Cost Center')}</th>
                  <th className="px-4 py-3 text-right">{tr('voucherLedgerImpact.columns.debit', 'Debit')}</th>
                  <th className="px-4 py-3 text-right">{tr('voucherLedgerImpact.columns.credit', 'Credit')}</th>
                  <th className="px-4 py-3 text-right">{tr('voucherLedgerImpact.columns.baseAmount', 'Base Amount')}</th>
                  <th className="px-4 py-3 text-right">{tr('voucherLedgerImpact.columns.rate', 'Rate')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries.map((entry, index) => (
                  <tr key={entry.id || `${entry.accountId}-${index}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{index + 1}</td>
                    <td className="px-4 py-3 font-medium text-slate-700">{formatCompanyDate(entry.date, settings)}</td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-900">{entry.accountCode || entry.accountId}</div>
                      <div className="text-xs text-slate-500">{entry.accountName || '-'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{entry.description || '-'}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {entry.costCenterCode ? `${entry.costCenterCode} - ${entry.costCenterName || ''}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-900">{entry.debit ? fmt(entry.debit) : ''}</td>
                    <td className="px-4 py-3 text-right font-mono font-bold text-rose-700">{entry.credit ? fmt(entry.credit) : ''}</td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700">
                      {fmt(entry.baseAmount)} {entry.baseCurrency || baseCurrency}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-500">{entry.exchangeRate || 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

const Meta: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border-r border-slate-100 px-5 py-3 last:border-r-0">
    <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
    <div className="truncate text-sm font-bold text-slate-800" title={value}>{value}</div>
  </div>
);

const Summary: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="border-r border-slate-100 px-5 py-4 last:border-r-0">
    <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</div>
    <div className="font-mono text-lg font-black text-slate-900">{value}</div>
  </div>
);

export default VoucherLedgerImpactPage;
