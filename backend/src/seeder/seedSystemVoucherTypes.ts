import { VoucherTypeDefinition } from '../domain/designer/entities/VoucherTypeDefinition';
import { PostingRole } from '../domain/designer/entities/PostingRole';
import { randomUUID } from 'crypto';
import { IVoucherTypeDefinitionRepository } from '../repository/interfaces/designer/IVoucherTypeDefinitionRepository';

const SYSTEM_COMPANY_ID = 'SYSTEM';

const templates = [
  // --- ACCOUNTING VOUCHERS ---
  {
    name: "Journal Entry",
    code: "JOURNAL",
    module: "ACCOUNTING",
    sidebarGroup: "Vouchers",
    prefix: "JV",
    headerFields: [
      { id: "date", label: "Date", type: "DATE", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: "currency", label: "Currency", type: "CURRENCY_SELECT", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: "exchangeRate", label: "Exchange Rate", type: "NUMBER", defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: "reference", label: "Reference", type: "TEXT", category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
      { id: "description", label: "Description", type: "TEXT", category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null }
    ],
    tableColumns: [
      { fieldId: "accountId", width: "250px", mandatory: true },
      { fieldId: "debit", width: "100px", mandatory: true },
      { fieldId: "credit", width: "100px", mandatory: true },
      { fieldId: "description", width: "200px" }
    ],
    layout: {
      sections: [
        { id: "header", title: "Journal Header", fieldIds: ["date", "currency", "exchangeRate", "reference", "description"] },
        { id: "lines", title: "Journal Lines", fieldIds: ["lineItems"] }
      ]
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Voucher', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },
  {
    name: "Payment Voucher",
    code: "PAYMENT",
    module: "ACCOUNTING",
    sidebarGroup: "Vouchers",
    prefix: "PV",
    headerFields: [
      { id: "date", label: "Date", type: "DATE", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: "payFromAccountId", label: "Paid From", type: "ACCOUNT_SELECT", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.ACCOUNT },
      { id: "currency", label: "Currency", type: "CURRENCY_SELECT", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: "exchangeRate", label: "Exchange Rate", type: "NUMBER", defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: "description", label: "Description", type: "TEXT", category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null }
    ],
    tableColumns: [
      { fieldId: "payToAccountId", width: "200px", mandatory: true },
      { fieldId: "amount", width: "100px", mandatory: true },
      { fieldId: "notes", width: "200px" }
    ],
    layout: {
      sections: [
        { id: "header", title: "Payment Details", fieldIds: ["date", "payFromAccountId", "currency", "exchangeRate", "description"] },
        { id: "lines", title: "Payments", fieldIds: ["lineItems"] }
      ]
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Voucher', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },

  // --- SALES VOUCHERS ---
  {
    name: "Sales Order",
    code: "sales_order",
    module: "SALES",
    sidebarGroup: "Documents",
    prefix: "SO",
    headerFields: [
      { id: 'orderDate', label: 'Order Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'customerId', label: 'Customer', type: 'SELECT', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false },
      { id: 'notes', label: 'Internal Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
    ],
    tableColumns: [
      { fieldId: 'itemId', width: '250px', mandatory: true },
      { fieldId: 'quantity', width: '100px', mandatory: true },
      { fieldId: 'unitPrice', width: '120px' },
      { fieldId: 'lineTotal', width: '120px' },
    ],
    layout: {
      sections: [
        { id: 'header', title: 'Order Details', fieldIds: ['orderDate', 'customerId', 'currency', 'exchangeRate'] },
        { id: 'lines', title: 'Items', fieldIds: ['lineItems'] },
      ],
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },
  {
    name: "Sales Invoice",
    code: "sales_invoice",
    module: "SALES",
    sidebarGroup: "Documents",
    prefix: "SI",
    headerFields: [
      { id: 'date', label: 'Invoice Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'customerId', label: 'Customer', type: 'SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, category: 'shared', mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT },
      { id: 'description', label: 'Description', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', width: '220px', mandatory: true },
      { fieldId: 'quantity', width: '100px', mandatory: true },
      { fieldId: 'unitPrice', width: '100px' },
      { fieldId: 'lineTotal', width: '120px' },
    ],
    layout: {
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['date', 'customerId', 'currency', 'exchangeRate', 'totalAmount', 'description'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },

  // --- PURCHASE VOUCHERS ---
  {
    name: "Purchase Order",
    code: "purchase_order",
    module: "PURCHASE",
    sidebarGroup: "Documents",
    prefix: "PO",
    headerFields: [
      { id: 'orderDate', label: 'Order Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'supplierId', label: 'Supplier', type: 'SELECT', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false },
      { id: 'notes', label: 'Internal Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
    ],
    tableColumns: [
      { fieldId: 'itemId', width: '250px', mandatory: true },
      { fieldId: 'quantity', width: '100px', mandatory: true },
      { fieldId: 'unitPrice', width: '120px' },
      { fieldId: 'lineTotal', width: '120px' },
    ],
    layout: {
      sections: [
        { id: 'header', title: 'Order Details', fieldIds: ['orderDate', 'supplierId', 'currency', 'exchangeRate'] },
        { id: 'lines', title: 'Items', fieldIds: ['lineItems'] },
      ],
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },
  {
    name: "Purchase Invoice",
    code: "purchase_invoice",
    module: "PURCHASE",
    sidebarGroup: "Documents",
    prefix: "PI",
    headerFields: [
      { id: 'date', label: 'Invoice Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'supplierId', label: 'Supplier', type: 'SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, category: 'shared', mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT },
      { id: 'description', label: 'Description', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', width: '220px', mandatory: true },
      { fieldId: 'quantity', width: '100px', mandatory: true },
      { fieldId: 'unitPrice', width: '100px' },
      { fieldId: 'lineTotal', width: '120px' },
    ],
    layout: {
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['date', 'supplierId', 'currency', 'exchangeRate', 'totalAmount', 'description'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  }
];

export const seedSystemVoucherTypes = async (repo: IVoucherTypeDefinitionRepository) => {
  console.log('Seeding System Voucher Types...');
  
  const existingTemplates = await repo.getSystemTemplates();
  const existingCodes = new Set(existingTemplates.map(t => t.code));
  
  for (const t of templates) {
    try {
      const existing = existingTemplates.find(ex => ex.code === t.code);
      const id = existing ? existing.id : randomUUID();

      // FIX 1: Add missing mandatory properties to all fields
      const headerFields = t.headerFields.map((f: any) => ({
        ...f,
        isPosting: f.isPosting ?? false,
        postingRole: f.postingRole ?? null
      }));

      const def = new VoucherTypeDefinition(
        id,
        SYSTEM_COMPANY_ID,
        t.name,
        t.code,
        t.module,
        headerFields as any[],
        t.tableColumns as any[],
        t.layout,
        2,
        undefined,
        (t as any).workflow,
        (t as any).uiModeOverrides,
        (t as any).isMultiLine ?? true,
        (t as any).rules || [],
        (t as any).actions || [],
        (t as any).defaultCurrency
      );
      
      // FIX 2: Convert class instance to plain object for Firestore compatibility
      const plainObject = JSON.parse(JSON.stringify(def));

      if (existing) {
        await repo.updateVoucherType(SYSTEM_COMPANY_ID, id, plainObject);
        console.log(`  🔄 Updated template: ${t.name} (${t.code})`);
      } else {
        await repo.createVoucherType(plainObject);
        console.log(`  ✅ Created template: ${t.name} (${t.code})`);
      }
    } catch (err: any) {
      console.error(`  ❌ Failed to seed template ${t.name}:`, err.message);
    }
  }
  
  console.log('System Voucher Types Seeding Complete.');
};
