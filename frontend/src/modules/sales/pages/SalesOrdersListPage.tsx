import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import { SOStatus, SalesOrderDTO, salesApi } from '../../../api/salesApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type SOStatusFilter = SOStatus | 'ALL';

const STATUS_VALUES: SOStatusFilter[] = [
  'ALL',
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_DELIVERED',
  'FULLY_DELIVERED',
  'CLOSED',
  'CANCELLED',
];

const SUMMARY_STATUSES: SOStatus[] = [
  'DRAFT',
  'CONFIRMED',
  'PARTIALLY_DELIVERED',
  'FULLY_DELIVERED',
  'CLOSED',
  'CANCELLED',
];

const statusChipClasses = (status: SOStatus): string => {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700';
    case 'CONFIRMED':
      return 'bg-indigo-100 text-indigo-700';
    case 'PARTIALLY_DELIVERED':
      return 'bg-amber-100 text-amber-700';
    case 'FULLY_DELIVERED':
      return 'bg-emerald-100 text-emerald-700';
    case 'CLOSED':
      return 'bg-slate-100 text-slate-700';
    case 'CANCELLED':
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

const SalesOrdersListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [orders, setOrders] = useState<SalesOrderDTO[]>([]);
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
  const [statusFilter, setStatusFilter] = useState<SOStatusFilter>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
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

  const hasActiveFilters = statusFilter !== 'ALL' || customerFilter !== 'ALL';

  const clearFilters = () => {
    setStatusFilter('ALL');
    setCustomerFilter('ALL');
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);

      const [soResult, customerResult] = await Promise.all([
        salesApi.listSOs({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          customerId: customerFilter === 'ALL' ? undefined : customerFilter,
          limit: 200,
        }),
        sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      ]);

      const list = unwrap<SalesOrderDTO[]>(soResult);
      const customerList = unwrap<PartyDTO[]>(customerResult);
      setOrders(Array.isArray(list) ? list : []);
      setCustomers(Array.isArray(customerList) ? customerList : []);
    } catch (err: any) {
      console.error('Failed to load sales orders', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          t('sales.ordersList.loadError')
      );
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, customerFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusSummary = useMemo(
    () =>
      SUMMARY_STATUSES.map((status) => ({
        status,
        value: orders.filter((order) => order.status === status).length,
      })),
    [orders]
  );

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title={t('sales.ordersList.title')}
        subtitle={t('sales.ordersList.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              title={t('sales.ordersList.refresh')}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              onClick={() => navigate('/sales/orders/new')}
            >
              {t('sales.ordersList.newButton')}
            </button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('sales.ordersList.filters.status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SOStatusFilter)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`sales.ordersList.status.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('sales.ordersList.filters.customer')}
            </label>
            <PartySelector
              role="CUSTOMER"
              value={customerFilter === 'ALL' ? '' : customerFilter}
              onChange={(party) => setCustomerFilter(party ? party.id : 'ALL')}
              placeholder={t('sales.ordersList.filters.allCustomers')}
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
                {t('sales.ordersList.clearFilters')}
              </button>
            )}
          </div>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {statusSummary.map((summary) => (
          <Card key={summary.status} className="p-3">
            <div className="text-xs uppercase tracking-wide text-slate-500">
              {t(`sales.ordersList.status.${summary.status}`)}
            </div>
            <div className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
              {summary.value}
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-4">
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {!loading && orders.length === 0 && !error ? (
          <EmptyState
            title={t('sales.ordersList.empty.title')}
            description={t('sales.ordersList.empty.description')}
            action={
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                onClick={() => navigate('/sales/orders/new')}
              >
                {t('sales.ordersList.newButton')}
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left">{t('sales.ordersList.headers.orderNumber')}</th>
                  <th className="py-2 text-left">{t('sales.ordersList.headers.customer')}</th>
                  <th className="py-2 text-left">{t('sales.ordersList.headers.orderDate')}</th>
                  <th className="py-2 text-right">{t('sales.ordersList.headers.total')}</th>
                  <th className="py-2 text-left">{t('sales.ordersList.headers.currency')}</th>
                  <th className="py-2 text-left">{t('sales.ordersList.headers.status')}</th>
                  <th className="py-2 text-right">{t('sales.ordersList.headers.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => navigate(`/sales/orders/${order.id}`)}
                  >
                    <td className="py-2 font-medium">{order.orderNumber}</td>
                    <td className="py-2">{customerById[order.customerId] || order.customerName}</td>
                    <td className="py-2">{order.orderDate}</td>
                    <td className="py-2 text-right">{formatMoney(order.grandTotalDoc, order.currency)}</td>
                    <td className="py-2">{order.currency}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${statusChipClasses(order.status)}`}
                      >
                        {t(`sales.ordersList.status.${order.status}`, order.status)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="text-sm font-medium text-primary-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/sales/orders/${order.id}`);
                        }}
                      >
                        {t('sales.ordersList.open')}
                      </button>
                    </td>
                  </tr>
                ))}

                {loading && (
                  <tr>
                    <td className="py-6 text-center text-slate-500" colSpan={7}>
                      {t('sales.ordersList.loading')}
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

export default SalesOrdersListPage;
