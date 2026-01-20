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
      { label: 'Chart of Accounts', path: '/accounting/accounts', permission: 'accounting.accounts.view', icon: 'Book' },
      { label: 'Approval Center', path: '/accounting/approvals', permission: 'accounting.vouchers.view', icon: 'ShieldCheck' },
      { label: 'Vouchers', path: '/accounting/vouchers', permission: 'accounting.vouchers.view', icon: 'FileText' },
      { label: 'Forms Designer', path: '/accounting/forms-designer', permission: 'accounting.designer.view', icon: 'Layout' },
      { 
        label: 'Reports', 
        icon: 'BarChart3',
        children: [
          { label: 'Trial Balance', path: '/accounting/reports/trial-balance', permission: 'accounting.reports.trialBalance.view', icon: 'BarChart3' },
          { label: 'General Ledger', path: '/accounting/reports/general-ledger', permission: 'accounting.reports.generalLedger.view', icon: 'BookOpen' },
          { label: 'Profit & Loss', path: '/accounting/reports/profit-loss', permission: 'accounting.reports.profitAndLoss.view', icon: 'PieChart' },
        ]
      },
      { label: 'Settings', path: '/accounting/settings', permission: 'accounting.settings.view', icon: 'Settings' }
    ]
  },
  inventory: {
    label: 'Inventory',
    icon: 'Boxes',
    items: [
      { label: 'Items', path: '/inventory/items', permission: 'item.list', icon: 'Package' },
      { label: 'Warehouses', path: '/inventory/warehouses', permission: 'warehouse.list', icon: 'Warehouse' },
      { label: 'Stock Movements', path: '/inventory/movements', permission: 'stockMovement.list', icon: 'Repeat' },
      { label: 'Settings', path: '/inventory/settings', permission: 'inventory.settings', icon: 'Settings' }
    ]
  },
  sales: {
    label: 'Sales',
    icon: 'ShoppingCart',
    items: [
      { label: 'Quotations', path: '/sales/quotations', permission: 'sales.quotation.list', icon: 'FilePlus' },
      { label: 'Invoices', path: '/sales/invoices', permission: 'sales.invoice.list', icon: 'Receipt' },
      { label: 'Customers', path: '/sales/customers', permission: 'customer.list', icon: 'Users' }
    ]
  },
  purchases: {
    label: 'Purchases',
    icon: 'ClipboardList',
    items: [
      { label: 'Purchase Orders', path: '/purchases/orders', permission: 'purchase.order.list', icon: 'ShoppingCart' },
      { label: 'Vendors', path: '/purchases/vendors', permission: 'vendor.list', icon: 'Store' }
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
