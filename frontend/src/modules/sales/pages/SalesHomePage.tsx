import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { companyModulesApi } from '../../../api/companyModules';
import { SalesInvoiceDTO, SalesOrderDTO, SalesSettingsDTO, salesApi } from '../../../api/salesApi';
import { Card } from '../../../components/ui/Card';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import SalesInitializationWizard from '../wizards/SalesInitializationWizard';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const StatsCard = ({ label, value }: { label: string; value: string }) => (
  <Card className="p-5">
    <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
    <div className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
  </Card>
);

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
  const outstandingAR = postedInvoices.reduce(
    (sum, invoice) => sum + Math.max(invoice.outstandingAmountBase, 0),
    0
  );
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
    return (
      <SalesInitializationWizard
        onComplete={() => {
          setInitialized(true);
          setReloadTick((prev) => prev + 1);
        }}
      />
    );
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
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {order.orderNumber}
                </div>
                <div className="text-xs text-slate-600">
                  {order.customerName} • {order.status}
                </div>
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
            <div
              key={customer.customerName}
              className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-900 dark:text-slate-100">
                {customer.customerName}
              </span>
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
