import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  BookOpen,
  Bot,
  Package,
  ShoppingCart,
  TrendingUp,
  Wrench,
  Terminal,
  ChevronRight,
  ChevronDown,
  ShieldCheck,
  Globe2,
  Users,
  BarChart3,
  Settings,
  LayoutDashboard,
  Book,
  FolderOpen,
  FileText,
  Receipt,
  Truck,
  Undo2,
  ScrollText,
  PieChart,
  Clock3,
  Landmark,
  Target,
  Scale,
  Layout,
  PiggyBank,
  Tags,
  Warehouse,
  PackagePlus,
  SlidersHorizontal,
  ArrowLeftRight,
  Layers,
  Repeat,
  AlertTriangle,
  CircleDollarSign,
  Coins,
  Tag,
  Ruler,
  Store,
  UserCheck,
  Users2,
  Percent,
  Monitor,
  Factory,
  Briefcase,
  CheckSquare,
  Folder,
  MessageSquare,
  Activity,
  FileSignature,
  BookMarked,
  BookMinus,
  Waves,
  ClipboardList,
  Calculator,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  accountsCount: number;
}

type SubItem = {
  label: string;
  path: string;
  icon: React.ComponentType<any>;
};

type MenuItem = {
  id: string;
  name: string;
  icon: React.ComponentType<any>;
  badge?: string | null;
  children?: SubItem[];
  path?: string;
};

