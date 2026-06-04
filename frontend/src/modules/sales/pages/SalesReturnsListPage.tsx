import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { RefreshCw, X } from 'lucide-react';
import { ReturnContext, SalesReturnDTO, salesApi, SRStatus } from '../../../api/salesApi';
import { PartyDTO, sharedApi } from '../../../api/sharedApi';
import { Card } from '../../../components/ui/Card';
import { PageHeader } from '../../../components/ui/PageHeader';
import { EmptyState } from '../../../components/ui/EmptyState';
import { PartySelector } from '../../../components/shared/selectors/PartySelector';
import { formatMoney } from '../../../utils/formatMoney';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;

type SRStatusFilter = SRStatus | 'ALL';
type ContextFilter = ReturnContext | 'ALL';

const STATUS_VALUES: SRStatusFilter[] = ['ALL', 'DRAFT', 'POSTED', 'CANCELLED'];
const CONTEXT_VALUES: ContextFilter[] = ['ALL', 'AFTER_INVOICE', 'BEFORE_INVOICE'];

const statusChipClasses = (status: SRStatus): string => {
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

const SalesReturnsListPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation('common');
  const [statusFilter, setStatusFilter] = useState<SRStatusFilter>('ALL');
  const [contextFilter, setContextFilter] = useState<ContextFilter>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [returns, setReturns] = useState<SalesReturnDTO[]>([]);
  const [customers, setCustomers] = useState<PartyDTO[]>([]);
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
    statusFilter !== 'ALL' || contextFilter !== 'ALL' || customerFilter !== 'ALL';

  const clearFilters = () => {
    setStatusFilter('ALL');
    setContextFilter('ALL');
    setCustomerFilter('ALL');
  };

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [returnResult, customerResult] = await Promise.all([
        salesApi.listReturns({
          status: statusFilter === 'ALL' ? undefined : statusFilter,
          customerId: customerFilter === 'ALL' ? undefined : customerFilter,
        }),
        sharedApi.listParties({ role: 'CUSTOMER', active: true }),
      ]);
      const list = unwrap<SalesReturnDTO[]>(returnResult);
      const customerList = unwrap<PartyDTO[]>(customerResult);
      setReturns(Array.isArray(list) ? list : []);
      setCustomers(Array.isArray(customerList) ? customerList : []);
    } catch (err: any) {
      console.error('Failed to load sales returns', err);
      setError(
        err?.response?.data?.error?.message
          || err?.response?.data?.message
          || err?.message
          || t('sales.returnsList.loadError')
      );
      setReturns([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [statusFilter, customerFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredReturns = useMemo(() => {
    if (contextFilter === 'ALL') return returns;
    return returns.filter((entry) => entry.returnContext === contextFilter);
  }, [contextFilter, returns]);

  return (
    <div className="space-y-6 p-4">
      <PageHeader
        title={t('sales.returnsList.title')}
        subtitle={t('sales.returnsList.subtitle')}
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => load()}
              title={t('sales.returnsList.refresh')}
              className="rounded-lg border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
              onClick={() => navigate('/sales/returns/new')}
            >
              {t('sales.returnsList.newButton')}
            </button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('sales.returnsList.filters.status')}
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as SRStatusFilter)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {STATUS_VALUES.map((value) => (
                <option key={value} value={value}>
                  {t(`sales.returnsList.status.${value}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('sales.returnsList.filters.context')}
            </label>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              {CONTEXT_VALUES.map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setContextFilter(value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    contextFilter === value
                      ? 'bg-primary-600 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {t(`sales.returnsList.context.${value}`)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              {t('sales.returnsList.filters.customer')}
            </label>
            <PartySelector
              role="CUSTOMER"
              value={customerFilter === 'ALL' ? '' : customerFilter}
              onChange={(party) => setCustomerFilter(party ? party.id : 'ALL')}
              placeholder={t('sales.returnsList.filters.allCustomers')}
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
                {t('sales.returnsList.clearFilters')}
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
        {!loading && filteredReturns.length === 0 && !error ? (
          <EmptyState
            title={t('sales.returnsList.empty.title')}
            description={t('sales.returnsList.empty.description')}
            action={
              <button
                type="button"
                className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                onClick={() => navigate('/sales/returns/new')}
              >
                {t('sales.returnsList.newButton')}
              </button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-2 text-left">{t('sales.returnsList.headers.returnNumber')}</th>
                  <th className="py-2 text-left">{t('sales.returnsList.headers.customer')}</th>
                  <th className="py-2 text-left">{t('sales.returnsList.headers.returnDate')}</th>
                  <th className="py-2 text-left">{t('sales.returnsList.headers.context')}</th>
                  <th className="py-2 text-right">{t('sales.returnsList.headers.grandTotal')}</th>
                  <th className="py-2 text-left">{t('sales.returnsList.headers.status')}</th>
                  <th className="py-2 text-right">{t('sales.returnsList.headers.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredReturns.map((entry) => (
                  <tr
                    key={entry.id}
                    className="cursor-pointer border-b border-slate-100 hover:bg-slate-50"
                    onClick={() => navigate(`/sales/returns/${entry.id}`)}
                  >
                    <td className="py-2 font-medium">{entry.returnNumber}</td>
                    <td className="py-2">{customerById[entry.customerId] || entry.customerName}</td>
                    <td className="py-2">{entry.returnDate}</td>
                    <td className="py-2">
                      {t(`sales.returnsList.context.${entry.returnContext}`, entry.returnContext)}
                    </td>
                    <td className="py-2 text-right">{formatMoney(entry.grandTotalDoc, entry.currency)}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${statusChipClasses(entry.status)}`}
                      >
                        {t(`sales.returnsList.status.${entry.status}`, entry.status)}
                      </span>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        className="text-sm font-medium text-primary-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/sales/returns/${entry.id}`);
                        }}
                      >
                        {t('sales.returnsList.open')}
                      </button>
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td className="py-6 text-center text-slate-500" colSpan={7}>
                      {t('sales.returnsList.loading')}
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

export default SalesReturnsListPage;
