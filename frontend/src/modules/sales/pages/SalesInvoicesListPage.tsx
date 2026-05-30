import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import {
  PaymentStatus,
  SalesInvoiceDTO,
  salesApi,
  SIStatus,
} from '../../../api/salesApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type SIStatusFilter = SIStatus | 'ALL';
type PaymentFilter = PaymentStatus | 'ALL';

const STATUS_VALUES: SIStatusFilter[] = ['ALL', 'DRAFT', 'POSTED', 'CANCELLED'];
const PAYMENT_VALUES: PaymentFilter[] = ['ALL', 'UNPAID', 'PARTIALLY_PAID', 'PAID'];

const statusChipClasses = (status: SIStatus): string => {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700';
    case 'POSTED':
      return 'bg-emerald-100 text-emerald-700';
    case 'CANCELLED':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const paymentChipClasses = (status: PaymentStatus): string => {
  switch (status) {
    case 'PAID':
      return 'bg-emerald-100 text-emerald-700';
    case 'PARTIALLY_PAID':
      return 'bg-amber-100 text-amber-700';
    case 'UNPAID':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const formatMoney = (amount: number, currency: string): string => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
};

const SalesInvoicesListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [statusFilter, setStatusFilter] = useState<SIStatusFilter>('ALL');
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilter>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoiceDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customerById = useMemo(
    () =>
      customers.reduce<Record<string, string>>((acc, customer) => {
        acc[customer.id] = customer.displayName;
        return acc;
      }, {}),
    [customers]
  );

  const hasActiveFilters =
    statusFilter !== 'ALL' || paymentFilter !== 'ALL' || customerFilter !== 'ALL';

  const clearFilters = () => {
    setStatusFilter('ALL');
    setPaymentFilter('ALL');
    setCustomerFilter('ALL');
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [invoiceResult, customerResult] = await Promise.all([
        salesApi.listSIs({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          paymentStatus: paymentFilter === 'ALL' ? undefined : paymentFilter,
          customerId: customerFilter === 'ALL' ? undefined : customerFilter,
          limit: 200,
        }),
        sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      ]);

      const invoiceList = unwrap<SalesInvoiceDTO[]>(invoiceResult);
      const customerList = unwrap<PartyDTO[]>(customerResult);
      setInvoices(Array.isArray(invoiceList) ? invoiceList : []);
      setCustomers(Array.isArray(customerList) ? customerList : []);
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
  }, [statusFilter, paymentFilter, customerFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title={t('sales.invoicesList.title')}
        subtitle={t('sales.invoicesList.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              title={t('sales.invoicesList.refresh')}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              onClick={() => navigate('/sales/invoices/new')}
            >
              {t('sales.invoicesList.newButton')}
            </button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('sales.invoicesList.filters.status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SIStatusFilter)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`sales.invoicesList.status.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('sales.invoicesList.filters.payment')}
            </label>
            <select
              value={paymentFilter}
              onChange={(e) => setPaymentFilter(e.target.value as PaymentFilter)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {PAYMENT_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`sales.invoicesList.payment.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('sales.invoicesList.filters.customer')}
            </label>
            <PartySelector
              role="CUSTOMER"
              value={customerFilter === 'ALL' ? '' : customerFilter}
              onChange={(party) => setCustomerFilter(party ? party.id : 'ALL')}
              placeholder={t('sales.invoicesList.filters.allCustomers')}
            />
          </div>
          <div className="flex items-end">
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                <X size={14} />
                {t('sales.invoicesList.clearFilters')}
              </button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && invoices.length === 0 && !error ? (
          <EmptyState
            title={t('sales.invoicesList.empty.title')}
            description={t('sales.invoicesList.empty.description')}
            action={
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                onClick={() => navigate('/sales/invoices/new')}
              >
                {t('sales.invoicesList.newButton')}
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left">{t('sales.invoicesList.headers.invoiceNumber')}</th>
                  <th className="py-2 text-left">{t('sales.invoicesList.headers.customer')}</th>
                  <th className="py-2 text-left">{t('sales.invoicesList.headers.invoiceDate')}</th>
                  <th className="py-2 text-right">{t('sales.invoicesList.headers.grandTotal')}</th>
                  <th className="py-2 text-left">{t('sales.invoicesList.headers.payment')}</th>
                  <th className="py-2 text-left">{t('sales.invoicesList.headers.status')}</th>
                  <th className="py-2 text-right">{t('sales.invoicesList.headers.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => navigate(`/sales/invoices/${invoice.id}`)}
                  >
                    <td className="py-2 font-medium">{invoice.invoiceNumber}</td>
                    <td className="py-2">{customerById[invoice.customerId] || invoice.customerName}</td>
                    <td className="py-2">{invoice.invoiceDate}</td>
                    <td className="py-2 text-right">
                      {formatMoney(invoice.grandTotalDoc, invoice.currency)}
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${paymentChipClasses(invoice.paymentStatus)}`}
                      >
                        {t(`sales.invoicesList.payment.${invoice.paymentStatus}`, invoice.paymentStatus)}
                      </span>
                    </td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${statusChipClasses(invoice.status)}`}
                      >
                        {t(`sales.invoicesList.status.${invoice.status}`, invoice.status)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="text-sm font-medium text-primary-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/sales/invoices/${invoice.id}`);
                        }}
                      >
                        {t('sales.invoicesList.open')}
                      </button>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td className="py-6 text-center text-slate-500" colSpan={7}>
                      {t('sales.invoicesList.loading')}
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

export default SalesInvoicesListPage;