const MODULES: MenuItem[] = [
  {
    id: 'home',
    name: 'HOME',
    icon: Home,
    path: '/dev/apex-ledger',
  },
  {
    id: 'accounting',
    name: 'ACCOUNTING',
    icon: BookOpen,
    children: [
      { label: 'Overview', path: '/dev/apex-ledger/accounting', icon: LayoutDashboard },
      { label: 'Chart of Accounts', path: '/dev/apex-ledger/coa', icon: Book },
      { label: 'Vouchers', path: '/dev/apex-ledger/vouchers', icon: FolderOpen },
      { label: 'Approval Center', path: '/dev/apex-ledger/approvals', icon: ShieldCheck },
      { label: '─── Reports', path: '/dev/apex-ledger/reports', icon: BarChart3 },
      { label: 'Trial Balance', path: '/dev/apex-ledger/reports/trial-balance', icon: BarChart3 },
      { label: 'Account Statement', path: '/dev/apex-ledger/reports/account-statement', icon: ScrollText },
      { label: 'Balance Sheet', path: '/dev/apex-ledger/reports/balance-sheet', icon: BookMinus },
      { label: 'General Ledger', path: '/dev/apex-ledger/reports/ledger', icon: BookOpen },
      { label: 'Profit & Loss', path: '/dev/apex-ledger/reports/profit-loss', icon: PieChart },
      { label: 'Trading Account', path: '/dev/apex-ledger/reports/trading-account', icon: BarChart3 },
      { label: 'Cash Flow', path: '/dev/apex-ledger/reports/cash-flow', icon: Waves },
      { label: 'Journal', path: '/dev/apex-ledger/reports/journal', icon: BookMarked },
      { label: 'Aging', path: '/dev/apex-ledger/reports/aging', icon: Clock3 },
      { label: 'Bank Reconciliation', path: '/dev/apex-ledger/reports/bank-reconciliation', icon: Landmark },
      { label: 'Cost Center Summary', path: '/dev/apex-ledger/reports/cost-center-summary', icon: Target },
      { label: 'Budget vs Actual', path: '/dev/apex-ledger/reports/budget-vs-actual', icon: Scale },
      { label: 'Consolidated TB', path: '/dev/apex-ledger/reports/consolidated-tb', icon: BarChart3 },
      { label: '─── Tools', path: '/dev/apex-ledger/tools', icon: Wrench },
      { label: 'Forms Management', path: '/dev/apex-ledger/tools/forms', icon: Layout },
      { label: 'Budgets', path: '/dev/apex-ledger/tools/budgets', icon: PiggyBank },
      { label: 'Subgroup Tagging', path: '/dev/apex-ledger/tools/subgroup-tagging', icon: Tags },
      { label: 'Settings', path: '/dev/apex-ledger/settings', icon: Settings },
    ],
  },
  {
    id: 'sales',
    name: 'SALES',
    icon: TrendingUp,
    children: [
      { label: 'Overview', path: '/dev/apex-ledger/sales', icon: LayoutDashboard },
      { label: 'Customers', path: '/dev/apex-ledger/sales/customers', icon: Users },
      { label: 'Products & Services', path: '/dev/apex-ledger/sales/items', icon: Package },
      { label: '─── Forms', path: '/dev/apex-ledger/sales/forms', icon: FolderOpen },
      { label: 'Quotations', path: '/dev/apex-ledger/sales/quotes', icon: FileText },
      { label: 'Sales Orders', path: '/dev/apex-ledger/sales/orders', icon: ShoppingCart },
      { label: 'Delivery Notes', path: '/dev/apex-ledger/sales/delivery-notes', icon: Truck },
      { label: 'Sales Invoices', path: '/dev/apex-ledger/sales/invoices', icon: Receipt },
      { label: 'Sales Returns', path: '/dev/apex-ledger/sales/returns', icon: Undo2 },
      { label: '─── Reports', path: '/dev/apex-ledger/sales/reports', icon: BarChart3 },
      { label: 'AR Aging', path: '/dev/apex-ledger/sales/reports/ar-aging', icon: Clock3 },
      { label: 'Customer Statement', path: '/dev/apex-ledger/sales/reports/customer-statement', icon: ScrollText },
      { label: 'Sales Analytics', path: '/dev/apex-ledger/sales/reports/analytics', icon: PieChart },
      { label: 'Aged Backlog', path: '/dev/apex-ledger/sales/reports/aged-backlog', icon: Clock3 },
      { label: '─── Tools', path: '/dev/apex-ledger/sales/tools', icon: Wrench },
      { label: 'Forms Management', path: '/dev/apex-ledger/sales/tools/forms', icon: Layout },
      { label: 'Customer Groups', path: '/dev/apex-ledger/sales/customer-groups', icon: Users2 },
      { label: 'Price Lists', path: '/dev/apex-ledger/sales/price-lists', icon: Tag },
      { label: 'Salespersons', path: '/dev/apex-ledger/sales/salespersons', icon: UserCheck },
      { label: 'Promotions', path: '/dev/apex-ledger/sales/promotions', icon: Percent },
      { label: 'Settings', path: '/dev/apex-ledger/sales/settings', icon: Settings },
    ],
  },
  {
    id: 'purchases',
    name: 'PURCHASES',
    icon: ClipboardList,
    children: [
      { label: 'Overview', path: '/dev/apex-ledger/purchases', icon: LayoutDashboard },
      { label: 'Vendors', path: '/dev/apex-ledger/purchases/vendors', icon: Store },
      { label: 'Products & Services', path: '/dev/apex-ledger/purchases/items', icon: Package },
      { label: '─── Forms', path: '/dev/apex-ledger/purchases/forms', icon: FolderOpen },
      { label: 'Purchase Orders', path: '/dev/apex-ledger/purchases/orders', icon: ShoppingCart },
      { label: 'Goods Receipts', path: '/dev/apex-ledger/purchases/goods-receipts', icon: Truck },
      { label: 'Purchase Invoices', path: '/dev/apex-ledger/purchases/invoices', icon: Receipt },
      { label: 'Purchase Returns', path: '/dev/apex-ledger/purchases/returns', icon: Undo2 },
      { label: '─── Reports', path: '/dev/apex-ledger/purchases/reports', icon: BarChart3 },
      { label: 'AP Aging', path: '/dev/apex-ledger/purchases/reports/ap-aging', icon: Clock3 },
      { label: 'Vendor Statement', path: '/dev/apex-ledger/purchases/reports/vendor-statement', icon: ScrollText },
      { label: 'Purchases Analytics', path: '/dev/apex-ledger/purchases/reports/analytics', icon: PieChart },
      { label: '─── Tools', path: '/dev/apex-ledger/purchases/tools', icon: Wrench },
      { label: 'Forms Management', path: '/dev/apex-ledger/purchases/tools/forms', icon: Layout },
      { label: 'Vendor Groups', path: '/dev/apex-ledger/purchases/vendor-groups', icon: Users2 },
      { label: 'Price Lists', path: '/dev/apex-ledger/purchases/price-lists', icon: Tag },
      { label: 'Settings', path: '/dev/apex-ledger/purchases/settings', icon: Settings },
    ],
  },
  {
    id: 'inventory',
    name: 'INVENTORY',
    icon: Package,
    children: [
      { label: 'Overview', path: '/dev/apex-ledger/inventory', icon: LayoutDashboard },
      { label: 'Items', path: '/dev/apex-ledger/inventory/items', icon: Package },
      { label: 'Warehouses', path: '/dev/apex-ledger/inventory/warehouses', icon: Warehouse },
      { label: '─── Forms', path: '/dev/apex-ledger/inventory/forms', icon: FolderOpen },
      { label: 'Opening Stock', path: '/dev/apex-ledger/inventory/opening-stock', icon: PackagePlus },
      { label: 'Adjustments', path: '/dev/apex-ledger/inventory/adjustments', icon: SlidersHorizontal },
      { label: 'Transfers', path: '/dev/apex-ledger/inventory/transfers', icon: ArrowLeftRight },
      { label: '─── Reports', path: '/dev/apex-ledger/inventory/reports', icon: BarChart3 },
      { label: 'Stock Levels', path: '/dev/apex-ledger/inventory/stock-levels', icon: Layers },
      { label: 'Movements', path: '/dev/apex-ledger/inventory/movements', icon: Repeat },
      { label: 'Low Stock Alerts', path: '/dev/apex-ledger/inventory/alerts', icon: AlertTriangle },
      { label: 'Unsettled Costs', path: '/dev/apex-ledger/inventory/unsettled-costs', icon: CircleDollarSign },
      { label: 'Inventory Valuation', path: '/dev/apex-ledger/inventory/valuation', icon: Coins },
      { label: '─── Tools', path: '/dev/apex-ledger/inventory/tools', icon: Wrench },
      { label: 'Categories', path: '/dev/apex-ledger/inventory/categories', icon: Tag },
      { label: 'UOM Master', path: '/dev/apex-ledger/inventory/uoms', icon: Ruler },
      { label: 'Settings', path: '/dev/apex-ledger/inventory/settings', icon: Settings },
    ],
  },
  {
    id: 'hr',
    name: 'HR',
    icon: Users,
    children: [
      { label: 'Employees', path: '/dev/apex-ledger/hr/employees', icon: UserCheck },
    ],
  },
  {
    id: 'crm',
    name: 'CRM',
    icon: Users2,
    children: [
      { label: 'Leads', path: '/dev/apex-ledger/crm/leads', icon: Target },
      { label: 'Customers', path: '/dev/apex-ledger/crm/customers', icon: Users },
    ],
  },
  {
    id: 'pos',
    name: 'POS',
    icon: Monitor,
    children: [
      { label: 'Terminal', path: '/dev/apex-ledger/pos', icon: Calculator },
    ],
  },
  {
    id: 'manufacturing',
    name: 'MANUFACTURING',
    icon: Factory,
    children: [
      { label: 'Work Orders', path: '/dev/apex-ledger/manufacturing/work-orders', icon: Wrench },
      { label: 'BOM', path: '/dev/apex-ledger/manufacturing/bom', icon: Layers },
    ],
  },
  {
    id: 'projects',
    name: 'PROJECTS',
    icon: Briefcase,
    children: [
      { label: 'Projects', path: '/dev/apex-ledger/projects', icon: Folder },
      { label: 'Tasks', path: '/dev/apex-ledger/projects/tasks', icon: CheckSquare },
    ],
  },
  {
    id: 'ai-assistant',
    name: 'AI ASSISTANT',
    icon: Bot,
    badge: 'PRO',
    children: [
      { label: 'Chat', path: '/dev/apex-ledger/ai', icon: MessageSquare },
      { label: 'AI Proposals', path: '/dev/apex-ledger/ai/proposals', icon: FileSignature },
      { label: 'AI Usage', path: '/dev/apex-ledger/ai/usage', icon: Activity },
      { label: 'Settings', path: '/dev/apex-ledger/ai/settings', icon: Settings },
    ],
  },
  {
    id: 'dev',
    name: 'DEV PANEL',
    icon: Terminal,
    path: '/dev/apex-ledger/dev',
  },
];

