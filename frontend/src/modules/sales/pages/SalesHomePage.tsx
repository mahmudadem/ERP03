import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AccountDTO, accountingApi } from '../../../api/accountingApi';
import { companyModulesApi } from '../../../api/companyModules';
import {
  InitializeSalesPayload,
  SalesInvoiceDTO,
  SalesOrderDTO,
  SalesSettingsDTO,
  salesApi,
} from '../../../api/salesApi';
import { Card } from '../../../components/ui/Card';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const accountLabel = (account: AccountDTO): string =>
  `${account.userCode || account.code || account.systemCode} - ${account.name}`;

const StatsCard = ({
  label,
  value,
}: {
  label: string;
  value: string;
}) => (
  <Card className="p-5">
    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
  </Card>
);

const SalesInitializationWizard: React.FC<{ onComplete: () => void }> = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<AccountDTO[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);

  const [salesControlMode, setSalesControlMode] = useState<'SIMPLE' | 'CONTROLLED'>('SIMPLE');
  const [defaultARAccountId, setDefaultARAccountId] = useState('');
  const [defaultRevenueAccountId, setDefaultRevenueAccountId] = useState('');
  const [defaultCOGSAccountId, setDefaultCOGSAccountId] = useState('');
  const [defaultPaymentTermsDays, setDefaultPaymentTermsDays] = useState(30);
  const [soNumberPrefix, setSoNumberPrefix] = useState('SO');
  const [dnNumberPrefix, setDnNumberPrefix] = useState('DN');
  const [siNumberPrefix, setSiNumberPrefix] = useState('SI');
  const [srNumberPrefix, setSrNumberPrefix] = useState('SR');

  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoadingAccounts(true);
        const result = await accountingApi.getAccounts();
        const list = Array.isArray(result) ? result : unwrap<AccountDTO[]>(result);
        setAccounts(list || []);
      } catch (err) {
        console.error('Failed to load accounts for sales initialization', err);
        setAccounts([]);
      } finally {
        setLoadingAccounts(false);
      }
    };

    loadAccounts();
  }, []);

  const canContinue = useMemo(() => {
    if (step === 1) return !!defaultARAccountId && !!defaultRevenueAccountId;
    return true;
  }, [defaultARAccountId, defaultRevenueAccountId, step]);

  const nextStep = () => {
    if (!canContinue) {
      setError('Please fill required fields before continuing.');
      return;
    }
    setError(null);
    setStep((prev) => Math.min(prev + 1, 2));
  };

  const prevStep = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const initialize = async () => {
    if (!defaultARAccountId || !defaultRevenueAccountId) {
      setError('Default AR and Revenue accounts are required.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const payload: InitializeSalesPayload = {
        salesControlMode,
        defaultARAccountId,
        defaultRevenueAccountId,
        defaultCOGSAccountId: defaultCOGSAccountId || undefined,
        defaultPaymentTermsDays,
        soNumberPrefix: soNumberPrefix || 'SO',
        dnNumberPrefix: dnNumberPrefix || 'DN',
        siNumberPrefix: siNumberPrefix || 'SI',
        srNumberPrefix: srNumberPrefix || 'SR',
      };

      await salesApi.initializeSales(payload);
      onComplete();
    } catch (err: any) {
      console.error('Sales initialization failed', err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.message ||
          err?.message ||
          'Initialization failed. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Setup</h1>
      <Card className="p-6">
        <div className="mb-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span className={step === 0 ? 'text-blue-700' : ''}>1. Mode</span>
          <span>/</span>
          <span className={step === 1 ? 'text-blue-700' : ''}>2. Accounts</span>
          <span>/</span>
          <span className={step === 2 ? 'text-blue-700' : ''}>3. Defaults</span>
        </div>

        {step === 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Sales Control Mode</h2>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
              <input
                type="radio"
                name="salesControlMode"
                value="SIMPLE"
                checked={salesControlMode === 'SIMPLE'}
                onChange={() => setSalesControlMode('SIMPLE')}
              />
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">SIMPLE</div>
                <div className="text-sm text-slate-600">Sales invoice can be created directly for stock items.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
              <input
                type="radio"
                name="salesControlMode"
                value="CONTROLLED"
                checked={salesControlMode === 'CONTROLLED'}
                onChange={() => setSalesControlMode('CONTROLLED')}
              />
              <div>
                <div className="font-medium text-slate-900 dark:text-slate-100">CONTROLLED</div>
                <div className="text-sm text-slate-600">Stock flow is controlled through sales order and delivery note.</div>
              </div>
            </label>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Default Accounts</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Default AR Account</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={defaultARAccountId}
                onChange={(e) => setDefaultARAccountId(e.target.value)}
                disabled={loadingAccounts}
              >
                <option value="">{loadingAccounts ? 'Loading accounts...' : 'Select AR account'}</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {accountLabel(account)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Default Revenue Account</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={defaultRevenueAccountId}
                onChange={(e) => setDefaultRevenueAccountId(e.target.value)}
                disabled={loadingAccounts}
              >
                <option value="">Select Revenue account</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {accountLabel(account)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Default COGS Account</label>
              <select
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={defaultCOGSAccountId}
                onChange={(e) => setDefaultCOGSAccountId(e.target.value)}
                disabled={loadingAccounts}
              >
                <option value="">Optional</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {accountLabel(account)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Numbering & Defaults</h2>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Default Payment Terms (Days)</label>
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={defaultPaymentTermsDays}
                onChange={(e) => setDefaultPaymentTermsDays(Number(e.target.value))}
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">SO Prefix</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={soNumberPrefix}
                  onChange={(e) => setSoNumberPrefix(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">DN Prefix</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={dnNumberPrefix}
                  onChange={(e) => setDnNumberPrefix(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">SI Prefix</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={siNumberPrefix}
                  onChange={(e) => setSiNumberPrefix(e.target.value.toUpperCase())}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">SR Prefix</label>
                <input
                  type="text"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  value={srNumberPrefix}
                  onChange={(e) => setSrNumberPrefix(e.target.value.toUpperCase())}
                />
              </div>
            </div>
          </div>
        )}

        {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="mt-6 flex items-center justify-between">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium disabled:opacity-50"
            onClick={prevStep}
            disabled={step === 0 || submitting}
          >
            Back
          </button>
          {step < 2 ? (
            <button
              type="button"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={nextStep}
              disabled={!canContinue || submitting}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={initialize}
              disabled={submitting}
            >
              {submitting ? 'Initializing...' : 'Initialize Sales'}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
};

const SalesHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { companyId } = useCompanyAccess();

  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<SalesSettingsDTO | null>(null);
  const [orders, setOrders] = useState<SalesOrderDTO[]>([]);
  const [invoices, setInvoices] = useState<SalesInvoiceDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const load = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      if (companyId) {
        const modules = await companyModulesApi.list(companyId);
        const salesModule = modules.find((module) => module.moduleCode === 'sales');
        if (salesModule && !salesModule.initialized) {
          setInitialized(false);
          setSettings(null);
          setOrders([]);
          setInvoices([]);
          return;
        }
      }

      const settingsResult = await salesApi.getSettings();
      const currentSettings = unwrap<SalesSettingsDTO | null>(settingsResult);

      if (!currentSettings) {
        setInitialized(false);
        setSettings(null);
        setOrders([]);
        setInvoices([]);
        return;
      }

      setInitialized(true);
      setSettings(currentSettings);

      const [ordersResult, invoicesResult] = await Promise.all([
        salesApi.listSOs({ limit: 200 }),
        salesApi.listSIs({ limit: 500 }),
      ]);
      const orderList = unwrap<SalesOrderDTO[]>(ordersResult);
      const invoiceList = unwrap<SalesInvoiceDTO[]>(invoicesResult);
      setOrders(Array.isArray(orderList) ? orderList : []);
      setInvoices(Array.isArray(invoiceList) ? invoiceList : []);
    } catch (error: any) {
      console.error('Failed to load sales dashboard', error);
      setLoadError(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to load sales module.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId, reloadTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayIso();
  const postedInvoices = invoices.filter((invoice) => invoice.status === 'POSTED');
  const totalRevenue = postedInvoices.reduce((sum, invoice) => sum + invoice.grandTotalBase, 0);
  const outstandingAR = postedInvoices.reduce((sum, invoice) => sum + Math.max(invoice.outstandingAmountBase, 0), 0);
  const overdueInvoices = postedInvoices.filter(
    (invoice) => !!invoice.dueDate && invoice.dueDate < today && invoice.outstandingAmountBase > 0
  ).length;
  const topCustomers = Array.from(
    postedInvoices.reduce<Map<string, { customerName: string; total: number }>>((acc, invoice) => {
      const current = acc.get(invoice.customerId);
      if (current) {
        current.total += invoice.grandTotalBase;
      } else {
        acc.set(invoice.customerId, {
          customerName: invoice.customerName,
          total: invoice.grandTotalBase,
        });
      }
      return acc;
    }, new Map()).values()
  )
    .sort((a, b) => b.total - a.total)
    .slice(0, 3);

  if (loading && initialized === null) {
    return (
      <div className="space-y-6 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Overview</h1>
        <Card className="p-6">Loading sales module...</Card>
      </div>
    );
  }

  if (loadError && initialized === null) {
    return (
      <div className="space-y-6 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Overview</h1>
        <Card className="p-6 text-sm text-red-700">{loadError}</Card>
      </div>
    );
  }

  if (initialized === false) {
    return <SalesInitializationWizard onComplete={() => setReloadTick((prev) => prev + 1)} />;
  }

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sales Overview</h1>
          <p className="text-sm text-slate-600">
            Mode: <span className="font-semibold">{settings?.salesControlMode || 'SIMPLE'}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/sales/orders/new')}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            New SO
          </button>
          <button
            type="button"
            onClick={() => navigate('/sales/settings')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          >
            Settings
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard label="Total Revenue" value={loading ? '...' : totalRevenue.toFixed(2)} />
        <StatsCard label="Outstanding AR" value={loading ? '...' : outstandingAR.toFixed(2)} />
        <StatsCard label="Overdue Invoices" value={loading ? '...' : String(overdueInvoices)} />
        <StatsCard label="Posted Invoices" value={loading ? '...' : String(postedInvoices.length)} />
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Sales Orders</h2>
          <button
            type="button"
            className="text-sm font-medium text-primary-700 hover:underline"
            onClick={() => navigate('/sales/orders')}
          >
            View all
          </button>
        </div>
        <div className="space-y-2">
          {orders.slice(0, 8).map((order) => (
            <button
              key={order.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
              onClick={() => navigate(`/sales/orders/${order.id}`)}
            >
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{order.orderNumber}</div>
                <div className="text-xs text-slate-600">{order.customerName} • {order.status}</div>
              </div>
              <div className="text-xs text-slate-500">{order.orderDate}</div>
            </button>
          ))}
          {!loading && orders.length === 0 && (
            <div className="py-4 text-center text-sm text-slate-500">No sales orders yet.</div>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Top Customers</h2>
        <div className="space-y-2">
          {topCustomers.map((customer) => (
            <div key={customer.customerName} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span className="font-medium text-slate-900 dark:text-slate-100">{customer.customerName}</span>
              <span className="text-slate-600">{customer.total.toFixed(2)}</span>
            </div>
          ))}
          {!loading && topCustomers.length === 0 && (
            <div className="py-2 text-sm text-slate-500">No posted invoices yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default SalesHomePage;
