import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { useSidebarConfig } from '../../../../hooks/useSidebarConfig';
import { useTranslation } from 'react-i18next';
import { APEX_ROOT, tenantPathToApexPath } from '../routeMap';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  accountsCount: number;
}

type SidebarConfigItem = {
  label?: string;
  path?: string;
  icon?: string;
  badge?: string;
  children?: SidebarConfigItem[];
};

type SidebarSection = {
  path?: string;
  icon?: string;
  items?: SidebarConfigItem[];
};

type ApexSubItem = {
  label: string;
  path?: string;
  iconName: string;
  isSection?: boolean;
};

type ApexMenuItem = {
  id: string;
  name: string;
  iconName: string;
  badge?: string | null;
  children?: ApexSubItem[];
  path?: string;
};

const companySettingsChildren: ApexSubItem[] = [
  { label: 'Overview', path: tenantPathToApexPath('/company-admin/overview'), iconName: 'LayoutDashboard' },
  { label: 'Users', path: tenantPathToApexPath('/company-admin/users'), iconName: 'Users' },
  { label: 'Roles', path: tenantPathToApexPath('/company-admin/roles'), iconName: 'Shield' },
  { label: 'Modules', path: tenantPathToApexPath('/company-admin/modules'), iconName: 'Package' },
  { label: 'Features', path: tenantPathToApexPath('/company-admin/features'), iconName: 'Zap' },
  { label: 'Bundles', path: tenantPathToApexPath('/company-admin/bundles'), iconName: 'Layers' },
  { label: 'Currencies', path: tenantPathToApexPath('/system/currencies'), iconName: 'Coins' },
  { label: 'Tax Codes', path: tenantPathToApexPath('/settings/tax-codes'), iconName: 'Percent' },
  { label: 'Notifications', path: tenantPathToApexPath('/settings/notifications'), iconName: 'Bell' },
  { label: 'Communications', path: tenantPathToApexPath('/settings/communications'), iconName: 'MessageSquare' },
  { label: 'General Settings', path: tenantPathToApexPath('/company-admin/settings'), iconName: 'Settings' },
];

const companySettingsModule: ApexMenuItem = {
  id: 'company-settings',
  name: 'Company Settings',
  iconName: 'Settings',
  children: companySettingsChildren,
};

