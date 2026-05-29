import { VoucherTypeDefinition } from '../domain/designer/entities/VoucherTypeDefinition';
import { PostingRole } from '../domain/designer/entities/PostingRole';
import { randomUUID } from 'crypto';
import { IVoucherTypeDefinitionRepository } from '../repository/interfaces/designer/IVoucherTypeDefinitionRepository';

const SYSTEM_COMPANY_ID = 'SYSTEM';
const DEBIT_CREDIT_SIDE_OPTIONS = [
  { value: 'debit', label: 'Debit' },
  { value: 'credit', label: 'Credit' },
];

const inferFieldClass = (field: any): 'system_core' | 'system_optional' | 'computed' => {
  if (field.calculated || field.autoManaged || field.readOnly) return 'computed';
  if (field.required || field.mandatory || field.isPosting) return 'system_core';
  return 'system_optional';
};

const canonicalizeTemplateCode = (rawCode: string): string => {
  const normalized = String(rawCode || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');

  if (normalized === 'journal' || normalized === 'jv') return 'journal_entry';
  if (normalized === 'payment' || normalized === 'pv') return 'payment';
  if (normalized === 'receipt' || normalized === 'rv') return 'receipt';
  if (normalized === 'opening' || normalized === 'ob') return 'opening_balance';
  if (normalized === 'fx' || normalized === 'fxr' || normalized === 'revaluation') return 'fx_revaluation';
  return normalized;
};

const normalizeField = (field: any) => ({
  ...field,
  name: field.name || field.id,
  isPosting: field.isPosting ?? false,
  postingRole: field.postingRole ?? null,
  fieldClass: inferFieldClass(field),
  bindingTarget: 'payload',
  nameLocked: true,
  computed: field.computed ?? field.calculated ?? field.autoManaged ?? false,
  schemaVersion: 2,
});

const lineField = (field: any) => normalizeField({
  required: field.required ?? field.mandatory ?? false,
  readOnly: field.readOnly ?? false,
  ...field,
});

const fieldsFromColumns = (columns: any[] = []) =>
  columns.map((column) => lineField({
    id: column.fieldId,
    label: column.label || column.labelOverride || column.fieldId,
    type: column.type || 'TEXT',
    required: column.required ?? column.mandatory ?? false,
    mandatory: column.mandatory ?? column.required ?? false,
    readOnly: column.readOnly ?? false,
    calculated: column.calculated,
    autoManaged: column.autoManaged,
    options: column.options,
  }));

const templates = [
  // --- ACCOUNTING VOUCHERS ---
  {
name: "Journal Entry",
    code: "journal_entry",
    voucherType: "journal_entry",
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
      { fieldId: "accountId", label: "Account", type: "account-selector", width: "220px", mandatory: true },
      { fieldId: "debit", label: "Debit", type: "NUMBER", width: "120px", mandatory: true },
      { fieldId: "credit", label: "Credit", type: "NUMBER", width: "120px", mandatory: true },
      { fieldId: "currency", label: "Currency", type: "currency-selector", width: "110px" },
      { fieldId: "exchangeRate", label: "Parity", type: "NUMBER", width: "110px" },
      { fieldId: "equivalent", label: "Equivalent", type: "NUMBER", width: "120px", readOnly: true },
      { fieldId: "notes", label: "Notes", type: "TEXT", width: "180px" },
      { fieldId: "costCenterId", label: "Cost Center", type: "cost-center-selector", width: "160px" }
    ],
    layout: {
      lineFields: [
        lineField({ id: "accountId", label: "Account", type: "account-selector", mandatory: true }),
        lineField({ id: "debit", label: "Debit", type: "NUMBER", mandatory: true }),
        lineField({ id: "credit", label: "Credit", type: "NUMBER", mandatory: true }),
        lineField({ id: "currency", label: "Currency", type: "currency-selector" }),
        lineField({ id: "exchangeRate", label: "Parity", type: "NUMBER" }),
        lineField({ id: "equivalent", label: "Equivalent", type: "NUMBER", readOnly: true, calculated: true, autoManaged: true }),
        lineField({ id: "notes", label: "Notes", type: "TEXT" }),
        lineField({ id: "costCenterId", label: "Cost Center", type: "cost-center-selector" }),
      ],
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
    code: "payment",
    voucherType: "payment",
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
      { fieldId: "payToAccountId", label: "Pay To", type: "account-selector", width: "220px", mandatory: true },
      { fieldId: "amount", label: "Amount", type: "NUMBER", width: "120px", mandatory: true },
      { fieldId: "notes", label: "Notes", type: "TEXT", width: "220px" }
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: "payToAccountId", label: "Pay To", type: "account-selector", mandatory: true },
        { fieldId: "amount", label: "Amount", type: "NUMBER", mandatory: true },
        { fieldId: "notes", label: "Notes", type: "TEXT" }
      ]),
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
  {
name: "Receipt Voucher",
    code: "receipt",
    voucherType: "receipt",
    module: "ACCOUNTING",
    sidebarGroup: "Vouchers",
    prefix: "RV",
    headerFields: [
      { id: "date", label: "Date", type: "DATE", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: "depositToAccountId", label: "Deposit To", type: "ACCOUNT_SELECT", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.ACCOUNT },
      { id: "currency", label: "Currency", type: "CURRENCY_SELECT", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: "exchangeRate", label: "Exchange Rate", type: "NUMBER", defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: "description", label: "Description", type: "TEXT", category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null }
    ],
    tableColumns: [
      { fieldId: "receiveFromAccountId", label: "Receive From", type: "account-selector", width: "220px", mandatory: true },
      { fieldId: "amount", label: "Amount", type: "NUMBER", width: "120px", mandatory: true },
      { fieldId: "notes", label: "Notes", type: "TEXT", width: "220px" }
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: "receiveFromAccountId", label: "Receive From", type: "account-selector", mandatory: true },
        { fieldId: "amount", label: "Amount", type: "NUMBER", mandatory: true },
        { fieldId: "notes", label: "Notes", type: "TEXT" }
      ]),
      sections: [
        { id: "header", title: "Receipt Details", fieldIds: ["date", "depositToAccountId", "currency", "exchangeRate", "description"] },
        { id: "lines", title: "Receipts", fieldIds: ["lineItems"] }
      ]
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Voucher', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },
  {
name: "Opening Balance",
    code: "opening_balance",
    voucherType: "opening_balance",
    module: "ACCOUNTING",
    sidebarGroup: "Vouchers",
    prefix: "OB",
    headerFields: [
      { id: "date", label: "Date", type: "DATE", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: "description", label: "Description", type: "TEXT", category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null }
    ],
    tableColumns: [
      { fieldId: "accountId", label: "Account", type: "account-selector", width: "220px", mandatory: true },
      { fieldId: "side", label: "Side", type: "SELECT", width: "100px", mandatory: true, options: DEBIT_CREDIT_SIDE_OPTIONS },
      { fieldId: "amount", label: "Amount", type: "NUMBER", width: "120px", mandatory: true },
      { fieldId: "notes", label: "Notes", type: "TEXT", width: "180px" },
      { fieldId: "costCenterId", label: "Cost Center", type: "cost-center-selector", width: "160px" }
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: "accountId", label: "Account", type: "account-selector", mandatory: true },
        { fieldId: "side", label: "Side", type: "SELECT", mandatory: true, options: DEBIT_CREDIT_SIDE_OPTIONS },
        { fieldId: "amount", label: "Amount", type: "NUMBER", mandatory: true },
        { fieldId: "notes", label: "Notes", type: "TEXT" },
        { fieldId: "costCenterId", label: "Cost Center", type: "cost-center-selector" }
      ]),
      sections: [
        { id: "header", title: "Opening Balance Header", fieldIds: ["date", "description"] },
        { id: "lines", title: "Opening Lines", fieldIds: ["lineItems"] }
      ]
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Voucher', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },
  {
name: "FX Revaluation",
    code: "fx_revaluation",
    voucherType: "fx_revaluation",
    module: "ACCOUNTING",
    sidebarGroup: "Vouchers",
    prefix: "FXR",
    headerFields: [
      { id: "date", label: "As Of Date", type: "DATE", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: "targetAccountId", label: "Gain/Loss Account", type: "ACCOUNT_SELECT", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: false, postingRole: null },
      { id: "description", label: "Description", type: "TEXT", category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null }
    ],
    tableColumns: [
      { fieldId: "accountId", label: "Account", type: "account-selector", width: "220px", mandatory: true },
      { fieldId: "currency", label: "Currency", type: "currency-selector", width: "110px" },
      { fieldId: "foreignBalance", label: "Foreign Balance", type: "NUMBER", width: "120px" },
      { fieldId: "newRate", label: "New Rate", type: "NUMBER", width: "110px", mandatory: true },
      { fieldId: "deltaBase", label: "Equivalent Delta", type: "NUMBER", width: "140px", readOnly: true }
    ],
    layout: {
      lineFields: [
        lineField({ id: "accountId", label: "Account", type: "account-selector", mandatory: true }),
        lineField({ id: "currency", label: "Currency", type: "currency-selector" }),
        lineField({ id: "foreignBalance", label: "Foreign Balance", type: "NUMBER", readOnly: true, calculated: true, autoManaged: true }),
        lineField({ id: "newRate", label: "New Rate", type: "NUMBER", mandatory: true }),
        lineField({ id: "deltaBase", label: "Equivalent Delta", type: "NUMBER", readOnly: true, calculated: true, autoManaged: true })
      ],
      sections: [
        { id: "header", title: "Revaluation Header", fieldIds: ["date", "targetAccountId", "description"] },
        { id: "lines", title: "Revaluation Lines", fieldIds: ["lineItems"] }
      ]
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Voucher', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },

  {
    name: "Delivery Note",
    code: "delivery_note",
    voucherType: "delivery_note",
    module: "SALES",
    sidebarGroup: "Documents",
    prefix: "DN",
    headerFields: [
      { id: 'deliveryDate', label: 'Delivery Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'salesOrderId', label: 'Sales Order', type: 'SELECT', relationTarget: 'sales_orders', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'customerId', label: 'Customer', type: 'party-selector', relationTarget: 'customers', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', relationTarget: 'warehouses', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'notes', label: 'Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'soLineId', label: 'SO Line', type: 'TEXT', width: '130px' },
      { fieldId: 'deliveredQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
        { fieldId: 'soLineId', label: 'SO Line', type: 'TEXT' },
        { fieldId: 'deliveredQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
        { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
        { fieldId: 'description', label: 'Description', type: 'TEXT' },
      ]),
      sections: [
        { id: 'header', title: 'Delivery Details', fieldIds: ['deliveryDate', 'salesOrderId', 'customerId', 'warehouseId', 'notes'] },
        { id: 'lines', title: 'Delivery Lines', fieldIds: ['lineItems'] },
      ],
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },
  {
    name: "Sales Return",
    code: "sales_return",
    voucherType: "sales_return",
    module: "SALES",
    sidebarGroup: "Documents",
    prefix: "SR",
    headerFields: [
      { id: 'returnDate', label: 'Return Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'customerId', label: 'Customer', type: 'party-selector', relationTarget: 'customers', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'salesInvoiceId', label: 'Sales Invoice', type: 'SELECT', relationTarget: 'sales_invoices', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'deliveryNoteId', label: 'Delivery Note', type: 'SELECT', relationTarget: 'delivery_notes', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'salesOrderId', label: 'Sales Order', type: 'SELECT', relationTarget: 'sales_orders', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', relationTarget: 'warehouses', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false },
      { id: 'totalAmount', label: 'Total Refund', type: 'NUMBER', required: false, readOnly: true, calculated: true, category: 'shared', mandatory: false, autoManaged: true },
      { id: 'reason', label: 'Reason', type: 'TEXT', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'notes', label: 'Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'siLineId', label: 'Invoice Line', type: 'TEXT', width: '130px' },
      { fieldId: 'dnLineId', label: 'DN Line', type: 'TEXT', width: '130px' },
      { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', width: '180px' },
      { fieldId: 'returnQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT', width: '130px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
        { fieldId: 'siLineId', label: 'Invoice Line', type: 'TEXT' },
        { fieldId: 'dnLineId', label: 'DN Line', type: 'TEXT' },
        { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector' },
        { fieldId: 'returnQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
        { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
        { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER' },
        { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT' },
        { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true },
        { fieldId: 'description', label: 'Description', type: 'TEXT' },
      ]),
      sections: [
        { id: 'header', title: 'Return Details', fieldIds: ['returnDate', 'customerId', 'salesInvoiceId', 'deliveryNoteId', 'salesOrderId', 'warehouseId', 'currency', 'exchangeRate', 'totalAmount', 'reason', 'notes'] },
        { id: 'lines', title: 'Return Lines', fieldIds: ['lineItems'] },
      ],
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },

  {
    name: "Sales Invoice (Direct)",
    code: "sales_invoice_direct",
    voucherType: "sales_invoice",
    persona: "direct",
    module: "SALES",
    sidebarGroup: "Documents",
    prefix: "SI",
    workflow: { mode: "SIMPLE" },
    headerFields: [
      { id: 'invoiceDate', label: 'Invoice Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'customerId', label: 'Customer', type: 'party-selector', relationTarget: 'customers', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'warehouseId', label: 'Default Warehouse', type: 'warehouse-selector', relationTarget: 'warehouses', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, category: 'shared', mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT },
      { id: 'notes', label: 'Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', width: '180px' },
      { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT', width: '130px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
        { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector' },
        { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
        { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
        { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER' },
        { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT' },
        { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true },
        { fieldId: 'description', label: 'Description', type: 'TEXT' },
      ]),
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['invoiceDate', 'customerId', 'warehouseId', 'currency', 'exchangeRate', 'totalAmount', 'notes'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },
  {
    name: "Sales Invoice (Linked)",
    code: "sales_invoice_linked",
    voucherType: "sales_invoice",
    persona: "linked",
    module: "SALES",
    sidebarGroup: "Documents",
    prefix: "SI",
    workflow: { mode: "OPERATIONAL" },
    headerFields: [
      { id: 'invoiceDate', label: 'Invoice Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'customerId', label: 'Customer', type: 'party-selector', relationTarget: 'customers', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'salesOrderId', label: 'Sales Order', type: 'SELECT', relationTarget: 'sales_orders', category: 'core', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'deliveryNoteId', label: 'Delivery Note', type: 'SELECT', relationTarget: 'delivery_notes', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'warehouseId', label: 'Default Warehouse', type: 'warehouse-selector', relationTarget: 'warehouses', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, category: 'shared', mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT },
      { id: 'notes', label: 'Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'soLineId', label: 'SO Line', type: 'TEXT', width: '130px' },
      { fieldId: 'dnLineId', label: 'DN Line', type: 'TEXT', width: '130px' },
      { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', width: '180px' },
      { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT', width: '130px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
        { fieldId: 'soLineId', label: 'SO Line', type: 'TEXT' },
        { fieldId: 'dnLineId', label: 'DN Line', type: 'TEXT' },
        { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector' },
        { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
        { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
        { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER' },
        { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT' },
        { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true },
        { fieldId: 'description', label: 'Description', type: 'TEXT' },
      ]),
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['invoiceDate', 'customerId', 'salesOrderId', 'deliveryNoteId', 'warehouseId', 'currency', 'exchangeRate', 'totalAmount', 'notes'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },
  {
    name: "Sales Invoice (Service)",
    code: "sales_invoice_service",
    voucherType: "sales_invoice",
    persona: "service",
    module: "SALES",
    sidebarGroup: "Documents",
    prefix: "SI",
    headerFields: [
      { id: 'invoiceDate', label: 'Invoice Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'customerId', label: 'Customer', type: 'party-selector', relationTarget: 'customers', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, category: 'shared', mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT },
      { id: 'notes', label: 'Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Service / Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT', width: '130px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: 'itemId', label: 'Service / Item', type: 'item-selector', mandatory: true },
        { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
        { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
        { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER' },
        { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT' },
        { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true },
        { fieldId: 'description', label: 'Description', type: 'TEXT' },
      ]),
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['invoiceDate', 'customerId', 'currency', 'exchangeRate', 'totalAmount', 'notes'] },
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
    voucherType: "purchase_order",
    module: "PURCHASE",
    sidebarGroup: "Documents",
    prefix: "PO",
    headerFields: [
      { id: 'orderDate', label: 'Order Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'vendorId', label: 'Vendor', type: 'party-selector', relationTarget: 'vendors', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'expectedDeliveryDate', label: 'Expected Delivery', type: 'DATE', required: false, category: 'shared', mandatory: false, autoManaged: false },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false },
      { id: 'notes', label: 'Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'internalNotes', label: 'Internal Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '250px', mandatory: true },
      { fieldId: 'orderedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT', width: '130px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
        { fieldId: 'orderedQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
        { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
        { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER' },
        { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT' },
        { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true },
        { fieldId: 'description', label: 'Description', type: 'TEXT' },
      ]),
      sections: [
        { id: 'header', title: 'Order Details', fieldIds: ['orderDate', 'vendorId', 'expectedDeliveryDate', 'currency', 'exchangeRate', 'notes', 'internalNotes'] },
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
    name: "Purchase Invoice (Direct)",
    code: "purchase_invoice_direct",
    voucherType: "purchase_invoice",
    persona: "direct",
    module: "PURCHASE",
    sidebarGroup: "Documents",
    prefix: "PI",
    workflow: { mode: "SIMPLE" },
    headerFields: [
      { id: 'invoiceDate', label: 'Invoice Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'vendorId', label: 'Vendor', type: 'vendor-account-selector', relationTarget: 'vendors', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'warehouseId', label: 'Default Warehouse', type: 'warehouse-selector', relationTarget: 'warehouses', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, category: 'shared', mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT },
      { id: 'notes', label: 'Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', width: '180px' },
      { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT', width: '130px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
        { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector' },
        { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
        { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
        { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER' },
        { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT' },
        { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true },
        { fieldId: 'description', label: 'Description', type: 'TEXT' },
      ]),
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['invoiceDate', 'vendorId', 'warehouseId', 'currency', 'exchangeRate', 'totalAmount', 'notes'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },
  {
    name: "Purchase Invoice (Linked)",
    code: "purchase_invoice_linked",
    voucherType: "purchase_invoice",
    persona: "linked",
    module: "PURCHASE",
    sidebarGroup: "Documents",
    prefix: "PI",
    workflow: { mode: "OPERATIONAL" },
    headerFields: [
      { id: 'invoiceDate', label: 'Invoice Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'vendorId', label: 'Vendor', type: 'vendor-account-selector', relationTarget: 'vendors', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'purchaseOrderId', label: 'Purchase Order', type: 'SELECT', relationTarget: 'purchase_orders', category: 'core', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'goodsReceiptId', label: 'Goods Receipt', type: 'SELECT', relationTarget: 'goods_receipts', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'warehouseId', label: 'Default Warehouse', type: 'warehouse-selector', relationTarget: 'warehouses', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, category: 'shared', mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT },
      { id: 'notes', label: 'Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'poLineId', label: 'PO Line', type: 'TEXT', width: '130px' },
      { fieldId: 'grnLineId', label: 'GRN Line', type: 'TEXT', width: '130px' },
      { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', width: '180px' },
      { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT', width: '130px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
        { fieldId: 'poLineId', label: 'PO Line', type: 'TEXT' },
        { fieldId: 'grnLineId', label: 'GRN Line', type: 'TEXT' },
        { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector' },
        { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
        { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
        { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER' },
        { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT' },
        { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true },
        { fieldId: 'description', label: 'Description', type: 'TEXT' },
      ]),
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['invoiceDate', 'vendorId', 'purchaseOrderId', 'goodsReceiptId', 'warehouseId', 'currency', 'exchangeRate', 'totalAmount', 'notes'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },
  {
    name: "Purchase Invoice (Service)",
    code: "purchase_invoice_service",
    voucherType: "purchase_invoice",
    persona: "service",
    module: "PURCHASE",
    sidebarGroup: "Documents",
    prefix: "PI",
    headerFields: [
      { id: 'invoiceDate', label: 'Invoice Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'vendorId', label: 'Vendor', type: 'vendor-account-selector', relationTarget: 'vendors', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: false, postingRole: null },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, category: 'shared', mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT },
      { id: 'notes', label: 'Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Service / Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT', width: '130px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: 'itemId', label: 'Service / Item', type: 'item-selector', mandatory: true },
        { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
        { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
        { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER' },
        { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT' },
        { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true },
        { fieldId: 'description', label: 'Description', type: 'TEXT' },
      ]),
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['invoiceDate', 'vendorId', 'currency', 'exchangeRate', 'totalAmount', 'notes'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },
  {
name: "Goods Receipt",
    code: "goods_receipt",
    voucherType: "goods_receipt",
    module: "PURCHASE",
    sidebarGroup: "Documents",
    prefix: "GRN",
    headerFields: [
      { id: 'receiptDate', label: 'Receipt Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'purchaseOrderId', label: 'Purchase Order', type: 'SELECT', relationTarget: 'purchase_orders', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'vendorId', label: 'Vendor', type: 'party-selector', relationTarget: 'vendors', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', relationTarget: 'warehouses', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'notes', label: 'Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'poLineId', label: 'PO Line', type: 'TEXT', width: '130px' },
      { fieldId: 'receivedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitCostDoc', label: 'Unit Cost', type: 'NUMBER', width: '120px' },
      { fieldId: 'moveCurrency', label: 'Currency', type: 'currency-selector', width: '110px' },
      { fieldId: 'fxRateMovToBase', label: 'FX Rate', type: 'NUMBER', width: '110px' },
      { fieldId: 'fxRateCCYToBase', label: 'CCY Rate', type: 'NUMBER', width: '110px' },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
        { fieldId: 'poLineId', label: 'PO Line', type: 'TEXT' },
        { fieldId: 'receivedQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
        { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
        { fieldId: 'unitCostDoc', label: 'Unit Cost', type: 'NUMBER' },
        { fieldId: 'moveCurrency', label: 'Currency', type: 'currency-selector' },
        { fieldId: 'fxRateMovToBase', label: 'FX Rate', type: 'NUMBER' },
        { fieldId: 'fxRateCCYToBase', label: 'CCY Rate', type: 'NUMBER' },
        { fieldId: 'description', label: 'Description', type: 'TEXT' },
      ]),
      sections: [
        { id: 'header', title: 'Receipt Details', fieldIds: ['receiptDate', 'purchaseOrderId', 'vendorId', 'warehouseId', 'notes'] },
        { id: 'lines', title: 'Receipt Lines', fieldIds: ['lineItems'] },
      ],
    },
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Document', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true }
    ]
  },
  {
name: "Purchase Return",
    code: "purchase_return",
    voucherType: "purchase_return",
    module: "PURCHASE",
    sidebarGroup: "Documents",
    prefix: "PR",
    headerFields: [
      { id: 'returnDate', label: 'Return Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE },
      { id: 'purchaseInvoiceId', label: 'Purchase Invoice', type: 'SELECT', relationTarget: 'purchase_invoices', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'goodsReceiptId', label: 'Goods Receipt', type: 'SELECT', relationTarget: 'goods_receipts', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'purchaseOrderId', label: 'Purchase Order', type: 'SELECT', relationTarget: 'purchase_orders', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'vendorId', label: 'Vendor', type: 'party-selector', relationTarget: 'vendors', category: 'shared', mandatory: false, autoManaged: false },
      { id: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', relationTarget: 'warehouses', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE },
      { id: 'reason', label: 'Reason', type: 'TEXT', required: true, category: 'core', mandatory: true, autoManaged: false },
      { id: 'notes', label: 'Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'piLineId', label: 'PI Line', type: 'TEXT', width: '110px' },
      { fieldId: 'grnLineId', label: 'GRN Line', type: 'TEXT', width: '110px' },
      { fieldId: 'poLineId', label: 'PO Line', type: 'TEXT', width: '110px' },
      { fieldId: 'returnQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitCostDoc', label: 'Unit Cost', type: 'NUMBER', width: '120px' },
      { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT', width: '130px' },
      { fieldId: 'accountId', label: 'Account', type: 'account-selector', width: '180px' },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: fieldsFromColumns([
        { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
        { fieldId: 'piLineId', label: 'PI Line', type: 'TEXT' },
        { fieldId: 'grnLineId', label: 'GRN Line', type: 'TEXT' },
        { fieldId: 'poLineId', label: 'PO Line', type: 'TEXT' },
        { fieldId: 'returnQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
        { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
        { fieldId: 'unitCostDoc', label: 'Unit Cost', type: 'NUMBER' },
        { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT' },
        { fieldId: 'accountId', label: 'Account', type: 'account-selector' },
        { fieldId: 'description', label: 'Description', type: 'TEXT' },
      ]),
      sections: [
        { id: 'header', title: 'Return Details', fieldIds: ['returnDate', 'purchaseInvoiceId', 'goodsReceiptId', 'purchaseOrderId', 'vendorId', 'warehouseId', 'currency', 'exchangeRate', 'reason', 'notes'] },
        { id: 'lines', title: 'Return Lines', fieldIds: ['lineItems'] },
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
  
  for (const t of templates) {
    try {
      const existing = existingTemplates.find(
        ex => canonicalizeTemplateCode(ex.code) === canonicalizeTemplateCode(t.code)
      );
      const id = existing ? existing.id : randomUUID();

      const headerFields = t.headerFields.map((f: any) => normalizeField(f));
      const layout = {
        ...(t.layout || {}),
        lineFields: Array.isArray((t.layout as any)?.lineFields)
          ? (t.layout as any).lineFields.map((f: any) => normalizeField(f))
          : undefined,
      };

const def = new VoucherTypeDefinition(
        id,
        SYSTEM_COMPANY_ID,
        t.name,
        t.code,
        t.module,
        headerFields as any[],
        t.tableColumns as any[],
        layout,
        2,
        undefined,
        (t as any).workflow,
        (t as any).uiModeOverrides,
        (t as any).isMultiLine ?? true,
        (t as any).rules || [],
        (t as any).actions || [],
        (t as any).defaultCurrency,
        (t as any).voucherType || t.code,
        (t as any).persona || undefined,
        (t as any).sidebarGroup || undefined
      );
      
      // FIX 2: Convert class instance to plain object for Firestore compatibility
      const plainObject = JSON.parse(JSON.stringify(def));

      if (existing) {
        // Preserve Super Admin-designed uiModeOverrides — never overwrite with seed defaults
        const updatePayload = {
          ...plainObject,
          uiModeOverrides: existing.uiModeOverrides ?? plainObject.uiModeOverrides,
        };
        await repo.updateVoucherType(SYSTEM_COMPANY_ID, id, updatePayload);
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
