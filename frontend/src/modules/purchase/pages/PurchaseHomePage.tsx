import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ClipboardList, FileText, ShoppingCart, Undo2 } from 'lucide-react';
import { companyModulesApi } from '../../../api/companyModules';
import {
  GoodsReceiptDTO,
  PurchaseInvoiceDTO,
  PurchaseOrderDTO,
  PurchaseReturnDTO,
  PurchaseSettingsDTO,
  purchasesApi,
} from '../../../api/purchasesApi';
import { Card } from '../../../components/ui/Card';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import PurchaseInitializationWizard from '../wizards/PurchaseInitializationWizard';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const todayIso = (): string => new Date().toISOString().slice(0, 10);

const StatsCard = ({
  icon,
  label,
  value,
  accentClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accentClass: string;
}) => (
  <Card className="p-5">
    <div className="flex items-center justify-between">
      <div className={`rounded-lg p-2 ${accentClass}`}>{icon}</div>
      <div className="text-right">
        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      </div>
    </div>
  </Card>
);

const PurchaseHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { companyId } = useCompanyAccess();

  const [initialized, setInitialized] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<PurchaseSettingsDTO | null>(null);
  const [orders, setOrders] = useState<PurchaseOrderDTO[]>([]);
  const [receipts, setReceipts] = useState<GoodsReceiptDTO[]>([]);
  const [invoices, setInvoices] = useState<PurchaseInvoiceDTO[]>([]);
  const [returns, setReturns] = useState<PurchaseReturnDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  const load = async () => {
    try {
      setLoading(true);
      setLoadError(null);

      if (companyId) {
        const modules = await companyModulesApi.list(companyId);
        const purchaseModule = modules.find((m) => m.moduleCode === 'purchase');
        if (purchaseModule && !purchaseModule.initialized) {
          setInitialized(false);
          setSettings(null);
          setOrders([]);
          setReceipts([]);
          setInvoices([]);
          setReturns([]);
          return;
        }
      }

      const settingsResult = await purchasesApi.getSettings();
      const currentSettings = unwrap<PurchaseSettingsDTO | null>(settingsResult);

      if (!currentSettings) {
        setInitialized(false);
        setSettings(null);
        setOrders([]);
        setReceipts([]);
        setInvoices([]);
        setReturns([]);
        return;
      }

      setInitialized(true);
      setSettings(currentSettings);

      const [ordersResult, receiptsResult, invoicesResult, returnsResult] = await Promise.all([
        purchasesApi.listPOs({ limit: 100 }),
        purchasesApi.listGRNs({ limit: 100 }),
        purchasesApi.listPIs({ status: 'POSTED', limit: 100 }),
        purchasesApi.listReturns(),
      ]);

      const orderList = unwrap<PurchaseOrderDTO[]>(ordersResult);
      const receiptList = unwrap<GoodsReceiptDTO[]>(receiptsResult);
      const invoiceList = unwrap<PurchaseInvoiceDTO[]>(invoicesResult);
      const returnList = unwrap<PurchaseReturnDTO[]>(returnsResult);

      setOrders(Array.isArray(orderList) ? orderList : []);
      setReceipts(Array.isArray(receiptList) ? receiptList : []);
      setInvoices(Array.isArray(invoiceList) ? invoiceList : []);
      setReturns(Array.isArray(returnList) ? returnList : []);
    } catch (error: any) {
      console.error('Failed to load purchases dashboard', error);
      setLoadError(
        error?.response?.data?.error?.message ||
          error?.response?.data?.message ||
          error?.message ||
          'Failed to load purchases module.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [companyId, reloadTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = todayIso();
  const openPOsCount = orders.filter((order) => !['CLOSED', 'CANCELLED'].includes(order.status)).length;
  const pendingGRNsCount = receipts.filter((receipt) => receipt.status === 'DRAFT').length;
  const unpaidInvoicesCount = invoices.filter((invoice) => invoice.paymentStatus !== 'PAID').length;
  const overdueInvoicesCount = invoices.filter((invoice) => {
    if (invoice.paymentStatus === 'PAID') return false;
    if (!invoice.dueDate) return false;
    return invoice.dueDate < today;
  }).length;

  const recentActivity = useMemo(() => {
    const events: Array<{ id: string; date: string; label: string; subtitle: string; href: string }> = [];

    orders.forEach((order) => {
      events.push({
        id: `PO-${order.id}`,
        date: order.updatedAt || order.createdAt,
        label: `PO ${order.orderNumber}`,
        subtitle: `${order.vendorName} • ${order.status}`,
        href: `/purchases/orders/${order.id}`,
      });
    });

    receipts.forEach((receipt) => {
      events.push({
        id: `GRN-${receipt.id}`,
        date: receipt.postedAt || receipt.updatedAt || receipt.createdAt,
        label: `GRN ${receipt.grnNumber}`,
        subtitle: `${receipt.vendorName} • ${receipt.status}`,
        href: `/purchases/goods-receipts/${receipt.id}`,
      });
    });

    invoices.forEach((invoice) => {
      events.push({
        id: `PI-${invoice.id}`,
        date: invoice.postedAt || invoice.updatedAt || invoice.createdAt,
        label: `PI ${invoice.invoiceNumber}`,
        subtitle: `${invoice.vendorName} • ${invoice.paymentStatus}`,
        href: `/purchases/invoices/${invoice.id}`,
      });
    });

    returns.forEach((entry) => {
      events.push({
        id: `PR-${entry.id}`,
        date: entry.postedAt || entry.updatedAt || entry.createdAt,
        label: `PR ${entry.returnNumber}`,
        subtitle: `${entry.vendorName} • ${entry.returnContext}`,
        href: `/purchases/returns/${entry.id}`,
      });
    });

    return events
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);
  }, [invoices, orders, receipts, returns]);

  if (loading && initialized === null) {
    return (
      <div className="space-y-6 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchases Overview</h1>
        <Card className="p-6">Loading purchases module...</Card>
      </div>
    );
  }

  if (loadError && initialized === null) {
    return (
      <div className="space-y-6 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchases Overview</h1>
        <Card className="p-6 text-sm text-red-700">{loadError}</Card>
      </div>
    );
  }

  if (initialized === false) {
    return (
      <PurchaseInitializationWizard
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Purchases Overview</h1>
          <p className="text-sm text-slate-600">
            Mode: <span className="font-semibold">{settings?.procurementControlMode || 'SIMPLE'}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate('/purchases/orders/new')}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            New PO
          </button>
          <button
            type="button"
            onClick={() => navigate('/purchases/settings')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          >
            Settings
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatsCard
          icon={<ShoppingCart className="h-5 w-5" />}
          label="Open POs"
          value={loading ? '...' : String(openPOsCount)}
          accentClass="bg-blue-100 text-blue-700"
        />
        <StatsCard
          icon={<ClipboardList className="h-5 w-5" />}
          label="Pending GRNs"
          value={loading ? '...' : String(pendingGRNsCount)}
          accentClass="bg-amber-100 text-amber-700"
        />
        <StatsCard
          icon={<FileText className="h-5 w-5" />}
          label="Unpaid Invoices"
          value={loading ? '...' : String(unpaidInvoicesCount)}
          accentClass="bg-emerald-100 text-emerald-700"
        />
        <StatsCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Overdue Invoices"
          value={loading ? '...' : String(overdueInvoicesCount)}
          accentClass="bg-rose-100 text-rose-700"
        />
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Recent Activity</h2>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-700"
            onClick={() => navigate('/purchases/returns')}
          >
            <Undo2 className="h-4 w-4" />
            Returns
          </button>
        </div>
        <div className="space-y-2">
          {recentActivity.map((activity) => (
            <button
              key={activity.id}
              type="button"
              className="flex w-full items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-left hover:bg-slate-50"
              onClick={() => navigate(activity.href)}
            >
              <div>
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {activity.label}
                </div>
                <div className="text-xs text-slate-600">{activity.subtitle}</div>
              </div>
              <div className="text-xs text-slate-500">
                {new Date(activity.date).toLocaleDateString()}
              </div>
            </button>
          ))}
          {!loading && recentActivity.length === 0 && (
            <div className="py-4 text-center text-sm text-slate-500">No recent activity yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default PurchaseHomePage;
