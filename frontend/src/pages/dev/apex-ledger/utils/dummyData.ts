import { COAAccount, Customer, Vendor, SalesOrder, Invoice, PurchaseBill, InventoryItem } from '../types';

export const INITIAL_ACCOUNTS: COAAccount[] = [
  // Assets (Code starting with 1)
  {
    id: '1',
    code: '1',
    name: 'Assets',
    type: 'Asset',
    classification: 'Header',
    currency: 'SYP',
    parentId: null,
    balance: 546000000,
    isActive: true,
    notes: 'Primary corporate assets parent node'
  },
  {
    id: '101',
    code: '101',
    name: 'Cash & Petty Cash',
    type: 'Asset',
    classification: 'Header',
    currency: 'SYP',
    parentId: '1',
    balance: 142000000,
    isActive: true,
    notes: 'Physical cash units across branches'
  },
  {
    id: '10101',
    code: '10101',
    name: 'Cash - Head Office',
    type: 'Asset',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '101',
    balance: 89000000,
    isActive: true,
    notes: 'Main safe vault at corporate headquarters'
  },
  {
    id: '10102',
    code: '10102',
    name: 'Cash - Retail Branch',
    type: 'Asset',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '101',
    balance: 53000000,
    isActive: true,
    notes: 'Retail terminal cash-in-hand reserves'
  },
  {
    id: '102',
    code: '102',
    name: 'Bank Accounts',
    type: 'Asset',
    classification: 'Header',
    currency: 'SYP',
    parentId: '1',
    balance: 284000000,
    isActive: true,
    notes: 'Commercial bank deposits'
  },
  {
    id: '10201',
    code: '10201',
    name: 'Bank - Operating',
    type: 'Asset',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '102',
    balance: 195000000,
    isActive: true,
    notes: 'Primary operating account (BBS)'
  },
  {
    id: '10202',
    code: '10202',
    name: 'Bank - LC Payments',
    type: 'Asset',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '102',
    balance: 89000000,
    isActive: true,
    notes: 'Letter of Credit settlement deposit'
  },
  {
    id: '103',
    code: '103',
    name: 'Inventory',
    type: 'Asset',
    classification: 'Header',
    currency: 'SYP',
    parentId: '1',
    balance: 120000000,
    isActive: true,
    notes: 'Warehouse assets valuated at cost'
  },
  {
    id: '10301',
    code: '10301',
    name: 'Ready inventory',
    type: 'Asset',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '103',
    balance: 120000000,
    isActive: true,
    notes: 'Finished goods ready for trade and wholesale'
  },

  // Liabilities (Code starting with 2)
  {
    id: '2',
    code: '2',
    name: 'Liabilities',
    type: 'Liability',
    classification: 'Header',
    currency: 'SYP',
    parentId: null,
    balance: 185000000,
    isActive: true
  },
  {
    id: '201',
    code: '201',
    name: 'Accounts Payable',
    type: 'Liability',
    classification: 'Header',
    currency: 'SYP',
    parentId: '2',
    balance: 135000000,
    isActive: true
  },
  {
    id: '20101',
    code: '20101',
    name: 'Trade Creditors - Local',
    type: 'Liability',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '201',
    balance: 75000000,
    isActive: true
  },
  {
    id: '20102',
    code: '20102',
    name: 'Trade Creditors - Foreign',
    type: 'Liability',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '201',
    balance: 60000000,
    isActive: true
  },
  {
    id: '202',
    code: '202',
    name: 'Accrued Expenses & Provisions',
    type: 'Liability',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '2',
    balance: 50000000,
    isActive: true
  },

  // Equity (Code starting with 3)
  {
    id: '3',
    code: '3',
    name: 'Equity',
    type: 'Equity',
    classification: 'Header',
    currency: 'SYP',
    parentId: null,
    balance: 310000000,
    isActive: true
  },
  {
    id: '301',
    code: '301',
    name: 'Share Capital',
    type: 'Equity',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '3',
    balance: 200000000,
    isActive: true
  },
  {
    id: '302',
    code: '302',
    name: 'Retained Earnings',
    type: 'Equity',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '3',
    balance: 110000000,
    isActive: true
  },

  // Revenues (Code starting with 4)
  {
    id: '4',
    code: '4',
    name: 'Revenues',
    type: 'Revenue',
    classification: 'Header',
    currency: 'SYP',
    parentId: null,
    balance: 415000000,
    isActive: true
  },
  {
    id: '401',
    code: '401',
    name: 'Product Sales',
    type: 'Revenue',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '4',
    balance: 320000000,
    isActive: true
  },
  {
    id: '402',
    code: '402',
    name: 'Services Revenue',
    type: 'Revenue',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '4',
    balance: 95000000,
    isActive: true
  },

  // Expenses (Code starting with 5)
  {
    id: '5',
    code: '5',
    name: 'Expenses',
    type: 'Expense',
    classification: 'Header',
    currency: 'SYP',
    parentId: null,
    balance: 204000000,
    isActive: true
  },
  {
    id: '501',
    code: '501',
    name: 'Cost Of Goods Sold (COGS)',
    type: 'Expense',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '5',
    balance: 130000000,
    isActive: true
  },
  {
    id: '502',
    code: '502',
    name: 'Salaries & Wages',
    type: 'Expense',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '5',
    balance: 54000000,
    isActive: true
  },
  {
    id: '503',
    code: '503',
    name: 'Rent & Utilities',
    type: 'Expense',
    classification: 'Posting',
    currency: 'SYP',
    parentId: '5',
    balance: 20000000,
    isActive: true
  }
];