const APEX_MODULES: ApexMenuItem[] = [
  {
    id: 'home',
    name: 'HOME',
    iconName: 'Home',
    path: APEX_ROOT,
  },
  {
    id: 'accounting',
    name: 'ACCOUNTING',
    iconName: 'BookOpen',
    children: [
      { label: 'Overview', path: `${APEX_ROOT}/accounting`, iconName: 'LayoutDashboard' },
      { label: 'Chart of Accounts', path: `${APEX_ROOT}/coa`, iconName: 'Book' },
      { label: 'Vouchers', path: `${APEX_ROOT}/vouchers`, iconName: 'FolderOpen' },
      { label: 'Approval Center', path: `${APEX_ROOT}/approvals`, iconName: 'ShieldCheck' },
      { label: 'Reports', iconName: 'BarChart3', isSection: true },
      { label: 'Trial Balance', path: `${APEX_ROOT}/reports/trial-balance`, iconName: 'BarChart3' },
      { label: 'Account Statement', path: `${APEX_ROOT}/reports/account-statement`, iconName: 'ScrollText' },
      { label: 'Balance Sheet', path: `${APEX_ROOT}/reports/balance-sheet`, iconName: 'BookMinus' },
      { label: 'General Ledger', path: `${APEX_ROOT}/reports/ledger`, iconName: 'BookOpen' },
      { label: 'Profit & Loss', path: `${APEX_ROOT}/reports/profit-loss`, iconName: 'PieChart' },
      { label: 'Trading Account', path: `${APEX_ROOT}/reports/trading-account`, iconName: 'BarChart3' },
      { label: 'Cash Flow', path: `${APEX_ROOT}/reports/cash-flow`, iconName: 'Waves' },
      { label: 'Journal', path: `${APEX_ROOT}/reports/journal`, iconName: 'BookMarked' },
      { label: 'Aging', path: `${APEX_ROOT}/reports/aging`, iconName: 'Clock3' },
      { label: 'Bank Reconciliation', path: `${APEX_ROOT}/reports/bank-reconciliation`, iconName: 'Landmark' },
      { label: 'Cost Center Summary', path: `${APEX_ROOT}/reports/cost-center-summary`, iconName: 'Target' },
      { label: 'Budget vs Actual', path: `${APEX_ROOT}/reports/budget-vs-actual`, iconName: 'Scale' },
      { label: 'Consolidated TB', path: `${APEX_ROOT}/reports/consolidated-tb`, iconName: 'BarChart3' },
      { label: 'Tools', iconName: 'Wrench', isSection: true },
      { label: 'Forms Management', path: `${APEX_ROOT}/tools/forms`, iconName: 'Layout' },
      { label: 'Budgets', path: `${APEX_ROOT}/accounting/tools/budgets`, iconName: 'PiggyBank' },
      { label: 'Subgroup Tagging', path: `${APEX_ROOT}/accounting/tools/subgroup-tagging`, iconName: 'Tags' },
      { label: 'Settings', path: `${APEX_ROOT}/settings`, iconName: 'Settings' },
    ],
  },
  {
    id: 'sales',
    name: 'SALES',
    iconName: 'TrendingUp',
    children: [
      { label: 'Overview', path: `${APEX_ROOT}/sales`, iconName: 'LayoutDashboard' },
      { label: 'Customers', path: `${APEX_ROOT}/sales/customers`, iconName: 'Users' },
      { label: 'Products & Services', path: `${APEX_ROOT}/sales/items`, iconName: 'Package' },
      { label: 'Forms', iconName: 'FolderOpen', isSection: true },
      { label: 'Quotations', path: `${APEX_ROOT}/sales/quotes`, iconName: 'FileText' },
      { label: 'Sales Orders', path: `${APEX_ROOT}/sales/orders`, iconName: 'ShoppingCart' },
      { label: 'Delivery Notes', path: `${APEX_ROOT}/sales/delivery-notes`, iconName: 'Truck' },
      { label: 'Sales Invoices', path: `${APEX_ROOT}/sales/invoices`, iconName: 'Receipt' },
      { label: 'Sales Returns', path: `${APEX_ROOT}/sales/returns`, iconName: 'Undo2' },
      { label: 'Reports', iconName: 'BarChart3', isSection: true },
      { label: 'AR Aging', path: `${APEX_ROOT}/sales/reports/ar-aging`, iconName: 'Clock3' },
      { label: 'Customer Statement', path: `${APEX_ROOT}/sales/reports/customer-statement`, iconName: 'ScrollText' },
      { label: 'Sales Analytics', path: `${APEX_ROOT}/sales/reports/sales-analytics`, iconName: 'PieChart' },
      { label: 'Aged Backlog', path: `${APEX_ROOT}/sales/aged-backlog`, iconName: 'Clock3' },
      { label: 'Tools', iconName: 'Wrench', isSection: true },
      { label: 'Voucher Designer', path: `${APEX_ROOT}/sales/tools/voucher-designer`, iconName: 'Layout' },
      { label: 'Customer Groups', path: `${APEX_ROOT}/sales/customer-groups`, iconName: 'Users2' },
      { label: 'Price Lists', path: `${APEX_ROOT}/sales/price-lists`, iconName: 'Tag' },
      { label: 'Salespersons', path: `${APEX_ROOT}/sales/salespersons`, iconName: 'UserCheck' },
      { label: 'Promotions', path: `${APEX_ROOT}/sales/promotions`, iconName: 'Percent' },
      { label: 'Settings', path: `${APEX_ROOT}/sales/settings`, iconName: 'Settings' },
    ],
  },
  {
    id: 'purchases',
    name: 'PURCHASES',
    iconName: 'ClipboardList',
    children: [
      { label: 'Overview', path: `${APEX_ROOT}/purchases`, iconName: 'LayoutDashboard' },
      { label: 'Vendors', path: `${APEX_ROOT}/purchases/vendors`, iconName: 'Store' },
      { label: 'Products & Services', path: `${APEX_ROOT}/purchases/items`, iconName: 'Package' },
      { label: 'Forms', iconName: 'FolderOpen', isSection: true },
      { label: 'Purchase Orders', path: `${APEX_ROOT}/purchases/orders`, iconName: 'ShoppingCart' },
      { label: 'Goods Receipts', path: `${APEX_ROOT}/purchases/goods-receipts`, iconName: 'Truck' },
      { label: 'Purchase Invoices', path: `${APEX_ROOT}/purchases/invoices`, iconName: 'Receipt' },
      { label: 'Purchase Returns', path: `${APEX_ROOT}/purchases/returns`, iconName: 'Undo2' },
      { label: 'Reports', iconName: 'BarChart3', isSection: true },
      { label: 'AP Aging', path: `${APEX_ROOT}/purchases/reports/ap-aging`, iconName: 'Clock3' },
      { label: 'Vendor Statement', path: `${APEX_ROOT}/purchases/reports/vendor-statement`, iconName: 'ScrollText' },
      { label: 'Purchases Analytics', path: `${APEX_ROOT}/purchases/reports/purchases-analytics`, iconName: 'PieChart' },
      { label: 'Tools', iconName: 'Wrench', isSection: true },
      { label: 'Voucher Designer', path: `${APEX_ROOT}/purchases/tools/voucher-designer`, iconName: 'Layout' },
      { label: 'Vendor Groups', path: `${APEX_ROOT}/purchases/vendor-groups`, iconName: 'Users2' },
      { label: 'Price Lists', path: `${APEX_ROOT}/purchases/price-lists`, iconName: 'Tag' },
      { label: 'Settings', path: `${APEX_ROOT}/purchases/settings`, iconName: 'Settings' },
    ],
  },
  {
    id: 'inventory',
    name: 'INVENTORY',
    iconName: 'Package',
    children: [
      { label: 'Overview', path: `${APEX_ROOT}/inventory`, iconName: 'LayoutDashboard' },
      { label: 'Items', path: `${APEX_ROOT}/inventory/items`, iconName: 'Package' },
      { label: 'Warehouses', path: `${APEX_ROOT}/inventory/warehouses`, iconName: 'Warehouse' },
      { label: 'Forms', iconName: 'FolderOpen', isSection: true },
      { label: 'Opening Stock', path: `${APEX_ROOT}/inventory/opening-stock`, iconName: 'PackagePlus' },
      { label: 'Adjustments', path: `${APEX_ROOT}/inventory/adjustments`, iconName: 'SlidersHorizontal' },
      { label: 'Transfers', path: `${APEX_ROOT}/inventory/transfers`, iconName: 'ArrowLeftRight' },
      { label: 'Reports', iconName: 'BarChart3', isSection: true },
      { label: 'Stock Levels', path: `${APEX_ROOT}/inventory/stock-levels`, iconName: 'Layers' },
      { label: 'Movements', path: `${APEX_ROOT}/inventory/movements`, iconName: 'Repeat' },
      { label: 'Low Stock Alerts', path: `${APEX_ROOT}/inventory/alerts/low-stock`, iconName: 'AlertTriangle' },
      { label: 'Unsettled Costs', path: `${APEX_ROOT}/inventory/reports/unsettled-costs`, iconName: 'CircleDollarSign' },
      { label: 'Inventory Valuation', path: `${APEX_ROOT}/inventory/reports/valuation`, iconName: 'Coins' },
      { label: 'Tools', iconName: 'Wrench', isSection: true },
      { label: 'Categories', path: `${APEX_ROOT}/inventory/categories`, iconName: 'Tag' },
      { label: 'UOM Master', path: `${APEX_ROOT}/inventory/uoms`, iconName: 'Ruler' },
      { label: 'Settings', path: `${APEX_ROOT}/inventory/settings`, iconName: 'Settings' },
    ],
  },
  {
    id: 'hr',
    name: 'HR',
    iconName: 'Users',
    children: [
      { label: 'Employees', path: `${APEX_ROOT}/hr/employees`, iconName: 'UserCheck' },
    ],
  },
  {
    id: 'crm',
    name: 'CRM',
    iconName: 'Users2',
    children: [
      { label: 'Leads', path: `${APEX_ROOT}/crm/leads`, iconName: 'Target' },
      { label: 'Customers', path: `${APEX_ROOT}/crm/customers`, iconName: 'Users' },
    ],
  },
  {
    id: 'pos',
    name: 'POS',
    iconName: 'Monitor',
    children: [
      { label: 'Terminal', path: `${APEX_ROOT}/pos`, iconName: 'Calculator' },
    ],
  },
  {
    id: 'manufacturing',
    name: 'MANUFACTURING',
    iconName: 'Factory',
    children: [
      { label: 'Work Orders', path: `${APEX_ROOT}/manufacturing/work-orders`, iconName: 'Wrench' },
      { label: 'BOM', path: `${APEX_ROOT}/manufacturing/bom`, iconName: 'Layers' },
    ],
  },
  {
    id: 'projects',
    name: 'PROJECTS',
    iconName: 'Briefcase',
    children: [
      { label: 'Projects', path: `${APEX_ROOT}/projects`, iconName: 'Folder' },
      { label: 'Tasks', path: `${APEX_ROOT}/projects/tasks`, iconName: 'CheckSquare' },
    ],
  },
  {
    id: 'ai-assistant',
    name: 'AI ASSISTANT',
    iconName: 'Bot',
    badge: 'PRO',
    children: [
      { label: 'Chat', path: `${APEX_ROOT}/ai`, iconName: 'MessageSquare' },
      { label: 'AI Proposals', path: `${APEX_ROOT}/ai/proposals`, iconName: 'FileSignature' },
      { label: 'AI Usage', path: `${APEX_ROOT}/ai/usage`, iconName: 'Activity' },
      { label: 'Settings', path: `${APEX_ROOT}/ai/settings`, iconName: 'Settings' },
    ],
  },
];

