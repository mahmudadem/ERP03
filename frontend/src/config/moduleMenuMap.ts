/**
 * moduleMenuMap.ts
 *
 * Module sidebars follow a uniform shape:
 *
 *   Overview
 *   [top-level high-frequency master data]   (Customers, Vendors, Items, ...)
 *   Forms          native list pages (the current full-featured surface)
 *   Default Forms  default voucher forms — emitted by useSidebarConfig
 *                  from the voucher_forms collection (see policy below)
 *   Reports        read-only analytics
 *   Tools          designers, configurators, low-frequency master data
 *   Settings       module-level config
 *
 * Sidebar form sources (see planning/tasks/native-to-default-forms-migration.md):
 *   - native forms  → entries below, list pages, current senior surface
 *   - default forms → grouped under "Default Forms" by useSidebarConfig
 *   - cloned forms  → user-chosen sidebarGroup; blank ⇒ root
 *
 * "Forms" was previously named "Documents".
 */
export const moduleMenuMap: Record<
  string,
  {
    label: string;
    icon: string;
    items: Array<{
      label: string;
      path?: string;
      permission?: string;
      icon?: string;
      hideInSimpleMode?: boolean;
      children?: Array<{ label: string; path: string; permission?: string; icon?: string; hideInSimpleMode?: boolean }>;
    }>;
  }