export const INITIAL_CUSTOMERS: Customer[] = [
  {
    id: 'CUST-001',
    name: 'الشركة العربية للتجارة والخدمات',
    email: 'info@arabtrade.com',
    phone: '+963-11-224466',
    company: 'Arabian Trade Corp',
    balance: 12500000
  },
  {
    id: 'CUST-002',
    name: 'مؤسسة الشام للصناعات الغذائية',
    email: 'sales@alshamfood.sy',
    phone: '+963-11-532115',
    company: 'Al-Sham Industries',
    balance: 8750000
  },
  {
    id: 'CUST-003',
    name: 'مكتبة ومطبعة الشرق الاوسط',
    email: 'contact@eastprint.com',
    phone: '+963-21-445588',
    company: 'East Print & Stationery',
    balance: 0
  },
  {
    id: 'CUST-004',
    name: 'مجموعة النور لتقنيات الحاسوب',
    email: 'support@alnoor-tech.com',
    phone: '+963-11-9988',
    company: 'Al-Noor Technologies',
    balance: 16200000
  }
];

export const INITIAL_VENDORS: Vendor[] = [
  {
    id: 'VEND-001',
    name: 'شركة الفرات للتوريدات الميكانيكية',
    email: 'orders@euphrates-supply.com',
    phone: '+963-31-412211',
    company: 'Euphrates Supplies Ltd',
    balance: 45000000
  },
  {
    id: 'VEND-002',
    name: 'مصنع الشرق الحديث للبلاستيك',
    email: 'rawmaterials@mod-oriental.com',
    phone: '+963-21-223311',
    company: 'Modern Oriental Plastics',
    balance: 30000000
  },
  {
    id: 'VEND-003',
    name: 'حلول الشبكات والاتصالات العالمية',
    email: 'billing@global-net-solutions.com',
    phone: '+44-20-7946-0192',
    company: 'Global Net Solutions',
    balance: 0
  }
];

