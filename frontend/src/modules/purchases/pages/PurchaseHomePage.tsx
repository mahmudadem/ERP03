import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
import {
  resolvePurchaseWorkflowMode,
  shouldShowOperationalDocuments,
} from '../../../utils/documentPolicy';

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
  const { t } = useTranslation(['purchases', 'common']);
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
        const purchaseModule = modules.find((module) => module.moduleCode === 'purchase');
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

      const showOperational = shouldShowOperationalDocuments(resolvePurchaseWorkflowMode(currentSettings));
      const [ordersResult, receiptsResult, invoicesResult, returnsResult] = await Promise.all([
        showOperational ? purchasesApi.listPOs({ limit: 100 }) : Promise.resolve([]),
        showOperational ? purchasesApi.listGRNs({ limit: 100 }) : Promise.resolve([]),
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
        error?.response?.data?.error?.message
          || error?.response?.data?.message
          || error?.message
          || t('PurchaseHomePage.failedToLoadPurchasesModule', 'Failed to load purchases module.')
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [companyId, reloadTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const showOperational = shouldShowOperationalDocuments(resolvePurchaseWorkflowMode(settings));
  const today = todayIso();
  const postedInvoices = invoices.filter((invoice) => invoice.status === 'POSTED');
  const openPOsCount = orders.filter((order) => !['CLOSED', 'CANCELLED'].includes(order.status)).length;
  const pendingGRNsCount = receipts.filter((receipt) => receipt.status === 'DRAFT').length;
  const unpaidInvoicesCount = postedInvoices.filter((invoice) => invoice.paymentStatus !== 'PAID').length;
  const overdueInvoicesCount = postedInvoices.filter((invoice) => {
    if (invoice.paymentStatus === 'PAID') return false;
    if (!invoice.dueDate) return false;
    return invoice.dueDate < today;
  }).length;
  const totalPurchases = postedInvoices.reduce((sum, invoice) => sum + invoice.grandTotalBase, 0);
  const postedReturnsCount = returns.filter((entry) => entry.status === 'POSTED').length;

  const recentActivity = useMemo(() => {
    const events: Array<{ id: string; date: string; label: string; subtitle: string; href: string }> = [];

    if (showOperational) {
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
    }

    postedInvoices.forEach((invoice) => {
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
  }, [orders, postedInvoices, receipts, returns, showOperational]);

  if (loading && initialized === null) {
    return (
      <div className="space-y-6 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t("PurchaseHomePage.purchasesOverview", "Purchases Overview")}</h1>
        <Card className="p-6">{t("PurchaseHomePage.loadingPurchasesModule", "Loading purchases module...")}</Card>
      </div>
    );
  }

  if (loadError && initialized === null) {
    return (
      <div className="space-y-6 p-4">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t("PurchaseHomePage.purchasesOverview2", "Purchases Overview")}</h1>
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
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-200/60 dark:border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400 shadow-sm border border-indigo-100/50 dark:border-indigo-900/30">
            <ClipboardList size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">{t("PurchaseHomePage.purchasesOverviewModule", "Purchases Overview Module")}</h1>
              <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-950/30 dark:text-indigo-400 dark:ring-indigo-400/20">{t("PurchaseHomePage.moduleDashboard", "Module Dashboard")}</span>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("PurchaseHomePage.manageVendorsTrackPurchaseOrdersAndReceiptsAnd", "Manage vendors, track purchase orders and receipts, and process vendor invoices.")}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => navigate(showOperational ? '/purchases/orders/new' : '/purchases/invoices/new')}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            {showOperational ? t('PurchaseHomePage.newPO', 'New PO') : t('PurchaseHomePage.newPurchaseInvoice', 'New Purchase Invoice')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/purchases/settings')}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium"
          >{t("PurchaseHomePage.settings", "Settings")}</button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {showOperational ? (
          <>
            <StatsCard
              icon={<ShoppingCart className="h-5 w-5" />}
              label={t('PurchaseHomePage.openPOs', 'Open POs')}
              value={loading ? '...' : String(openPOsCount)}
              accentClass="bg-blue-100 text-blue-700"
            />
            <StatsCard
              icon={<ClipboardList className="h-5 w-5" />}
              label={t('PurchaseHomePage.pendingGRNs', 'Pending GRNs')}
              value={loading ? '...' : String(pendingGRNsCount)}
              accentClass="bg-amber-100 text-amber-700"
            />
            <StatsCard
              icon={<FileText className="h-5 w-5" />}
              label={t('PurchaseHomePage.unpaidInvoices', 'Unpaid Invoices')}
              value={loading ? '...' : String(unpaidInvoicesCount)}
              accentClass="bg-emerald-100 text-emerald-700"
            />
            <StatsCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label={t('PurchaseHomePage.overdueInvoices', 'Overdue Invoices')}
              value={loading ? '...' : String(overdueInvoicesCount)}
              accentClass="bg-rose-100 text-rose-700"
            />
          </>
        ) : (
          <>
            <StatsCard
              icon={<FileText className="h-5 w-5" />}
              label={t('PurchaseHomePage.totalPurchases', 'Total Purchases')}
              value={loading ? '...' : totalPurchases.toFixed(2)}
              accentClass="bg-emerald-100 text-emerald-700"
            />
            <StatsCard
              icon={<ClipboardList className="h-5 w-5" />}
              label={t('PurchaseHomePage.postedInvoices', 'Posted Invoices')}
              value={loading ? '...' : String(postedInvoices.length)}
              accentClass="bg-blue-100 text-blue-700"
            />
            <StatsCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label={t('auto.PurchaseHomePage.overdueInvoices', 'Overdue Invoices')}
              value={loading ? '...' : String(overdueInvoicesCount)}
              accentClass="bg-rose-100 text-rose-700"
            />
            <StatsCard
              icon={<Undo2 className="h-5 w-5" />}
              label={t('PurchaseHomePage.postedReturns', 'Posted Returns')}
              value={loading ? '...' : String(postedReturnsCount)}
              accentClass="bg-amber-100 text-amber-700"
            />
          </>
        )}
      </div>

      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {showOperational ? t('PurchaseHomePage.recentActivity', 'Recent Activity') : t('PurchaseHomePage.recentPurchaseInvoicesAndReturns', 'Recent Purchase Invoices & Returns')}
          </h2>
          <button
            type="button"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary-700"
            onClick={() => navigate(showOperational ? '/purchases/returns' : '/purchases/invoices')}
          >
            <Undo2 className="h-4 w-4" />
            {showOperational ? t('PurchaseHomePage.returns', 'Returns') : t('PurchaseHomePage.invoices', 'Invoices')}
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
                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">{activity.label}</div>
                <div className="text-xs text-slate-600">{activity.subtitle}</div>
              </div>
              <div className="text-xs text-slate-500">{new Date(activity.date).toLocaleDateString()}</div>
            </button>
          ))}
          {!loading && recentActivity.length === 0 && (
            <div className="py-4 text-center text-sm text-slate-500">{t("PurchaseHomePage.noRecentActivityYet", "No recent activity yet.")}</div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default PurchaseHomePage;
