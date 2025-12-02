export const moduleMenuMap: Record<
  string,
  {
    label: string;
    icon: string;
    items: Array<{ label: string; path: string; permission?: string }>;
  }
> = {
  accounting: {
    label: 'Accounting',
    icon: 'Calculator',
    items: [
      { label: 'Chart of Accounts', path: '/accounting/accounts', permission: 'coa.view' },
      { label: 'Vouchers', path: '/accounting/vouchers', permission: 'voucher.view' },
      { label: 'Trial Balance', path: '/accounting/reports/trial-balance', permission: 'accounting.reports.trialBalance.view' }
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
  }
};
