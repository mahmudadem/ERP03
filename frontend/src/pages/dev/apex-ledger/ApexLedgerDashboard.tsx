import React, { useState, useMemo, lazy, Suspense } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import DashboardHome from './components/DashboardHome';
import COASection from './components/COASection';
import SalesSection from './components/SalesSection';
import PurchasesSection from './components/PurchasesSection';
import InventorySection from './components/InventorySection';
import AIAssistantSection from './components/AIAssistantSection';
import VoucherListSection from './components/VoucherListSection';
import ApprovalCenterSection from './components/ApprovalCenterSection';
import ReportsSection from './components/ReportsSection';
import ToolsSection from './components/ToolsSection';
import SettingsSection from './components/SettingsSection';

// --- Lazy-loaded Apex Report pages (built by parallel subagents) ---
const ApexTrialBalance = lazy(() => import('./components/reports/ApexTrialBalance'));
const ApexAccountStatement = lazy(() => import('./components/reports/ApexAccountStatement'));
const ApexBalanceSheet = lazy(() => import('./components/reports/ApexBalanceSheet'));
const ApexProfitLoss = lazy(() => import('./components/reports/ApexProfitLoss'));
const ApexTradingAccount = lazy(() => import('./components/reports/ApexTradingAccount'));
const ApexCashFlow = lazy(() => import('./components/reports/ApexCashFlow'));
const ApexJournal = lazy(() => import('./components/reports/ApexJournal'));
const ApexAging = lazy(() => import('./components/reports/ApexAging'));
const ApexBankReconciliation = lazy(() => import('./components/reports/ApexBankReconciliation'));
const ApexCostCenterSummary = lazy(() => import('./components/reports/ApexCostCenterSummary'));
const ApexBudgetVsActual = lazy(() => import('./components/reports/ApexBudgetVsActual'));
const ApexConsolidatedTB = lazy(() => import('./components/reports/ApexConsolidatedTB'));

// Lazy-loaded settings
const ApexAccountingSettings = lazy(() => import('./components/settings/ApexAccountingSettings'));

// Loading fallback
const ReportLoader = () => (
  <div className="flex items-center justify-center h-48 bg-white border border-[#E2E8F0] rounded-lg">
    <div className="text-center space-y-2">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-[11px] font-mono text-slate-400">Loading report...</p>
    </div>
  </div>
);

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { accountingApi } from '../../../api/accountingApi';
import { salesApi } from '../../../api/salesApi';
import { purchasesApi } from '../../../api/purchasesApi';
import { inventoryApi } from '../../../api/inventoryApi';
import { sharedApi } from '../../../api/sharedApi';

import {
  COAAccount,
  SalesOrder,
  Invoice,
  Customer,
  Vendor,
  PurchaseBill,
  InventoryItem
} from './types';

import {
  INITIAL_ACCOUNTS,
  INITIAL_CUSTOMERS,
  INITIAL_VENDORS,
  INITIAL_INVENTORY,
  INITIAL_SALES_ORDERS,
  INITIAL_INVOICES,
  INITIAL_PURCHASE_BILLS
} from './utils/dummyData';

import {
  Building2,
  Calendar,
  Coins,
  Laptop,
  Clock,
  Search,
  Moon,
  Sun,
  Bell,
  Settings,
  CheckCircle
} from 'lucide-react';

// --- Routing helpers ---

type ActiveSection =
  | 'home'
  | 'accounting-overview'
  | 'coa'
  | 'vouchers'
  | 'approvals'
  | 'reports'
  | 'reports-sub'
  | 'tools'
  | 'tools-sub'
  | 'settings'
  | 'sales'
  | 'purchases'
  | 'inventory'
  | 'ai-assistant'
  | 'dev'
  | 'generic-placeholder';