const labelKeyMap: Record<string, string> = {
  // Modules
  'HOME': 'sidebar.overview',
  'ACCOUNTING': 'sidebar.accounting',
  'SALES': 'sidebar.sales',
  'PURCHASES': 'sidebar.purchases',
  'INVENTORY': 'sidebar.inventory',
  'HR': 'sidebar.hr',
  'CRM': 'sidebar.crm',
  'POS': 'sidebar.pos',
  'MANUFACTURING': 'sidebar.manufacturing',
  'PROJECTS': 'sidebar.projects',
  'AI ASSISTANT': 'sidebar.aiAssistant',
  'Company Settings': 'sidebar.companySettings',

  // Section Headers & Submenus
  'Overview': 'sidebar.overview',
  'Chart of Accounts': 'sidebar.chartOfAccounts',
  'Vouchers': 'sidebar.vouchers',
  'Approval Center': 'sidebar.approvalCenter',
  'Reports': 'sidebar.reports',
  'Trial Balance': 'sidebar.trialBalance',
  'Account Statement': 'sidebar.accountStatement',
  'Balance Sheet': 'sidebar.balanceSheet',
  'General Ledger': 'sidebar.generalLedger',
  'Profit & Loss': 'sidebar.profitLoss',
  'Trading Account': 'sidebar.tradingAccount',
  'Cash Flow': 'sidebar.cashFlow',
  'Journal': 'sidebar.journal',
  'Aging': 'sidebar.aging',
  'Bank Reconciliation': 'sidebar.bankReconciliation',
  'Cost Center Summary': 'sidebar.costCenterSummary',
  'Budget vs Actual': 'sidebar.budgetVsActual',
  'Consolidated TB': 'sidebar.consolidatedTB',
  'Tools': 'sidebar.tools',
  'Forms Management': 'sidebar.forms',
  'Budgets': 'sidebar.budgets',
  'Subgroup Tagging': 'sidebar.subgroupTagging',
  'Settings': 'sidebar.settings',
  'Customers': 'sidebar.customers',
  'Products & Services': 'sidebar.items',
  'Forms': 'sidebar.forms',
  'Quotations': 'sidebar.quotations',
  'Sales Orders': 'sidebar.salesOrders',
  'Delivery Notes': 'sidebar.deliveryNotes',
  'Sales Invoices': 'sidebar.salesInvoices',
  'Sales Returns': 'sidebar.salesReturns',
  'AR Aging': 'sidebar.arAging',
  'Customer Statement': 'sidebar.customerStatement',
  'Sales Analytics': 'sidebar.salesAnalytics',
  'Aged Backlog': 'sidebar.agedBacklog',
  'Customer Groups': 'sidebar.customerGroups',
  'Price Lists': 'sidebar.priceLists',
  'Salespersons': 'sidebar.salespersons',
  'Promotions': 'sidebar.promotions',
  'Vendors': 'sidebar.vendors',
  'Purchase Orders': 'sidebar.purchaseOrders',
  'Goods Receipts': 'sidebar.goodsReceipts',
  'Purchase Invoices': 'sidebar.purchaseInvoices',
  'Purchase Returns': 'sidebar.purchaseReturns',
  'AP Aging': 'sidebar.apAging',
  'Vendor Statement': 'sidebar.vendorStatement',
  'Purchases Analytics': 'sidebar.purchasesAnalytics',
  'Vendor Groups': 'sidebar.vendorGroups',
  'Items': 'sidebar.items',
  'Warehouses': 'sidebar.warehouses',
  'Opening Stock': 'sidebar.openingStock',
  'Adjustments': 'sidebar.adjustments',
  'Transfers': 'sidebar.transfers',
  'Stock Levels': 'sidebar.stockLevels',
  'Movements': 'sidebar.movements',
  'Low Stock Alerts': 'sidebar.lowStockAlerts',
  'Unsettled Costs': 'sidebar.unsettledCosts',
  'Inventory Valuation': 'sidebar.inventoryValuation',
  'Categories': 'sidebar.categories',
  'UOM Master': 'sidebar.uomMaster',
  'Employees': 'sidebar.employees',
  'Leads': 'sidebar.leads',
  'Terminal': 'sidebar.terminal',
  'Work Orders': 'sidebar.workOrders',
  'BOM': 'sidebar.bom',
  'Tasks': 'sidebar.tasks',
  'Chat': 'sidebar.chat',
  'AI Proposals': 'sidebar.aiProposals',
  'AI Usage': 'sidebar.aiUsage',
  'Users': 'sidebar.users',
  'Roles': 'sidebar.roles',
  'Modules': 'sidebar.modules',
  'Features': 'sidebar.features',
  'Bundles': 'sidebar.bundles',
  'Notifications': 'sidebar.notifications',
  'Communications': 'sidebar.communications',
  'General Settings': 'sidebar.generalSettings',
};