// Helper: which module should be expanded based on current path
function getActiveModuleFromPath(pathname: string): string {
  if (pathname === '/dev/apex-ledger' || pathname === '/dev/apex-ledger/') return 'home';
  if (pathname.startsWith('/dev/apex-ledger/coa')) return 'accounting';
  if (pathname.startsWith('/dev/apex-ledger/vouchers')) return 'accounting';
  if (pathname.startsWith('/dev/apex-ledger/approvals')) return 'accounting';
  if (pathname.startsWith('/dev/apex-ledger/reports')) return 'accounting';
  if (pathname.startsWith('/dev/apex-ledger/tools')) return 'accounting';
  if (pathname.startsWith('/dev/apex-ledger/settings')) return 'accounting';
  if (pathname.startsWith('/dev/apex-ledger/accounting')) return 'accounting';
  if (pathname.startsWith('/dev/apex-ledger/sales')) return 'sales';
  if (pathname.startsWith('/dev/apex-ledger/purchases')) return 'purchases';
  if (pathname.startsWith('/dev/apex-ledger/inventory')) return 'inventory';
  if (pathname.startsWith('/dev/apex-ledger/hr')) return 'hr';
  if (pathname.startsWith('/dev/apex-ledger/crm')) return 'crm';
  if (pathname.startsWith('/dev/apex-ledger/pos')) return 'pos';
  if (pathname.startsWith('/dev/apex-ledger/manufacturing')) return 'manufacturing';
  if (pathname.startsWith('/dev/apex-ledger/projects')) return 'projects';
  if (pathname.startsWith('/dev/apex-ledger/ai')) return 'ai-assistant';
  if (pathname.startsWith('/dev/apex-ledger/dev')) return 'dev';
  return 'home';
}