> = {
  accounting: {
    label: 'Accounting',
    icon: 'Landmark',
    items: [
      { label: 'Overview', path: '/accounting', icon: 'LayoutDashboard' },
      { label: 'Chart of Accounts', path: '/accounting/accounts', permission: 'accounting.accounts.view', icon: 'Book' },
      { label: 'Approval Center', path: '/accounting/approvals', permission: 'accounting.vouchers.view', icon: 'ShieldCheck' },
      {
        label: 'Reports',
        icon: 'BarChart3',
        children: [
          { label: 'Trial Balance', path: '/accounting/reports/trial-balance', permission: 'accounting.reports.trialBalance.view', icon: 'BarChart3' },
          { label: 'Account Statement', path: '/accounting/reports/account-statement', permission: 'accounting.reports.generalLedger.view', icon: 'ScrollText' },
          { label: 'Balance Sheet', path: '/accounting/reports/balance-sheet', permission: 'accounting.reports.balanceSheet.view', icon: 'BookMinus' },
          { label: 'General Ledger', path: '/accounting/reports/ledger', permission: 'accounting.reports.generalLedger.view', icon: 'BookOpen' },
          { label: 'Profit & Loss', path: '/accounting/reports/profit-loss', permission: 'accounting.reports.profitAndLoss.view', icon: 'PieChart' },
          { label: 'Trading Account', path: '/accounting/reports/trading-account', permission: 'accounting.reports.tradingAccount.view', icon: 'BarChart3' },
          { label: 'Cash Flow', path: '/accounting/reports/cash-flow', permission: 'accounting.reports.cashFlow.view', icon: 'Waves' },
          { label: 'Journal', path: '/accounting/reports/journal', permission: 'accounting.reports.generalLedger.view', icon: 'BookMarked' },
          { label: 'Aging', path: '/accounting/reports/aging', permission: 'accounting.reports.generalLedger.view', icon: 'Clock3' },
          { label: 'Bank Reconciliation', path: '/accounting/reports/bank-reconciliation', permission: 'accounting.reports.generalLedger.view', icon: 'Landmark' },
          { label: 'Cost Center Summary', path: '/accounting/reports/cost-center-summary', permission: 'accounting.reports.generalLedger.view', icon: 'Target' },
          { label: 'Budget vs Actual', path: '/accounting/reports/budget-vs-actual', permission: 'accounting.reports.trialBalance.view', icon: 'Scale' },
          { label: 'Consolidated TB', path: '/accounting/reports/consolidated-trial-balance', permission: 'accounting.reports.trialBalance.view', icon: 'BarChart3' },
        ],
      },
      {
        label: 'Tools',
        icon: 'Wrench',
        children: [
          { label: 'Forms Management', path: '/accounting/tools/voucher-designer', permission: 'accounting.settings.view', icon: 'Layout' },
          { label: 'Budgets', path: '/accounting/budgets', permission: 'accounting.settings.read', icon: 'PiggyBank' },
          { label: 'Subgroup Tagging', path: '/accounting/settings/subgroup-tagging', permission: 'accounting.accounts.edit', icon: 'Tags' },
        ],
      },
      { label: 'Settings', path: '/accounting/settings', permission: 'accounting.settings.view', icon: 'Settings' },
    ],
  },
  inventory: {
    label: 'Inventory',
    icon: 'Warehouse',
    items: [
      { label: 'Overview', path: '/inventory', icon: 'LayoutDashboard' },
      { label: 'Items', path: '/inventory/items', permission: 'inventory.items.manage', icon: 'Package' },
      { label: 'Warehouses', path: '/inventory/warehouses', permission: 'inventory.warehouses.view', icon: 'Warehouse' },
      {
        label: 'Forms',
        icon: 'FolderOpen',
        children: [
          { label: 'Opening Stock Documents', path: '/inventory/opening-stock', permission: 'inventory.movements.record', icon: 'PackagePlus' },
          { label: 'Adjustments', path: '/inventory/adjustments', permission: 'inventory.stock.adjust', icon: 'SlidersHorizontal' },
          { label: 'Revaluations', path: '/inventory/revaluations', permission: 'inventory.stock.adjust', icon: 'Scale' },
          { label: 'Transfers', path: '/inventory/transfers', permission: 'inventory.stock.adjust', icon: 'ArrowLeftRight' },
        ],
      },
      {
        label: 'Reports',
        icon: 'BarChart3',
        children: [
          { label: 'Stock Levels', path: '/inventory/stock-levels', permission: 'inventory.stock.view', icon: 'Layers' },
          { label: 'Movements', path: '/inventory/movements', permission: 'inventory.movements.view', icon: 'Repeat' },
          { label: 'Low Stock Alerts', path: '/inventory/alerts/low-stock', permission: 'inventory.stock.view', icon: 'AlertTriangle' },
          { label: 'Unsettled Costs', path: '/inventory/reports/unsettled-costs', permission: 'inventory.movements.view', icon: 'CircleDollarSign' },
          { label: 'Inventory Valuation', path: '/inventory/reports/valuation', permission: 'inventory.valuation.view', icon: 'Coins' },
          { label: 'Inventory GL Reconciliation', path: '/inventory/reports/gl-reconciliation', permission: 'inventory.valuation.view', icon: 'Scale' },
        ],
      },
      {
        label: 'Tools',
        icon: 'Wrench',
        children: [
          { label: 'Categories', path: '/inventory/categories', permission: 'inventory.categories.view', icon: 'Tag' },
          { label: 'UOM Master', path: '/inventory/uoms', permission: 'inventory.uom.view', icon: 'Ruler' },
        ],
      },
      { label: 'Settings', path: '/inventory/settings', permission: 'inventory.settings.manage', icon: 'Settings' },
    ],
  },
  sales: {
    label: 'Sales',
    icon: 'TrendingUp',
    items: [
      { label: 'Overview', path: '/sales', icon: 'LayoutDashboard' },
      { label: 'Customers', path: '/sales/customers', icon: 'Users' },
      { label: 'Products & Services', path: '/sales/items', icon: 'Package' },
      {
        label: 'Forms',
        icon: 'FolderOpen',
        children: [
          { label: 'Quotations', path: '/sales/quotes', icon: 'FileText' },
          { label: 'Sales Orders', path: '/sales/orders', icon: 'ShoppingCart', hideInSimpleMode: true },
          { label: 'Delivery Notes', path: '/sales/delivery-notes', icon: 'Truck', hideInSimpleMode: true },
          { label: 'Sales Invoices', path: '/sales/invoices', icon: 'Receipt' },
          { label: 'Sales Returns', path: '/sales/returns', icon: 'Undo2' },
        ],
      },
      {
        label: 'Reports',
        icon: 'BarChart3',
        children: [
          { label: 'AR Aging', path: '/sales/reports/ar-aging', icon: 'Clock3' },
          { label: 'Customer Statement', path: '/sales/reports/customer-statement', icon: 'ScrollText' },
          { label: 'Sales Analytics', path: '/sales/reports/sales-analytics', icon: 'PieChart' },
          { label: 'Aged Backlog', path: '/sales/aged-backlog', icon: 'Clock3' },
        ],
      },
      {
        label: 'Tools',
        icon: 'Wrench',
        children: [
          { label: 'Forms Management', path: '/sales/tools/voucher-designer', icon: 'Layout' },
          { label: 'Customer Groups', path: '/sales/customer-groups', icon: 'Users2' },
          { label: 'Price Lists', path: '/sales/price-lists', icon: 'Tag' },
          { label: 'Salespersons', path: '/sales/salespersons', icon: 'UserCheck' },
          { label: 'Promotions', path: '/sales/promotions', icon: 'Percent' },
        ],
      },
      { label: 'Settings', path: '/sales/settings', icon: 'Settings' },
    ],
  },
  purchase: {
    label: 'Purchases',
    icon: 'ClipboardList',
    items: [
      { label: 'Overview', path: '/purchases', icon: 'LayoutDashboard' },
      { label: 'Vendors', path: '/purchases/vendors', icon: 'Store' },
      { label: 'Products & Services', path: '/purchases/items', icon: 'Package' },
      {
        label: 'Forms',
        icon: 'FolderOpen',
        children: [
          { label: 'Purchase Orders', path: '/purchases/orders', icon: 'ShoppingCart', hideInSimpleMode: true },
          { label: 'Goods Receipts', path: '/purchases/goods-receipts', icon: 'Truck', hideInSimpleMode: true },
          { label: 'Purchase Invoices', path: '/purchases/invoices', icon: 'Receipt' },
          { label: 'Purchase Returns', path: '/purchases/returns', icon: 'Undo2' },
        ],
      },
      {
        label: 'Reports',
        icon: 'BarChart3',
        children: [
          { label: 'AP Aging', path: '/purchases/reports/ap-aging', icon: 'Clock3' },
          { label: 'Vendor Statement', path: '/purchases/reports/vendor-statement', icon: 'ScrollText' },
          { label: 'Purchases Analytics', path: '/purchases/reports/purchases-analytics', icon: 'PieChart' },
        ],
      },
      {
        label: 'Tools',
        icon: 'Wrench',
        children: [
          { label: 'Forms Management', path: '/purchases/tools/voucher-designer', icon: 'Layout' },
          { label: 'Vendor Groups', path: '/purchases/vendor-groups', icon: 'Users2' },
          { label: 'Price Lists', path: '/purchases/price-lists', icon: 'Tag' },
        ],
      },
      { label: 'Settings', path: '/purchases/settings', icon: 'Settings' },
    ],
  },
  hr: {
    label: 'HR',
    icon: 'Users',
    items: [
      { label: 'Employees', path: '/hr/employees', permission: 'hr.employees.view', icon: 'UserCheck' },
    ],
  },
  crm: {
    label: 'CRM',
    icon: 'HeartHandshake',
    items: [
      { label: 'Leads', path: '/crm/leads', permission: 'crm.leads.view', icon: 'Target' },
      { label: 'Customers', path: '/crm/customers', permission: 'crm.customers.view', icon: 'Users' },
    ],
  },
  pos: {
    label: 'POS',
    icon: 'Monitor',
    items: [
      { label: 'Terminal', path: '/pos', permission: 'pos.terminal.access', icon: 'Calculator' },
      { label: 'Shift', path: '/pos/shift', permission: 'pos.shift.open', icon: 'Clock' },
      { label: 'Returns', path: '/pos/returns', permission: 'pos.return.create', icon: 'Undo2' },
      { label: 'Registers', path: '/pos/registers', permission: 'pos.registers.manage', icon: 'MonitorSmartphone' },
      {
        label: 'Reports',
        icon: 'BarChart3',
        children: [
          { label: 'Z Report (by shift)', path: '/pos/reports/z', permission: 'pos.reports.view', icon: 'ReceiptText' },
          { label: 'Daily Summary', path: '/pos/reports/daily', permission: 'pos.reports.view', icon: 'CalendarDays' },
          { label: 'Payment Methods', path: '/pos/reports/payments', permission: 'pos.reports.view', icon: 'CreditCard' },
          { label: 'Cashier Sales', path: '/pos/reports/cashiers', permission: 'pos.reports.view', icon: 'Users' },
          { label: 'Cash Over/Short', path: '/pos/reports/over-short', permission: 'pos.reports.view', icon: 'Scale' },
          { label: 'Receipt History', path: '/pos/reports/receipts', permission: 'pos.reports.view', icon: 'History' },
          { label: 'Unsettled Costs', path: '/inventory/reports/unsettled-costs', permission: 'pos.reports.view', icon: 'CircleDollarSign' },
        ],
      },
      { label: 'Settings', path: '/pos/settings', permission: 'pos.settings.manage', icon: 'Settings' },
    ],
  },
  manufacturing: {
    label: 'Manufacturing',
    icon: 'Factory',
    items: [
      { label: 'Work Orders', path: '/manufacturing/work-orders', permission: 'manufacturing.workOrders.view', icon: 'Wrench' },
      { label: 'BOM', path: '/manufacturing/bom', permission: 'manufacturing.bom.view', icon: 'Layers' },
    ],
  },
  projects: {
    label: 'Projects',
    icon: 'Briefcase',
    items: [
      { label: 'Projects', path: '/projects', permission: 'projects.view', icon: 'Folder' },
      { label: 'Tasks', path: '/projects/tasks', permission: 'projects.tasks.view', icon: 'CheckSquare' },
    ],
  },
  tools: {
    label: 'Tools',
    icon: '2gears',
    items: [
      { label: 'Forms Designer', path: '/tools/forms-designer', icon: 'Layout' },
      { label: 'UI Lab 🎨', path: '/dev/ui-lab', icon: 'Sparkles' }
    ],
  },
  'ai-assistant': {
    label: 'AI Assistant',
    icon: 'Bot',
    items: [
      { label: 'Chat', path: '/ai-assistant', permission: 'ai-assistant.chat.use', icon: 'MessageSquare' },
      { label: 'AI Proposals', path: '/ai-assistant/proposals', permission: 'ai-assistant.proposals.view', icon: 'FileSignature' },
      { label: 'AI Usage', path: '/ai-assistant/usage', permission: 'ai-assistant.settings.view', icon: 'Activity' },
      { label: 'Settings', path: '/ai-assistant/settings', permission: 'ai-assistant.settings.view', icon: 'Settings' },
    ],
  },
};