const getIcon = (iconName: string): React.ElementType => {
  const iconMap = Icons as unknown as Record<string, React.ElementType>;
  return iconMap[iconName] || Icons.Circle;
};

const inferModuleFromTenantPath = (path?: string): string | null => {
  if (!path) return null;
  if (path === '/') return 'home';
  if (path.startsWith('/accounting')) return 'accounting';
  if (path.startsWith('/sales')) return 'sales';
  if (path.startsWith('/purchases')) return 'purchases';
  if (path.startsWith('/inventory')) return 'inventory';
  if (path.startsWith('/hr')) return 'hr';
  if (path.startsWith('/crm')) return 'crm';
  if (path.startsWith('/pos')) return 'pos';
  if (path.startsWith('/manufacturing')) return 'manufacturing';
  if (path.startsWith('/projects')) return 'projects';
  if (path.startsWith('/ai-assistant')) return 'ai-assistant';
  if (path.startsWith('/tools')) return 'tools';
  if (path.startsWith('/company-admin')) return 'company-settings';
  if (path === '/system/currencies') return 'company-settings';
  if (
    path === '/settings/tax-codes' ||
    path === '/settings/notifications' ||
    path === '/settings/communications'
  ) return 'company-settings';
  return null;
};

const inferModuleFromApexPath = (path?: string): string | null => {
  if (!path) return null;
  if (path === APEX_ROOT || path === `${APEX_ROOT}/`) return 'home';
  if (
    path.startsWith(`${APEX_ROOT}/coa`) ||
    path.startsWith(`${APEX_ROOT}/vouchers`) ||
    path.startsWith(`${APEX_ROOT}/approvals`) ||
    path.startsWith(`${APEX_ROOT}/reports`) ||
    path.startsWith(`${APEX_ROOT}/accounting`)
  ) return 'accounting';
  if (path.startsWith(`${APEX_ROOT}/settings`)) return 'accounting';
  if (path.startsWith(`${APEX_ROOT}/sales`)) return 'sales';
  if (path.startsWith(`${APEX_ROOT}/purchases`)) return 'purchases';
  if (path.startsWith(`${APEX_ROOT}/inventory`)) return 'inventory';
  if (path.startsWith(`${APEX_ROOT}/hr`)) return 'hr';
  if (path.startsWith(`${APEX_ROOT}/crm`)) return 'crm';
  if (path.startsWith(`${APEX_ROOT}/pos`)) return 'pos';
  if (path.startsWith(`${APEX_ROOT}/manufacturing`)) return 'manufacturing';
  if (path.startsWith(`${APEX_ROOT}/projects`)) return 'projects';
  if (path.startsWith(`${APEX_ROOT}/ai`)) return 'ai-assistant';
  if (path.startsWith(`${APEX_ROOT}/tools`)) return 'tools';
  if (path.startsWith(`${APEX_ROOT}/company-admin`)) return 'company-settings';
  if (path === `${APEX_ROOT}/system/currencies`) return 'company-settings';
  if (
    path === `${APEX_ROOT}/settings/tax-codes` ||
    path === `${APEX_ROOT}/settings/notifications` ||
    path === `${APEX_ROOT}/settings/communications`
  ) return 'company-settings';
  return null;
};