export default function Sidebar({ activeTab, setActiveTab, accountsCount }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const activeModule = getActiveModuleFromPath(currentPath);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(() => new Set([activeModule]));

  const toggleModule = (id: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleModuleClick = (item: MenuItem) => {
    if (item.children) {
      toggleModule(item.id);
      // Also navigate to default sub-path
      if (item.children[0]) navigate(item.children[0].path);
    } else if (item.path) {
      navigate(item.path);
    }
    setActiveTab(item.id);
  };

  const handleSubItemClick = (path: string, moduleId: string) => {
    // Separator lines are not clickable
    if (path.includes('─')) return;
    navigate(path);
    setActiveTab(moduleId);
  };

  const isSeparator = (label: string) => label.startsWith('─');

  return (
    <div className="w-56 bg-[#F8FAFC] border-r border-[#E2E8F0] flex flex-col h-full overflow-y-auto flex-shrink-0">
      {/* Branding / Logo */}
      <div className="px-4 py-3 border-b border-[#E2E8F0] bg-white flex items-center justify-between flex-shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="font-sans font-bold text-[11px] tracking-tight text-slate-800 block leading-tight">APEX LEDGER</span>
            <span className="text-[9px] font-mono text-slate-400 font-semibold block uppercase tracking-wider leading-tight">Enterprise OS</span>
          </div>
        </div>
        <div className="bg-emerald-50 text-emerald-700 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full border border-emerald-200">
          V1.8
        </div>
      </div>

      {/* Main Navigation */}
      <div className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        <span className="px-2 text-[9px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Modules</span>

        {MODULES.map((item) => {
          const Icon = item.icon;
          const isModuleActive = activeModule === item.id;
          const isExpanded = expandedModules.has(item.id);
          const hasChildren = !!item.children && item.children.length > 0;

          return (
            <div key={item.id}>
              {/* Module Header Button */}
              <button
                onClick={() => handleModuleClick(item)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md font-sans text-[11px] font-semibold tracking-wide transition-all duration-150 group ${
                  isModuleActive && !hasChildren
                    ? 'bg-blue-50 text-blue-600 border-l-2 border-blue-600 rounded-l-none'
                    : isModuleActive && hasChildren
                    ? 'bg-slate-100 text-slate-800'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-800'
                }`}
              >
                <div className="flex items-center space-x-2.5">
                  <Icon className={`w-3.5 h-3.5 transition-colors flex-shrink-0 ${isModuleActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
                  <span className="truncate">{item.name}</span>
                </div>
                <div className="flex items-center space-x-1 flex-shrink-0">
                  {item.badge && (
                    <span className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded-full ${
                      isModuleActive ? 'bg-blue-100 text-blue-700' : 'bg-slate-200/80 text-slate-500'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                  {hasChildren && (
                    isExpanded
                      ? <ChevronDown className="w-3 h-3 text-slate-400" />
                      : <ChevronRight className="w-3 h-3 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Sub-items */}
              {hasChildren && isExpanded && (
                <div className="ml-3 border-l border-[#E2E8F0] pl-2 mt-0.5 mb-1 space-y-0.5">
                  {item.children!.map((sub, idx) => {
                    if (isSeparator(sub.label)) {
                      const sectionLabel = sub.label.replace('─── ', '');
                      return (
                        <div key={idx} className="pt-2 pb-1">
                          <span className="text-[8.5px] font-mono font-black text-slate-400 uppercase tracking-widest pl-1 flex items-center gap-1">
                            <sub.icon className="w-2.5 h-2.5" />
                            {sectionLabel}
                          </span>
                        </div>
                      );
                    }

                    const SubIcon = sub.icon;
                    const isSubActive = currentPath === sub.path || currentPath.startsWith(sub.path + '/');

                    return (
                      <button
                        key={idx}
                        onClick={() => handleSubItemClick(sub.path, item.id)}
                        className={`w-full flex items-center space-x-2 px-2 py-1.5 rounded text-[10.5px] font-medium transition-all duration-100 text-left ${
                          isSubActive
                            ? 'bg-blue-50 text-blue-600 font-semibold'
                            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
                        }`}
                      >
                        <SubIcon className={`w-3 h-3 flex-shrink-0 ${isSubActive ? 'text-blue-500' : 'text-slate-400'}`} />
                        <span className="truncate">{sub.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[#E2E8F0] bg-white flex-shrink-0">
        <button
          onClick={() => navigate('/dev/apex-ledger/dev')}
          className="w-full flex items-center space-x-2.5 p-1.5 hover:bg-slate-100 rounded-lg transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold font-sans text-[10px] flex-shrink-0">
            MA
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-semibold text-slate-700 truncate block leading-tight">Mahmud Adem</span>
            <span className="text-[9px] font-mono text-slate-400 block truncate leading-tight flex items-center gap-1">
              <Globe2 className="w-2.5 h-2.5 text-blue-400 inline animate-pulse" /> asd syria (Local)
            </span>
          </div>
        </button>
      </div>
    </div>
  );
}