export const INITIAL_INVENTORY: InventoryItem[] = [
  {
    id: 'PROD-001',
    sku: 'HW-SRV-001',
    name: 'Server Rack Module 42U - Deep Black',
    category: 'Hardware',
    qtyOnHand: 15,
    avgCost: 1500000,
    salePrice: 2100000
  },
  {
    id: 'PROD-002',
    sku: 'NWR-CAT6-100',
    name: 'Cat6 Shielded Network Cable (100m Roll)',
    category: 'Cabling & Infrastructure',
    qtyOnHand: 84,
    avgCost: 120000,
    salePrice: 180000
  },
  {
    id: 'PROD-003',
    sku: 'SFT-ERP-LIC',
    name: 'Sleek ERP Studio Enterprise User License (Annual)',
    category: 'Software',
    qtyOnHand: 350,
    avgCost: 35000,
    salePrice: 150000
  },
  {
    id: 'PROD-004',
    sku: 'HW-SWT-G24',
    name: '24-Port Gigabit Managed L3 Switch',
    category: 'Hardware',
    qtyOnHand: 22,
    avgCost: 450000,
    salePrice: 680000
  },
  {
    id: 'PROD-005',
    sku: 'CON-DSK-W12',
    name: 'Industrial Ergonomic Workspace Desk 1.2m',
    category: 'Furniture & Workspaces',
    qtyOnHand: 8,
    avgCost: 350000,
    salePrice: 520000
  }
];

export const INITIAL_SALES_ORDERS: SalesOrder[] = [
  {
    id: 'SO-2026-001',
    soNumber: 'SO-2026-001',
    customerId: 'CUST-001',
    customerName: 'الشركة العربية للتجارة والخدمات',
    date: '2026-05-15',
    items: [
      { id: '1', productId: 'PROD-001', description: 'Server Rack Module 42U - Deep Black', quantity: 2, unitPrice: 2100000, total: 4200000 },
      { id: '2', productId: 'PROD-004', description: '24-Port Gigabit Managed L3 Switch', quantity: 3, unitPrice: 680000, total: 2040000 }
    ],
    taxAmount: 312000,
    totalAmount: 6552000,
    status: 'Invoiced',
    currency: 'SYP'
  },
  {
    id: 'SO-2026-002',
    soNumber: 'SO-2026-002',
    customerId: 'CUST-002',
    customerName: 'مؤسسة الشام للصناعات الغذائية',
    date: '2026-05-22',
    items: [
      { id: '3', productId: 'PROD-003', description: 'Sleek ERP Studio Enterprise User License (Annual)', quantity: 25, unitPrice: 150000, total: 3750000 }
    ],
    taxAmount: 187500,
    totalAmount: 3937500,
    status: 'Approved',
    currency: 'SYP'
  },
  {
    id: 'SO-2026-003',
    soNumber: 'SO-2026-003',
    customerId: 'CUST-004',
    customerName: 'مجموعة النور لتقنيات الحاسوب',
    date: '2026-05-28',
    items: [
      { id: '4', productId: 'PROD-002', description: 'Cat6 Shielded Network Cable (100m Roll)', quantity: 10, unitPrice: 180000, total: 1800000 },
      { id: '5', productId: 'PROD-004', description: '24-Port Gigabit Managed L3 Switch', quantity: 5, unitPrice: 680000, total: 3400000 }
    ],
    taxAmount: 260000,
    totalAmount: 5460000,
    status: 'Draft',
    currency: 'SYP'
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'INV-2026-001',
    invoiceNumber: 'INV-2026-001',
    customerId: 'CUST-001',
    customerName: 'الشركة العربية للتجارة والخدمات',
    date: '2026-05-15',
    dueDate: '2026-06-15',
    items: [
      { id: '1', productId: 'PROD-001', description: 'Server Rack Module 42U - Deep Black', quantity: 2, unitPrice: 2100000, total: 4200000 },
      { id: '2', productId: 'PROD-004', description: '24-Port Gigabit Managed L3 Switch', quantity: 3, unitPrice: 680000, total: 2040000 }
    ],
    taxAmount: 312000,
    totalAmount: 6552000,
    amountPaid: 6552000,
    status: 'Paid',
    currency: 'SYP'
  },
  {
    id: 'INV-2026-002',
    invoiceNumber: 'INV-2026-002',
    customerId: 'CUST-002',
    customerName: 'مؤسسة الشام للصناعات الغذائية',
    date: '2026-05-18',
    dueDate: '2026-06-18',
    items: [
      { id: '3', productId: 'PROD-003', description: 'Sleek ERP Studio Enterprise User License (Annual)', quantity: 50, unitPrice: 150000, total: 7500000 }
    ],
    taxAmount: 375000,
    totalAmount: 7875000,
    amountPaid: 0,
    status: 'Posted',
    currency: 'SYP'
  },
  {
    id: 'INV-2026-003',
    invoiceNumber: 'INV-2026-003',
    customerId: 'CUST-004',
    customerName: 'مجموعة النور لتقنيات الحاسوب',
    date: '2026-05-10',
    dueDate: '2026-05-25',
    items: [
      { id: '4', productId: 'PROD-005', description: 'Industrial Ergonomic Workspace Desk 1.2m', quantity: 12, unitPrice: 520000, total: 6240000 }
    ],
    taxAmount: 312000,
    totalAmount: 6552000,
    amountPaid: 0,
    status: 'Overdue',
    currency: 'SYP'
  },
  {
    id: 'INV-2026-004',
    invoiceNumber: 'INV-2026-004',
    customerId: 'CUST-001',
    customerName: 'الشركة العربية للتجارة والخدمات',
    date: '2026-05-29',
    dueDate: '2026-06-29',
    items: [
      { id: '5', productId: 'PROD-002', description: 'Cat6 Shielded Network Cable (100m Roll)', quantity: 15, unitPrice: 180000, total: 2700000 }
    ],
    taxAmount: 135000,
    totalAmount: 2835000,
    amountPaid: 0,
    status: 'Draft',
    currency: 'SYP'
  }
];