const inferModuleFromSection = (section: SidebarSection): string | null => {
  const fromSectionPath = inferModuleFromTenantPath(section.path);
  if (fromSectionPath) return fromSectionPath;

  const findFirstPath = (items?: SidebarConfigItem[]): string | undefined => {
    for (const item of items || []) {
      if (item.path) return item.path;
      const childPath = findFirstPath(item.children);
      if (childPath) return childPath;
    }
    return undefined;
  };

  return inferModuleFromTenantPath(findFirstPath(section.items));
};

const getActiveModuleFromPath = (pathname: string): string => {
  return inferModuleFromApexPath(pathname) || 'home';
};

const toApexChildren = (items: SidebarConfigItem[] = []): ApexSubItem[] => {
  return items.flatMap((item): ApexSubItem[] => {
    const iconName = item.icon || (item.children?.length ? 'FolderOpen' : 'Circle');

    if (item.children?.length) {
      return [
        {
          label: item.label || '',
          iconName,
          isSection: true,
        },
        ...toApexChildren(item.children),
      ];
    }

    const apexPath = tenantPathToApexPath(item.path);
    if (!apexPath) return [];

    return [{
      label: item.label || '',
      path: apexPath,
      iconName,
    }];
  });
};

const buildApexModulesFromSidebarSections = (sections: Record<string, SidebarSection>): ApexMenuItem[] => {
  return Object.entries(sections).reduce<ApexMenuItem[]>((modules, [sectionLabel, section]) => {
    const id = inferModuleFromSection(section);
    if (!id) return modules;

    const children = toApexChildren(section.items);
    const sectionPath = tenantPathToApexPath(section.path);

    modules.push({
      id,
      name: sectionLabel,
      iconName: section.icon || 'LayoutGrid',
      badge: id === 'ai-assistant' ? 'PRO' : null,
      path: children.length > 0 ? undefined : sectionPath,
      children: children.length > 0 ? children : undefined,
    });

    return modules;
  }, []);
};

