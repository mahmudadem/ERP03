import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PaymentStatus,
  PIStatus,
  PurchaseInvoiceDTO,
  purchasesApi,
} from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PageHeader } from '../../../components/ui/PageHeader';
import { PartySelector } from '../../../components/shared/selectors';
import { FileText, Plus, RefreshCw } from 'lucide-react';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

const STATUS_OPTIONS: Array<{ label: string; value: PIStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Posted', value: 'POSTED' },
  { label: 'Cancelled', value: 'CANCELLED' },
];

const PAYMENT_OPTIONS: Array<{ label: string; value: PaymentStatus | 'ALL' }> = [
  { label: 'All', value: 'ALL' },
  { label: 'Unpaid', value: 'UNPAID' },
  { label: 'Partially Paid', value: 'PARTIALLY_PAID' },
  { label: 'Paid', value: 'PAID' },
];

const formatMoney = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const statusChipClass = (status: PIStatus): string => {
  switch (status) {
    case 'POSTED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'CANCELLED':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'DRAFT':
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
};

const paymentChipClass = (status: PaymentStatus): string => {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'PARTIALLY_PAID':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'UNPAID':
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
};

const PurchaseInvoicesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [statusFilter, setStatusFilter] = useState<PIStatus | 'ALL'>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'ALL'>('ALL');
  const [vendorFilter, setVendorFilter] = useState<string>('ALL');
  const [invoices, setInvoices] = useState<PurchaseInvoiceDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const invoiceResult = await purchasesApi.listPIs({
        status: statusFilter === 'ALL' ? undefined : statusFilter,
        paymentStatus: paymentFilter === 'ALL' ? undefined : paymentFilter,
        vendorId: vendorFilter === 'ALL' ? undefined : vendorFilter,
        limit: 200,
      });

      const invoiceList = unwrap<PurchaseInvoiceDTO[]>(invoiceResult);
      setInvoices(Array.isArray(invoiceList) ? invoiceList : []);
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
  }, [statusFilter, paymentFilter, vendorFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasActiveFilters = statusFilter !== 'ALL' || paymentFilter !== 'ALL' || vendorFilter !== 'ALL';

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title={t('purchases.invoicesList.title')}
        subtitle={t('purchases.invoicesList.subtitle')}
        action={
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            onClick={() => navigate('/purchases/invoices/new')}
          >
            <Plus size={16} aria-hidden="true" />
            {t('purchases.invoicesList.new')}
          </button>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr_2fr_auto_auto]">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">{t('purchases.invoicesList.status')}</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as PIStatus | 'ALL')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {t(`purchases.invoicesList.statusOptions.${status.value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">{t('purchases.invoicesList.payment')}</span>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | 'ALL')}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {PAYMENT_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {t(`purchases.invoicesList.paymentOptions.${status.value}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-600">{t('purchases.invoicesList.vendor')}</span>
            <PartySelector
              role="VENDOR"
              value={vendorFilter === 'ALL' ? '' : vendorFilter}
              placeholder={t('purchases.invoicesList.allVendors')}
              onChange={(party) => setVendorFilter(party?.id || 'ALL')}
            />
          </label>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 self-end rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw size={16} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
            {t('actions.refresh')}
          </button>
          {hasActiveFilters && (
            <button
              type="button"
              className="self-end rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
              onClick={() => {
                setStatusFilter('ALL');
                setPaymentFilter('ALL');
                setVendorFilter('ALL');
              }}
            >
              {t('actions.clear')}
            </button>
          )}
        </div>
      </Card>

      <Card className="p-4">
        {error && <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2 text-left">Invoice #</th>
                <th className="py-2 text-left">Vendor</th>
                <th className="py-2 text-left">Invoice Date</th>
                <th className="py-2 text-right">Grand Total</th>
                <th className="py-2 text-left">Currency</th>
                <th className="py-2 text-left">Payment</th>
                <th className="py-2 text-left">Status</th>
                <th className="py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr
                  key={invoice.id}
                  className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                  onClick={() => navigate(`/purchases/invoices/${invoice.id}`)}
                >
                  <td className="py-2 font-medium">{invoice.invoiceNumber}</td>
                  <td className="py-2">{invoice.vendorName}</td>
                  <td className="py-2">{invoice.invoiceDate}</td>
                  <td className="py-2 text-right">{formatMoney(invoice.grandTotalDoc, invoice.currency)}</td>
                  <td className="py-2">{invoice.currency}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ring-1 ${paymentChipClass(invoice.paymentStatus)}`}>
                      {t(`purchases.invoicesList.paymentOptions.${invoice.paymentStatus}`)}
                    </span>
                  </td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ring-1 ${statusChipClass(invoice.status)}`}>
                      {t(`purchases.invoicesList.statusOptions.${invoice.status}`)}
                    </span>
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button"
                      className="rounded-md px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50"
                      onClick={(event) => {
                        event.stopPropagation();
                        navigate(`/purchases/invoices/${invoice.id}`);
                      }}
                    >
                      {t('actions.open')}
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && invoices.length === 0 && (
                <tr>
                  <td className="py-8" colSpan={8}>
                    <EmptyState
                      icon={<FileText size={36} aria-hidden="true" />}
                      title={t('purchases.invoicesList.emptyTitle')}
                      description={t('purchases.invoicesList.emptyDescription')}
                      action={
                        <button
                          type="button"
                          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                          onClick={() => navigate('/purchases/invoices/new')}
                        >
                          {t('purchases.invoicesList.new')}
                        </button>
                      }
                    />
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td className="py-6 text-center text-slate-500" colSpan={8}>
                    {t('purchases.invoicesList.loading')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default PurchaseInvoicesListPage;