function getActiveSectionFromPath(pathname: string): { section: ActiveSection; sub?: string } {
  const p = pathname;

  if (p === '/dev/apex-ledger' || p === '/dev/apex-ledger/') return { section: 'home' };
  if (p === '/dev/apex-ledger/accounting') return { section: 'accounting-overview' };
  if (p.startsWith('/dev/apex-ledger/coa')) return { section: 'coa' };
  if (p.startsWith('/dev/apex-ledger/vouchers')) return { section: 'vouchers' };
  if (p.startsWith('/dev/apex-ledger/approvals')) return { section: 'approvals' };
  if (p === '/dev/apex-ledger/settings') return { section: 'settings' };

  // Tools sub-pages
  const toolsMatch = p.match(/^\/dev\/apex-ledger\/tools\/(.+)$/);
  if (toolsMatch) return { section: 'tools-sub', sub: toolsMatch[1] };
  if (p === '/dev/apex-ledger/tools') return { section: 'tools' };

  // Reports sub-pages
  const reportsMatch = p.match(/^\/dev\/apex-ledger\/reports\/(.+)$/);
  if (reportsMatch) return { section: 'reports-sub', sub: reportsMatch[1] };
  if (p === '/dev/apex-ledger/reports') return { section: 'reports' };

  // Module roots
  if (p.startsWith('/dev/apex-ledger/sales')) return { section: 'sales' };
  if (p.startsWith('/dev/apex-ledger/purchases')) return { section: 'purchases' };
  if (p.startsWith('/dev/apex-ledger/inventory')) return { section: 'inventory' };
  if (p.startsWith('/dev/apex-ledger/ai')) return { section: 'ai-assistant' };
  if (p.startsWith('/dev/apex-ledger/dev')) return { section: 'dev' };

  // Other modules (HR, CRM, etc.) — show placeholder
  return { section: 'generic-placeholder' };
}

function getActiveTabFromSection(section: ActiveSection): string {
  switch (section) {
    case 'home': return 'home';
    case 'accounting-overview':
    case 'coa':
    case 'vouchers':
    case 'approvals':
    case 'reports':
    case 'reports-sub':
    case 'tools':
    case 'tools-sub':
    case 'settings':
      return 'accounting';
    case 'sales': return 'sales';
    case 'purchases': return 'purchases';
    case 'inventory': return 'inventory';
    case 'ai-assistant': return 'ai-assistant';
    case 'dev': return 'dev';
    default: return 'home';
  }
}

// Sub-tab for accounting section header
function getAccountingSubTabLabel(section: ActiveSection, sub?: string): string {
  switch (section) {
    case 'accounting-overview': return 'Overview';
    case 'coa': return 'Chart of Accounts';
    case 'vouchers': return 'Vouchers';
    case 'approvals': return 'Approval Center';
    case 'reports': return 'Reports';
    case 'reports-sub': return `Reports · ${sub}`;
    case 'tools': return 'Tools';
    case 'tools-sub': return `Tools · ${sub}`;
    case 'settings': return 'Settings';
    default: return '';
  }
}