export default function Sidebar({ setActiveTab }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const sections = useSidebarConfig() as Record<string, SidebarSection>;
  const { t } = useTranslation();

  const modules = useMemo(() => {
    return buildApexModulesFromSidebarSections(sections);
  }, [sections]);

  const activeModule = getActiveModuleFromPath(currentPath);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => new Set([activeModule]));

  const toggleModule = (id: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleModuleClick = (item: ApexMenuItem) => {
    if (item.children) {
      toggleModule(item.id);
      const firstPath = item.children.find((child) => child.path)?.path;
      if (firstPath) navigate(firstPath);
    } else if (item.path) {
      navigate(item.path);
    }
    setActiveTab(item.id);
  };

  const handleSubItemClick = (path: string, moduleId: string) => {
    navigate(path);
    setActiveTab(moduleId);
  };

  const isCompanySettingsActive = activeModule === companySettingsModule.id;
  const isCompanySettingsExpanded = expandedModules.has(companySettingsModule.id);
  const CompanySettingsIcon = getIcon(companySettingsModule.iconName);

  return (
    <div className="w-64 bg-[#F8FAFC] border-r rtl:border-r-0 rtl:border-l border-[#E2E8F0] flex flex-col h-screen min-h-screen overflow-hidden flex-shrink-0">
      <div className="p-4 border-b border-[#E2E8F0] bg-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <Icons.ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-sans font-bold text-sm tracking-tight text-slate-800 block leading-tight">{t(`APEX LEDGER`)}</span>
            <span className="text-[10px] font-mono text-slate-400 font-semibold block uppercase tracking-wider leading-tight">
              {t('sidebar.enterpriseOS', { defaultValue: 'Enterprise OS' })}
            </span>
          </div>
        </div>
        <div className="bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border border-emerald-200">
          V1.8
        </div>
      </div>

      <div className="flex-1 min-h-0 px-3 py-4 overflow-y-auto space-y-1">
        <span className="px-3 text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-2">
          {t('sidebar.modules', { defaultValue: 'Modules' })}
        </span>

        {modules.map((item) => {
          const Icon = getIcon(item.iconName);
          const isModuleActive = activeModule === item.id;
          const isExpanded = expandedModules.has(item.id);
          const hasChildren = !!item.children && item.children.length > 0;

          return (
            <div key={item.id}>
              <button
                onClick={() => handleModuleClick(item)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md font-sans text-xs font-semibold tracking-wide transition-all duration-150 group ${
                  isModuleActive && !hasChildren
                    ? 'bg-blue-50 text-blue-600 border-l-4 rtl:border-l-0 rtl:border-r-4 border-blue-600 rounded-l-none rtl:rounded-l-md rtl:rounded-r-none'
                    : isModuleActive && hasChildren
                      ? 'bg-slate-100 text-slate-800'
                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-800'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className={`w-4 h-4 transition-colors flex-shrink-0 ${isModuleActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  <span className="truncate">
                    {t(labelKeyMap[item.name] || item.name, { defaultValue: item.name })}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {item.badge && (
                    <span className={`text-[9px] font-bold font-mono px-1.5 py-0.5 rounded-full ${
                      isModuleActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-200/80 text-slate-500'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {hasChildren && (
                    isExpanded
                      ? <Icons.ChevronDown className="w-3 h-3 text-slate-400" />
                      : <Icons.ChevronRight className="w-3 h-3 text-slate-400 rtl:rotate-180" />
                  )}
                </div>
              </button>

              {hasChildren && isExpanded && (
                <div className="ml-4 rtl:ml-0 rtl:mr-4 border-l rtl:border-l-0 rtl:border-r border-[#E2E8F0] pl-2.5 rtl:pl-0 rtl:pr-2.5 mt-1 mb-2 space-y-1">
                  {item.children!.map((sub, idx) => {
                    const SubIcon = getIcon(sub.iconName);
                    if (sub.isSection) {
                      return (
                        <div key={`${item.id}-${sub.label}-${idx}`} className="pt-2 pb-1">
                          <span className="text-[9px] font-mono font-black text-slate-400 uppercase tracking-widest pl-1 rtl:pl-0 rtl:pr-1 flex items-center gap-1.5">
                            <SubIcon className="w-3 h-3" />
                            {t(labelKeyMap[sub.label] || sub.label, { defaultValue: sub.label })}
                          </span>
                        </div>
                      );
                    }

                    const isSubActive = !!sub.path && (currentPath === sub.path || currentPath.startsWith(`${sub.path}/`));

                    return (
                      <button
                        key={`${item.id}-${sub.path}-${idx}`}
                        onClick={() => sub.path && handleSubItemClick(sub.path, item.id)}
                        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-[11px] font-medium transition-all duration-100 text-left rtl:text-right ${
                          isSubActive
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        <SubIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isSubActive ? 'text-blue-500' : 'text-slate-400'}`} />
                        <span className="truncate">
                          {t(labelKeyMap[sub.label] || sub.label, { defaultValue: sub.label })}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-3 border-t border-[#E2E8F0] bg-white flex-shrink-0">
        <button
          onClick={() => handleModuleClick(companySettingsModule)}
          className={`w-full flex items-center justify-between px-3 py-2.5 rounded-md font-sans text-xs font-semibold tracking-wide transition-all duration-150 group ${
            isCompanySettingsActive
              ? 'bg-slate-100 text-slate-800'
              : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <CompanySettingsIcon className={`w-4 h-4 transition-colors flex-shrink-0 ${isCompanySettingsActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            <span className="truncate">
              {t(labelKeyMap[companySettingsModule.name], { defaultValue: companySettingsModule.name })}
            </span>
          </div>
          {isCompanySettingsExpanded
            ? <Icons.ChevronDown className="w-3 h-3 text-slate-400" />
            : <Icons.ChevronRight className="w-3 h-3 text-slate-400 rtl:rotate-180" />
          }
        </button>

        {isCompanySettingsExpanded && (
          <div className="ml-4 rtl:ml-0 rtl:mr-4 border-l rtl:border-l-0 rtl:border-r border-[#E2E8F0] pl-2.5 rtl:pl-0 rtl:pr-2.5 mt-1 space-y-1">
            {companySettingsModule.children!.map((sub, idx) => {
              const SubIcon = getIcon(sub.iconName);
              const isSubActive = !!sub.path && (currentPath === sub.path || currentPath.startsWith(`${sub.path}/`));

              return (
                <button
                  key={`${companySettingsModule.id}-${sub.path}-${idx}`}
                  onClick={() => sub.path && handleSubItemClick(sub.path, companySettingsModule.id)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded text-[11px] font-medium transition-all duration-100 text-left rtl:text-right ${
                    isSubActive
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                  }`}
                >
                  <SubIcon className={`w-3.5 h-3.5 flex-shrink-0 ${isSubActive ? 'text-blue-500' : 'text-slate-400'}`} />
                  <span className="truncate">
                    {t(labelKeyMap[sub.label] || sub.label, { defaultValue: sub.label })}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
