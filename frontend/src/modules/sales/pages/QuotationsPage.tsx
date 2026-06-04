import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Plus, RefreshCw, FileText } from 'lucide-react';
import { clsx } from 'clsx';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import {
  QuoteDTO,
  QuoteStatus,
  salesOperationalApi,
} from '../../../api/salesOperationalApi';
import { formatMoney } from '../../../utils/formatMoney';

// ─── Status chip ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<QuoteStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SENT: 'bg-blue-100 text-blue-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  EXPIRED: 'bg-amber-100 text-amber-700',
  CONVERTED: 'bg-violet-100 text-violet-700',
};

const ALL_STATUSES: QuoteStatus[] = [
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'REJECTED',
  'EXPIRED',
  'CONVERTED',
];

const formatDate = (dateStr?: string): string => {
  if (!dateStr) return '—';
  return dateStr.slice(0, 10);
};

// ─── Page ─────────────────────────────────────────────────────────────────────

const QuotationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');

  const [statusFilter, setStatusFilter] = useState<QuoteStatus | 'ALL'>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('');
  const [quotes, setQuotes] = useState<QuoteDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasFilters = statusFilter !== 'ALL' || !!customerFilter;

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await salesOperationalApi.listQuotes({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        customerId: customerFilter || undefined,
        limit: 500,
      });
      setQuotes(Array.isArray(result) ? result : []);
    } catch (err: any) {
      console.error('Failed to load quotations', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('sales.quotesList.loadError')
      );
      setQuotes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, customerFilter]);

  const clearFilters = () => {
    setStatusFilter('ALL');
    setCustomerFilter('');
  };

  const headerAction = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          title={t('sales.quotesList.refresh')}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {t('sales.quotesList.refresh')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/sales/quotes/new')}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          <Plus size={14} />
          {t('sales.quotesList.newQuote')}
        </button>
      </div>
    ),
    [loading, navigate, t]
  );

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title={t('sales.quotesList.title')}
        subtitle={t('sales.quotesList.subtitle')}
        action={headerAction}
      />

      <Card className="p-4">
        <div className="grid gap-2 md:grid-cols-3">
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as QuoteStatus | 'ALL')
            }
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="ALL">{t('sales.quotesList.allStatuses')}</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`sales.quotesList.statuses.${s}`)}
              </option>
            ))}
          </select>
          <PartySelector
            role="CUSTOMER"
            value={customerFilter}
            onChange={(party) => setCustomerFilter(party?.id ?? '')}
            placeholder={t('sales.quotesList.allCustomers')}
          />
          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t('sales.quotesList.clearFilters')}
            </button>
          )}
        </div>
      </Card>

      <Card className="p-4">
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {!loading && quotes.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-12 h-12" />}
            title={t('sales.quotesList.emptyTitle')}
            description={t('sales.quotesList.emptyDescription')}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600">
                  <th className="py-2">{t('sales.quotesList.quoteNumber')}</th>
                  <th className="py-2">{t('sales.quotesList.customer')}</th>
                  <th className="py-2">{t('sales.quotesList.quoteDate')}</th>
                  <th className="py-2">{t('sales.quotesList.validUntil')}</th>
                  <th className="py-2 text-right">
                    {t('sales.quotesList.grandTotal')}
                  </th>
                  <th className="py-2">{t('sales.quotesList.status')}</th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr
                    key={q.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => navigate(`/sales/quotes/${q.id}`)}
                  >
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900">
                          {q.quoteNumber}
                        </span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                          v{q.version}
                        </span>
                      </div>
                    </td>
                    <td className="py-2">{q.customerName}</td>
                    <td className="py-2">{formatDate(q.quoteDate)}</td>
                    <td className="py-2">{formatDate(q.validUntil)}</td>
                    <td className="py-2 text-right">
                      {formatMoney(q.grandTotalDoc, q.currency)}
                    </td>
                    <td className="py-2">
                      <span
                        className={clsx(
                          'rounded-full px-2 py-1 text-xs font-medium',
                          STATUS_STYLES[q.status] ?? 'bg-slate-100 text-slate-700'
                        )}
                      >
                        {t(`sales.quotesList.statuses.${q.status}`, q.status)}
                      </span>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td className="py-6 text-center text-slate-500" colSpan={6}>
                      {t('sales.quotesList.loading')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};

export default QuotationsPage;