export const INITIAL_PURCHASE_BILLS: PurchaseBill[] = [
  {
    id: 'BILL-2026-001',
    billNumber: 'BILL-2026-001',
    vendorId: 'VEND-001',
    vendorName: 'شركة الفرات للتوريدات الميكانيكية',
    date: '2026-05-01',
    dueDate: '2026-05-31',
    items: [
      { id: '1', description: 'Heavy Steel Brackets and Anchors Bulk', quantity: 100, unitPrice: 250000, total: 25000000 }
    ],
    taxAmount: 1250000,
    totalAmount: 26250000,
    status: 'Paid',
    currency: 'SYP'
  },
  {
    id: 'BILL-2026-002',
    billNumber: 'BILL-2026-002',
    vendorId: 'VEND-002',
    vendorName: 'مصنع الشرق الحديث للبلاستيك',
    date: '2026-05-20',
    dueDate: '2026-06-20',
    items: [
      { id: '2', description: 'Raw Polypropylene Beads Grade-A (Metric Ton)', quantity: 4, unitPrice: 7500000, total: 30000000 }
    ],
    taxAmount: 1500000,
    totalAmount: 31500000,
    status: 'Approved',
    currency: 'SYP'
  }
];

export const AUDIT_LOGS = [
  { id: '1', date: '2026-05-30 22:15', user: 'Mahmud Adem', action: 'Approved Sales Order SO-2026-002', branch: 'asd syria' },
  { id: '2', date: '2026-05-30 18:40', user: 'Admin', action: 'Added account code 10301 "Ready inventory"', branch: 'asd syria' },
  { id: '3', date: '2026-05-30 14:10', user: 'System', action: 'Recurring Billing Service completed successfully', branch: 'Global' },
  { id: '4', date: '2026-05-29 11:05', user: 'Mahmud Adem', action: 'Drafted Invoice INV-2026-004', branch: 'asd syria' }
];
