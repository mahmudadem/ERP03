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
      children?: Array<{ label: string; path: string; permission?: string; icon?: string }>;
    }>;
  }
> = {
  accounting: {
    label: 'Accounting',
    icon: 'Calculator',
    items: [
      { label: 'Overview', path: '/accounting', icon: 'LayoutDashboard' },
      { label: 'Chart of Accounts', path: '/accounting/accounts', permission: 'accounting.accounts.view', icon: 'Book' },
      { label: 'Subgroup Tagging', path: '/accounting/settings/subgroup-tagging', permission: 'accounting.accounts.edit', icon: 'Tags' },
      { label: 'Budgets', path: '/accounting/budgets', permission: 'accounting.settings.read', icon: 'PiggyBank' },
      { label: 'Approval Center', path: '/accounting/approvals', permission: 'accounting.vouchers.view', icon: 'ShieldCheck' },
      { label: 'Vouchers', path: '/accounting/vouchers', permission: 'accounting.vouchers.view', icon: 'FileText' },
      { label: 'Forms Designer', path: '/accounting/forms-designer', permission: 'accounting.designer.view', icon: 'Layout' },
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
        ]
      },
      { label: 'Settings', path: '/accounting/settings', permission: 'accounting.settings.view', icon: 'Settings' }
    ]
  },
  inventory: {
    label: 'Inventory',
    icon: 'Boxes',
    items: [
      { label: 'Overview', path: '/inventory', icon: 'LayoutDashboard' },
      { label: 'Items', path: '/inventory/items', permission: 'inventory.items.view', icon: 'Package' },
      { label: 'Categories', path: '/inventory/categories', permission: 'inventory.categories.view', icon: 'Tag' },
      { label: 'Warehouses', path: '/inventory/warehouses', permission: 'inventory.warehouses.view', icon: 'Warehouse' },
      { label: 'Stock Levels', path: '/inventory/stock-levels', permission: 'inventory.stock.view', icon: 'Layers' },
      { label: 'Movements', path: '/inventory/movements', permission: 'inventory.movements.view', icon: 'Repeat' },
      {
        label: 'Operations',
        icon: 'ClipboardList',
        children: [
          { label: 'Opening Stock', path: '/inventory/opening-stock', permission: 'inventory.movements.record', icon: 'PackagePlus' },
          { label: 'Adjustments', path: '/inventory/adjustments', permission: 'inventory.stock.adjust', icon: 'SlidersHorizontal' },
          { label: 'Transfers', path: '/inventory/transfers', permission: 'inventory.warehouses.view', icon: 'ArrowLeftRight' },
        ]
      },
      {
        label: 'Reports',
        icon: 'BarChart3',
        children: [
          { label: 'Low Stock Alerts', path: '/inventory/alerts/low-stock', permission: 'inventory.stock.view', icon: 'AlertTriangle' },
          { label: 'Unsettled Costs', path: '/inventory/reports/unsettled-costs', permission: 'inventory.movements.view', icon: 'CircleDollarSign' },
          { label: 'Valuation', path: '/inventory/valuation', permission: 'inventory.valuation.view', icon: 'PieChart' },
        ]
      },
      { label: 'Settings', path: '/inventory/settings', permission: 'inventory.settings.view', icon: 'Settings' },
    ]
  },
  sales: {
    label: 'Sales',
    icon: 'ShoppingCart',
    items: [
      { label: 'Overview', path: '/sales', icon: 'LayoutDashboard' },
      { label: 'Customers', path: '/sales/customers', icon: 'Users' },
      { label: 'Sales Orders', path: '/sales/orders', icon: 'ShoppingCart' },
      {
        label: 'Operations',
        icon: 'Layers',
        children: [
          { label: 'Delivery Notes', path: '/sales/delivery-notes', icon: 'Truck' },
          { label: 'Sales Invoices', path: '/sales/invoices', icon: 'Receipt' },
          { label: 'Sales Returns', path: '/sales/returns', icon: 'Undo2' },
        ]
      },
      { label: 'Settings', path: '/sales/settings', icon: 'Settings' }
    ]
  },
  purchase: {
    label: 'Purchases',
    icon: 'ClipboardList',
    items: [
      { label: 'Vendors', path: '/purchases/vendors', icon: 'Store' },
      { label: 'Purchase Orders', path: '/purchases/orders', icon: 'ShoppingCart' },
      {
        label: 'Operations',
        icon: 'Layers',
        children: [
          { label: 'Goods Receipts', path: '/purchases/goods-receipts', icon: 'Truck' },
          { label: 'Purchase Invoices', path: '/purchases/invoices', icon: 'Receipt' },
          { label: 'Purchase Returns', path: '/purchases/returns', icon: 'Undo2' },
        ]
      },
      { label: 'Settings', path: '/purchases/settings', icon: 'Settings' }
    ]
  },
  purchases: {
    label: 'Purchases',
    icon: 'ClipboardList',
    items: [
      { label: 'Vendors', path: '/purchases/vendors', icon: 'Store' },
      { label: 'Purchase Orders', path: '/purchases/orders', icon: 'ShoppingCart' },
      {
        label: 'Operations',
        icon: 'Layers',
        children: [
          { label: 'Goods Receipts', path: '/purchases/goods-receipts', icon: 'Truck' },
          { label: 'Purchase Invoices', path: '/purchases/invoices', icon: 'Receipt' },
          { label: 'Purchase Returns', path: '/purchases/returns', icon: 'Undo2' },
        ]
      },
      { label: 'Settings', path: '/purchases/settings', icon: 'Settings' }
    ]
  },
  hr: {
    label: 'HR',
    icon: 'Users',
    items: [
      { label: 'Employees', path: '/hr/employees', permission: 'employee.list', icon: 'UserCheck' },
      { label: 'Attendance', path: '/hr/attendance', permission: 'attendance.list', icon: 'Clock' },
      { label: 'Payroll', path: '/hr/payroll', permission: 'payroll.list', icon: 'Wallet' }
    ]
  },
  crm: {
    label: 'CRM',
    icon: 'Users',
    items: [
      { label: 'Leads', path: '/crm/leads', permission: 'crm.leads.view', icon: 'Target' },
      { label: 'Customers', path: '/crm/customers', permission: 'crm.customers.view', icon: 'Users' }
    ]
  },
  pos: {
    label: 'POS',
    icon: 'Monitor',
    items: [
      { label: 'Terminal', path: '/pos', permission: 'pos.terminal.access', icon: 'Calculator' },
      { label: 'Sessions', path: '/pos/sessions', permission: 'pos.sessions.view', icon: 'History' }
    ]
  },
  manufacturing: {
    label: 'Manufacturing',
    icon: 'Factory',
    items: [
      { label: 'Work Orders', path: '/manufacturing/work-orders', permission: 'mfg.workOrder.view', icon: 'Wrench' },
      { label: 'BOM', path: '/manufacturing/bom', permission: 'mfg.bom.view', icon: 'Layers' }
    ]
  },
  projects: {
    label: 'Projects',
    icon: 'Briefcase',
    items: [
      { label: 'Projects', path: '/projects', permission: 'project.view', icon: 'Folder' },
      { label: 'Tasks', path: '/projects/tasks', permission: 'task.view', icon: 'CheckSquare' }
    ]
  }
};
