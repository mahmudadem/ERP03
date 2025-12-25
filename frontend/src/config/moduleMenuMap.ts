export const moduleMenuMap: Record<
  string,
  {
    label: string;
    icon: string;
    items: Array<{ 
      label: string; 
      path?: string; 
      permission?: string;
      children?: Array<{ label: string; path: string; permission?: string }>;
    }>;
  }
> = {
  accounting: {
    label: 'Accounting',
    icon: 'Calculator',
    items: [
      { label: 'Chart of Accounts', path: '/accounting/accounts', permission: 'accounting.accounts.view' },
      { label: 'Vouchers', path: '/accounting/vouchers', permission: 'accounting.vouchers.view' },
      { label: 'Designer', path: '/accounting/designer', permission: 'accounting.designer.view' },
      { label: 'AI Designer', path: '/accounting/ai-designer', permission: 'accounting.designer.view' },
      { label: 'Trial Balance', path: '/accounting/reports/trial-balance', permission: 'accounting.reports.trialBalance.view' },
      { label: 'Profit & Loss', path: '/accounting/reports/profit-loss', permission: 'accounting.reports.profitAndLoss.view' },
      { label: 'Settings', path: '/accounting/settings', permission: 'accounting.settings.view' }
    ]
  },
  inventory: {
    label: 'Inventory',
    icon: 'Boxes',
    items: [
      { label: 'Items', path: '/inventory/items', permission: 'item.list' },
      { label: 'Warehouses', path: '/inventory/warehouses', permission: 'warehouse.list' },
      { label: 'Stock Movements', path: '/inventory/movements', permission: 'stockMovement.list' },
      { label: 'Settings', path: '/inventory/settings', permission: 'inventory.settings' }
    ]
  },
  sales: {
    label: 'Sales',
    icon: 'ShoppingCart',
    items: [
      { label: 'Quotations', path: '/sales/quotations', permission: 'sales.quotation.list' },
      { label: 'Invoices', path: '/sales/invoices', permission: 'sales.invoice.list' },
      { label: 'Customers', path: '/sales/customers', permission: 'customer.list' }
    ]
  },
  purchases: {
    label: 'Purchases',
    icon: 'ClipboardList',
    items: [
      { label: 'Purchase Orders', path: '/purchases/orders', permission: 'purchase.order.list' },
      { label: 'Vendors', path: '/purchases/vendors', permission: 'vendor.list' }
    ]
  },
  hr: {
    label: 'HR',
    icon: 'Users',
    items: [
      { label: 'Employees', path: '/hr/employees', permission: 'employee.list' },
      { label: 'Attendance', path: '/hr/attendance', permission: 'attendance.list' },
      { label: 'Payroll', path: '/hr/payroll', permission: 'payroll.list' }
    ]
  },
  crm: {
    label: 'CRM',
    icon: 'Users',
    items: [
      { label: 'Leads', path: '/crm/leads', permission: 'crm.leads.view' },
      { label: 'Customers', path: '/crm/customers', permission: 'crm.customers.view' }
    ]
  },
  pos: {
    label: 'POS',
    icon: 'Monitor',
    items: [
      { label: 'Terminal', path: '/pos', permission: 'pos.terminal.access' },
      { label: 'Sessions', path: '/pos/sessions', permission: 'pos.sessions.view' }
    ]
  },
  manufacturing: {
    label: 'Manufacturing',
    icon: 'Factory',
    items: [
      { label: 'Work Orders', path: '/manufacturing/work-orders', permission: 'mfg.workOrder.view' },
      { label: 'BOM', path: '/manufacturing/bom', permission: 'mfg.bom.view' }
    ]
  },
  projects: {
    label: 'Projects',
    icon: 'Briefcase',
    items: [
      { label: 'Projects', path: '/projects', permission: 'project.view' },
      { label: 'Tasks', path: '/projects/tasks', permission: 'task.view' }
    ]
  },
  purchase: {
    label: 'Purchases',
    icon: 'ClipboardList',
    items: [
      { label: 'Purchase Orders', path: '/purchases/orders', permission: 'purchase.order.list' },
      { label: 'Vendors', path: '/purchases/vendors', permission: 'vendor.list' }
    ]
  }
};