export default function ApexLedgerDashboard() {
  const location = useLocation();
  const navigate = useNavigate();

  const { section: activeSection, sub: activeSub } = useMemo(
    () => getActiveSectionFromPath(location.pathname),
    [location.pathname]
  );
  const activeTab = useMemo(() => getActiveTabFromSection(activeSection), [activeSection]);

  const queryClient = useQueryClient();

  // --- Data queries ---
  const { data: rawAccounts = [] } = useQuery({
    queryKey: ['accounts'],
    queryFn: accountingApi.getAccounts
  });

  const { data: rawCustomers = [] } = useQuery({
    queryKey: ['parties', 'CUSTOMER'],
    queryFn: () => sharedApi.listParties({ role: 'CUSTOMER' })
  });

  const { data: rawVendors = [] } = useQuery({
    queryKey: ['parties', 'VENDOR'],
    queryFn: () => sharedApi.listParties({ role: 'VENDOR' })
  });

  const { data: rawInventory = [] } = useQuery({
    queryKey: ['inventoryItems'],
    queryFn: () => inventoryApi.listItems()
  });

  const { data: rawSalesOrders = [] } = useQuery({
    queryKey: ['salesOrders'],
    queryFn: () => salesApi.listSOs()
  });

  const { data: rawInvoices = [] } = useQuery({
    queryKey: ['salesInvoices'],
    queryFn: () => salesApi.listSIs()
  });

  const { data: rawBills = [] } = useQuery({
    queryKey: ['purchaseInvoices'],
    queryFn: () => purchasesApi.listPIs()
  });

  // --- Mappings ---
  const accounts = useMemo<COAAccount[]>(() => {
    if (rawAccounts.length === 0) return INITIAL_ACCOUNTS;
    return rawAccounts.map(a => ({
      id: a.id,
      code: a.userCode,
      name: a.name,
      type: ((a.classification || 'Asset').charAt(0).toUpperCase() + (a.classification || 'Asset').slice(1).toLowerCase()) as any,
      classification: a.accountRole === 'HEADER' ? 'Header' : 'Posting',
      currency: a.fixedCurrencyCode || 'SYP',
      parentId: a.parentId || null,
      balance: 0,
      isActive: a.status === 'ACTIVE'
    }));
  }, [rawAccounts]);

  const customers = useMemo<Customer[]>(() => {
    if (rawCustomers.length === 0) return INITIAL_CUSTOMERS;
    return rawCustomers.map(c => ({
      id: c.id,
      name: c.displayName || c.legalName,
      email: c.email || '',
      phone: c.phone || '',
      company: c.legalName,
      balance: c.creditLimit || 0
    }));
  }, [rawCustomers]);

  const vendors = useMemo<Vendor[]>(() => {
    if (rawVendors.length === 0) return INITIAL_VENDORS;
    return rawVendors.map(v => ({
      id: v.id,
      name: v.displayName || v.legalName,
      email: v.email || '',
      phone: v.phone || '',
      company: v.legalName,
      balance: 0
    }));
  }, [rawVendors]);

  const inventory = useMemo<InventoryItem[]>(() => {
    if (rawInventory.length === 0) return INITIAL_INVENTORY;
    return rawInventory.map(i => ({
      id: i.id,
      sku: i.code,
      name: i.name,
      category: i.baseUom || 'PCS',
      qtyOnHand: 100,
      avgCost: 10,
      salePrice: 15
    }));
  }, [rawInventory]);

  const invoices = useMemo<Invoice[]>(() => {
    if (rawInvoices.length === 0) return INITIAL_INVOICES;
    return rawInvoices.map(i => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      customerId: i.customerId,
      customerName: i.customerName,
      date: i.invoiceDate,
      dueDate: i.dueDate || i.invoiceDate,
      items: (i.lines || []).map((line, idx) => ({
        id: line.lineId || idx.toString(),
        productId: line.itemId,
        description: line.itemName || line.description || '',
        quantity: line.invoicedQty,
        unitPrice: line.unitPriceDoc,
        total: line.lineTotalDoc
      })),
      taxAmount: i.taxTotalDoc || 0,
      totalAmount: i.grandTotalDoc || 0,
      amountPaid: i.grandTotalDoc - (i.outstandingAmountBase || 0),
      status: i.status === 'POSTED' ? (i.paymentStatus === 'PAID' ? 'Paid' : 'Posted') : 'Draft',
      currency: i.currency || 'SYP'
    }));
  }, [rawInvoices]);

  const bills = useMemo<PurchaseBill[]>(() => {
    if (rawBills.length === 0) return INITIAL_PURCHASE_BILLS;
    return rawBills.map(b => ({
      id: b.id,
      billNumber: b.invoiceNumber,
      vendorId: b.vendorId,
      vendorName: b.vendorName,
      date: b.invoiceDate,
      dueDate: b.dueDate || b.invoiceDate,
      items: (b.lines || []).map((line, idx) => ({
        id: line.lineId || idx.toString(),
        productId: line.itemId,
        description: line.itemName || line.description || '',
        quantity: line.invoicedQty || 1,
        unitPrice: line.unitPriceDoc || 0,
        total: line.lineTotalDoc || 0
      })),
      taxAmount: b.taxTotalDoc || 0,
      totalAmount: b.grandTotalDoc || 0,
      status: b.status === 'POSTED' ? (b.paymentStatus === 'PAID' ? 'Paid' : 'Approved') : 'Draft',
      currency: b.currency || 'SYP'
    }));
  }, [rawBills]);

  const salesOrders = useMemo<SalesOrder[]>(() => {
    if (rawSalesOrders.length === 0) return INITIAL_SALES_ORDERS;
    return rawSalesOrders.map(s => ({
      id: s.id,
      soNumber: s.orderNumber,
      customerId: s.customerId,
      customerName: s.customerName,
      date: s.orderDate,
      items: (s.lines || []).map((line, idx) => ({
        id: line.lineId || idx.toString(),
        productId: line.itemId,
        description: line.itemName || line.description || '',
        quantity: line.orderedQty,
        unitPrice: line.unitPriceDoc,
        total: line.lineTotalDoc || (line.orderedQty * line.unitPriceDoc)
      })),
      taxAmount: s.taxTotalDoc || 0,
      totalAmount: s.grandTotalDoc || 0,
      status: s.status === 'CONFIRMED' ? 'Approved' : (s.status === 'FULLY_DELIVERED' || s.status === 'CLOSED' ? 'Invoiced' : 'Draft'),
      currency: s.currency || 'SYP'
    }));
  }, [rawSalesOrders]);

  const [darkMode, setDarkMode] = useState(false);

  // --- Mutations ---
  const createAccountMutation = useMutation({
    mutationFn: accountingApi.createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Account registered successfully in backend.');
    },
    onError: (err: any) => {
      toast.error(`Failed to register account: ${err.message || err}`);
    }
  });

  const handleSetAccounts = (updater: React.SetStateAction<COAAccount[]>) => {
    const currentMapped = accounts;
    const nextVal = typeof updater === 'function' ? updater(currentMapped) : updater;
    const added = nextVal.find(n => !currentMapped.some(c => c.id === n.id));
    if (added) {
      const payload = {
        userCode: added.code,
        name: added.name,
        parentId: added.parentId || null,
        accountRole: added.classification === 'Header' ? 'HEADER' : 'POSTING',
        classification: added.type.toUpperCase(),
        currencyPolicy: 'FIXED',
        fixedCurrencyCode: added.currency,
        balanceNature: added.type === 'Asset' || added.type === 'Expense' ? 'DEBIT' : 'CREDIT'
      };
      createAccountMutation.mutate(payload);
    }
  };

  const createInvoiceMutation = useMutation({
    mutationFn: salesApi.createSI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesInvoices'] });
      toast.success('Sales invoice saved successfully.');
    },
    onError: (err: any) => {
      toast.error(`Sales invoice save failed: ${err.message || err}`);
    }
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: any }) => salesApi.updateSI(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesInvoices'] });
      toast.success('Sales invoice updated successfully.');
    },
    onError: (err: any) => {
      toast.error(`Sales invoice update failed: ${err.message || err}`);
    }
  });

  const handleSetInvoices = (updater: React.SetStateAction<Invoice[]>) => {
    const currentMapped = invoices;
    const nextVal = typeof updater === 'function' ? updater(currentMapped) : updater;

    const added = nextVal.find(n => !currentMapped.some(c => c.id === n.id));
    if (added) {
      const payload = {
        customerId: added.customerId,
        invoiceDate: added.date,
        currency: added.currency || 'USD',
        exchangeRate: (added as any).exchangeRate || 1,
        lines: added.items.map((line: any) => ({
          itemId: line.productId,
          invoicedQty: line.quantity,
          unitPriceDoc: line.unitPrice,
          description: line.description || ''
        })),
        notes: (added as any).notes || ''
      };
      createInvoiceMutation.mutate(payload);
      return;
    }

    const deleted = currentMapped.find(c => !nextVal.some(n => n.id === c.id));
    if (deleted) {
      salesApi.deleteSI(deleted.id)
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['salesInvoices'] });
          toast.success('Sales invoice deleted successfully.');
        })
        .catch(err => {
          toast.error(`Failed to delete sales invoice: ${err.message || err}`);
        });
      return;
    }

    nextVal.forEach(n => {
      const original = currentMapped.find(c => c.id === n.id);
      if (original && JSON.stringify(original) !== JSON.stringify(n)) {
        const payload = {
          customerId: n.customerId,
          invoiceDate: n.date,
          currency: n.currency || 'USD',
          exchangeRate: (n as any).exchangeRate || 1,
          lines: n.items.map((line: any) => ({
            lineId: line.id,
            itemId: line.productId,
            invoicedQty: line.quantity,
            unitPriceDoc: line.unitPrice,
            description: line.description || ''
          })),
          notes: (n as any).notes || ''
        };
        updateInvoiceMutation.mutate({ id: n.id, payload });
      }
    });
  };

  const createSOMutation = useMutation({
    mutationFn: salesApi.createSO,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salesOrders'] });
      toast.success('Sales order created successfully.');
    },
    onError: (err: any) => {
      toast.error(`Sales order creation failed: ${err.message || err}`);
    }
  });

  const handleSetSalesOrders = (updater: React.SetStateAction<SalesOrder[]>) => {
    const currentMapped = salesOrders;
    const nextVal = typeof updater === 'function' ? updater(currentMapped) : updater;
    const added = nextVal.find(n => !currentMapped.some(c => c.id === n.id));
    if (added) {
      const payload = {
        customerId: added.customerId,
        orderDate: added.date,
        currency: added.currency || 'USD',
        exchangeRate: (added as any).exchangeRate || 1,
        lines: added.items.map((line: any) => ({
          itemId: line.productId,
          orderedQty: line.quantity,
          unitPriceDoc: line.unitPrice,
          description: line.description || ''
        })),
        notes: (added as any).notes || ''
      };
      createSOMutation.mutate(payload);
    }
  };

  const createPIMutation = useMutation({
    mutationFn: purchasesApi.createPI,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchaseInvoices'] });
      toast.success('Purchase bill saved successfully.');
    },
    onError: (err: any) => {
      toast.error(`Purchase bill save failed: ${err.message || err}`);
    }
  });

  const handleSetBills = (updater: React.SetStateAction<PurchaseBill[]>) => {
    const currentMapped = bills;
    const nextVal = typeof updater === 'function' ? updater(currentMapped) : updater;
    const added = nextVal.find(n => !currentMapped.some(c => c.id === n.id));
    if (added) {
      const payload = {
        vendorId: added.vendorId,
        invoiceDate: added.date,
        currency: added.currency || 'USD',
        exchangeRate: (added as any).exchangeRate || 1,
        lines: added.items.map((line: any) => ({
          itemId: line.productId,
          invoicedQty: line.quantity,
          unitPriceDoc: line.unitPrice,
          description: line.description || ''
        })),
        notes: (added as any).notes || ''
      };
      createPIMutation.mutate(payload);
    }
  };

  const createItemMutation = useMutation({
    mutationFn: inventoryApi.createItem,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] });
      toast.success('Inventory item created successfully.');
    },
    onError: (err: any) => {
      toast.error(`Item creation failed: ${err.message || err}`);
    }
  });

  const handleSetInventory = (updater: React.SetStateAction<InventoryItem[]>) => {
    const currentMapped = inventory;
    const nextVal = typeof updater === 'function' ? updater(currentMapped) : updater;
    const added = nextVal.find(n => !currentMapped.some(c => c.id === n.id));
    if (added) {
      const payload = {
        code: added.sku,
        name: added.name,
        type: 'PRODUCT' as const,
        baseUom: added.category || 'PCS',
        costCurrency: 'USD',
        costingMethod: 'MOVING_AVG' as const,
        trackInventory: true
      };
      createItemMutation.mutate(payload);
    }
  };

  const handleResetSystemData = () => {
    toast.error('Cannot reset live company data from the mockup developer panel.', { icon: '⚠️' });
  };

  // Sidebar setActiveTab bridge
  const handleTabChange = (tabId: string) => {
    // Already handled via navigate() in Sidebar, this is a passthrough
  };

  // --- Render content by active section ---
  const renderContent = () => {
    switch (activeSection) {
      case 'home':
        return (
          <DashboardHome
            accounts={accounts}
            invoices={invoices}
            bills={bills}
            setActiveTab={handleTabChange}
          />
        );

      case 'accounting-overview':
        return (
          <div className="space-y-5">
            <AccountingOverviewBento
              accounts={accounts}
              invoices={invoices}
              bills={bills}
              navigate={navigate}
            />
          </div>
        );

      case 'coa':
        return (
          <COASection
            accounts={accounts}
            setAccounts={handleSetAccounts}
          />
        );

      case 'vouchers':
        return <VoucherListSection />;

      case 'approvals':
        return <ApprovalCenterSection />;

      case 'reports':
        return <ReportsSection />;

      case 'reports-sub': {
        // Map slug → real Apex report component
        const reportComponents: Record<string, React.ReactNode> = {
          'trial-balance': <Suspense fallback={<ReportLoader />}><ApexTrialBalance /></Suspense>,
          'account-statement': <Suspense fallback={<ReportLoader />}><ApexAccountStatement /></Suspense>,
          'balance-sheet': <Suspense fallback={<ReportLoader />}><ApexBalanceSheet /></Suspense>,
          'profit-loss': <Suspense fallback={<ReportLoader />}><ApexProfitLoss /></Suspense>,
          'trading-account': <Suspense fallback={<ReportLoader />}><ApexTradingAccount /></Suspense>,
          'cash-flow': <Suspense fallback={<ReportLoader />}><ApexCashFlow /></Suspense>,
          'journal': <Suspense fallback={<ReportLoader />}><ApexJournal /></Suspense>,
          'aging': <Suspense fallback={<ReportLoader />}><ApexAging /></Suspense>,
          'bank-reconciliation': <Suspense fallback={<ReportLoader />}><ApexBankReconciliation /></Suspense>,
          'cost-center-summary': <Suspense fallback={<ReportLoader />}><ApexCostCenterSummary /></Suspense>,
          'budget-vs-actual': <Suspense fallback={<ReportLoader />}><ApexBudgetVsActual /></Suspense>,
          'consolidated-tb': <Suspense fallback={<ReportLoader />}><ApexConsolidatedTB /></Suspense>,
        };
        const comp = activeSub ? reportComponents[activeSub] : null;
        return comp ?? <ReportsSection activeSubReport={activeSub} />;
      }

      case 'tools':
        return <ToolsSection />;

      case 'tools-sub':
        return <ToolsSection activeTool={activeSub} />;

      case 'settings':
        return <Suspense fallback={<ReportLoader />}><ApexAccountingSettings /></Suspense>;

      case 'sales':
        return (
          <SalesSection
            salesOrders={salesOrders}
            setSalesOrders={handleSetSalesOrders}
            invoices={invoices}
            setInvoices={handleSetInvoices}
            customers={customers}
            inventory={inventory}
          />
        );

      case 'purchases':
        return (
          <PurchasesSection
            bills={bills}
            setBills={handleSetBills}
            vendors={vendors}
          />
        );

      case 'inventory':
        return (
          <InventorySection
            inventory={inventory}
            setInventory={handleSetInventory}
          />
        );

      case 'ai-assistant':
        return (
          <AIAssistantSection
            accounts={accounts}
            invoices={invoices}
            inventory={inventory}
          />
        );

      case 'dev':
        return (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-white p-6 rounded-lg border border-[#E2E8F0] shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-150 pb-3">
                <div>
                  <h2 className="font-bold text-sm text-slate-800 uppercase">Audit sandbox Developer Panel</h2>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Control live state databases, restore setups, or trigger direct API mock responses.</p>
                </div>
                <button
                  onClick={handleResetSystemData}
                  className="text-xs font-black text-rose-700 hover:text-white hover:bg-rose-600 border border-rose-300 rounded px-3 py-1.5 transition-all"
                >
                  Reset System Mock Database
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-50 p-4 rounded border border-slate-150">
                  <span className="font-bold text-zinc-400 block tracking-widest uppercase text-[9px] mb-1">State Record Counters</span>
                  <ul className="space-y-1.5 font-semibold text-slate-600 font-mono text-[11px]">
                    <li>· Accounts: {accounts.length}</li>
                    <li>· Customers: {customers.length}</li>
                    <li>· Inventory Items: {inventory.length}</li>
                    <li>· Active Sales Orders: {salesOrders.length}</li>
                    <li>· Issued Tax Invoices: {invoices.length}</li>
                  </ul>
                </div>
                <div className="bg-slate-50 p-4 rounded border border-slate-150">
                  <span className="font-bold text-zinc-400 block tracking-widest uppercase text-[9px] mb-1">Local Session Properties</span>
                  <ul className="space-y-1.5 font-semibold text-slate-650 font-mono text-[11px]">
                    <li>· NODE_ENV: {import.meta.env.MODE || 'development'}</li>
                    <li>· SERVER_PORT: 3000 / ingress proxy</li>
                    <li>· CORS_POLICY: origin_coupled_strict</li>
                    <li>· API_KEY: DEFAULT_SIMULATOR</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'generic-placeholder':
      default:
        return (
          <div className="bg-white border border-[#E2E8F0] rounded-lg p-10 text-center space-y-3 max-w-md mx-auto">
            <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto">
              <Settings className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-sm font-bold text-slate-700">Module Coming Soon</h3>
            <p className="text-xs text-slate-500">
              This module is part of the Apex roadmap and will be built in a future phase.
            </p>
            <p className="text-[10px] font-mono text-slate-400">{location.pathname}</p>
          </div>
        );
    }
  };

  // Build page title from section
  const getPageTitle = (): string => {
    switch (activeSection) {
      case 'home': return 'Dashboard';
      case 'accounting-overview': return 'Accounting Overview';
      case 'coa': return 'Chart of Accounts';
      case 'vouchers': return 'Vouchers Register';
      case 'approvals': return 'Approval Center';
      case 'reports': return 'Financial Reports';
      case 'reports-sub': return `Reports · ${activeSub}`;
      case 'tools': return 'Accounting Tools';
      case 'tools-sub': return `Tools · ${activeSub}`;
      case 'settings': return 'Accounting Settings';
      case 'sales': return 'Sales';
      case 'purchases': return 'Purchases';
      case 'inventory': return 'Inventory';
      case 'ai-assistant': return 'AI Assistant';
      case 'dev': return 'Developer Panel';
      default: return 'Apex Ledger';
    }
  };

  return (
    <div className={`min-h-screen flex bg-[#FAFAFB] text-[#0F172A] ${darkMode ? 'dark' : ''}`}>

      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={handleTabChange}
        accountsCount={accounts.length}
      />

      {/* Main Panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top Header */}
        <header className="h-12 bg-[#F8FAFC] border-b border-[#E2E8F0] px-4 flex items-center justify-between overflow-x-auto text-xs whitespace-nowrap flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-1.5 bg-white border border-[#E2E8F0] px-2.5 py-1 rounded">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-sans font-bold text-slate-700">asd syria</span>
            </div>

            <div className="flex items-center space-x-1 bg-white border border-[#E2E8F0] px-2.5 py-1 rounded text-[11px] font-semibold text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono">FY 2026</span>
            </div>

            <div className="flex items-center space-x-1 bg-white border border-[#E2E8F0] px-2.5 py-1 rounded text-[11px] font-semibold text-slate-600">
              <Coins className="w-3.5 h-3.5 text-slate-400" />
              <span className="font-mono text-xs font-bold text-slate-750">SYP</span>
            </div>

            <div className="bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold text-[10px] tracking-wide uppercase">
              FLEXIBLE
            </div>

            <div className="flex items-center space-x-1 bg-white border border-[#E2E8F0] px-2 py-0.5 rounded text-[10px] font-mono font-bold text-blue-600 uppercase">
              <Laptop className="w-3.5 h-3.5 text-blue-500" />
              <span>Win Web</span>
            </div>

            {/* Page title breadcrumb */}
            <div className="hidden md:flex items-center space-x-1 text-[11px] text-slate-500 border-l border-[#E2E8F0] pl-3 ml-1">
              <span className="font-semibold text-slate-700">{getPageTitle()}</span>
            </div>
          </div>

          <div className="flex items-center space-x-3 pr-2">
            <div className="relative w-44 md:w-52">
              <Search className="absolute left-2.5 top-1.5 w-3.5 h-3.5 text-zinc-400" />
              <input
                type="text"
                placeholder="Search commands... (Ctrl + G)"
                className="w-full bg-white border border-[#E2E8F0] rounded py-1 pl-7 pr-2 font-semibold text-[11px] outline-none placeholder-zinc-400"
              />
            </div>

            <button
              onClick={() => setDarkMode(!darkMode)}
              className="w-8 h-8 rounded hover:bg-slate-200/80 border border-[#E2E8F0] bg-white flex items-center justify-center transition-colors text-slate-600"
            >
              {darkMode ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-slate-500" />}
            </button>

            <button className="w-8 h-8 rounded hover:bg-slate-200/80 border border-[#E2E8F0] bg-white flex items-center justify-center relative transition-colors">
              <Bell className="w-4 h-4 text-slate-500" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500"></span>
            </button>

            <button
              onClick={() => navigate('/dev/apex-ledger/settings')}
              className="w-8 h-8 rounded hover:bg-slate-200/80 border border-[#E2E8F0] bg-white flex items-center justify-center transition-colors"
            >
              <Settings className="w-4 h-4 text-slate-500" />
            </button>

            <div className="w-[30px] h-[30px] rounded-full bg-blue-600 text-white flex items-center justify-center font-bold font-sans text-xs shadow-inner cursor-pointer">
              M
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-5 overflow-y-auto">
          <div className="max-w-7xl mx-auto w-full">
            {renderContent()}
          </div>
        </main>
      </div>
    </div>
  );
}

// --- Accounting Overview Bento ---
function AccountingOverviewBento({
  accounts,
  invoices,
  bills,
  navigate,
}: {
  accounts: COAAccount[];
  invoices: Invoice[];
  bills: PurchaseBill[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const totalInvoiced = invoices.reduce((s, i) => s + (i.totalAmount || 0), 0);
  const totalBills = bills.reduce((s, b) => s + (b.totalAmount || 0), 0);
  const postedInvoices = invoices.filter(i => i.status === 'Posted' || i.status === 'Paid').length;

  const quickLinks = [
    { label: 'Chart of Accounts', path: '/dev/apex-ledger/coa', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { label: 'Vouchers Register', path: '/dev/apex-ledger/vouchers', color: 'bg-violet-50 text-violet-700 border-violet-200' },
    { label: 'Approval Center', path: '/dev/apex-ledger/approvals', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Trial Balance', path: '/dev/apex-ledger/reports/trial-balance', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Balance Sheet', path: '/dev/apex-ledger/reports/balance-sheet', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { label: 'Profit & Loss', path: '/dev/apex-ledger/reports/profit-loss', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  ];

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Accounts', value: accounts.length.toString(), sub: 'in chart of accounts', color: 'text-blue-600' },
          { label: 'Sales Invoices', value: invoices.length.toString(), sub: `${postedInvoices} posted`, color: 'text-emerald-600' },
          { label: 'Purchase Bills', value: bills.length.toString(), sub: 'purchase invoices', color: 'text-violet-600' },
          { label: 'Net AR Position', value: `${(totalInvoiced - totalBills).toLocaleString('en', { maximumFractionDigits: 0 })}`, sub: 'estimated net', color: 'text-amber-600' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white border border-[#E2E8F0] rounded-lg p-4">
            <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block">{kpi.label}</span>
            <span className={`text-2xl font-black font-mono ${kpi.color} block mt-1`}>{kpi.value}</span>
            <span className="text-[10px] text-slate-500 mt-0.5 block">{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* Quick Links */}
      <div className="bg-white border border-[#E2E8F0] rounded-lg p-4">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Access</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {quickLinks.map((link, i) => (
            <button
              key={i}
              onClick={() => navigate(link.path)}
              className={`px-3 py-2 rounded-md border text-[10.5px] font-semibold text-left hover:opacity-80 transition-opacity ${link.color}`}
            >
              {link.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
