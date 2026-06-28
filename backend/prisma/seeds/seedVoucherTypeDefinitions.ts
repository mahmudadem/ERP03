/**
 * seedVoucherTypeDefinitions.ts — SQL seeder for voucher_type_definitions table [275a]
 *
 * Seeds the 14 canonical SYSTEM voucher type definitions (companyId = 'SYSTEM').
 * These are the master templates the company-wizard copies to each tenant on creation.
 *
 * Data is derived from the `templates` array in seedSystemVoucherTypes.ts (Firestore seeder).
 * Only the write target changes — we write directly via PrismaClient instead of the
 * Firestore IVoucherTypeDefinitionRepository.
 *
 * Idempotent: upserts by (companyId='SYSTEM', code, module).
 * The unique constraint @@unique([companyId, code, module]) on the schema makes this safe.
 *
 * `voucherType`, `persona`, and `sidebarGroup` are stored in layout._meta.
 * PrismaVoucherTypeDefinitionRepository hydrates them from that JSON payload when
 * SYSTEM templates are copied into a tenant during module/company initialization.
 */

import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

const SYSTEM_COMPANY_ID = 'SYSTEM';

// PostingRole enum values (mirrors PostingRole.ts to avoid a cross-import)
const PostingRole = {
  DATE: 'DATE',
  CURRENCY: 'CURRENCY',
  EXCHANGE_RATE: 'EXCHANGE_RATE',
  ACCOUNT: 'ACCOUNT',
  AMOUNT: 'AMOUNT',
} as const;

const DEBIT_CREDIT_SIDE_OPTIONS = [
  { value: 'debit', label: 'Debit' },
  { value: 'credit', label: 'Credit' },
];

/** The canonical 14 system voucher type definitions. */
const VOUCHER_TYPE_DEFINITIONS = [
  // =========== ACCOUNTING ===========
  {
    name: 'Journal Entry',
    code: 'journal_entry',
    module: 'ACCOUNTING',
    voucherType: 'journal_entry',
    persona: undefined,
    sidebarGroup: 'Documents',
    prefix: 'JV',
    workflow: undefined,
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Voucher', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true },
    ],
    headerFields: [
      { id: 'date', label: 'Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'reference', label: 'Reference', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'description', label: 'Description', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'accountId', label: 'Account', type: 'account-selector', width: '220px', mandatory: true },
      { fieldId: 'debit', label: 'Debit', type: 'NUMBER', width: '120px', mandatory: true },
      { fieldId: 'credit', label: 'Credit', type: 'NUMBER', width: '120px', mandatory: true },
      { fieldId: 'currency', label: 'Currency', type: 'currency-selector', width: '110px' },
      { fieldId: 'exchangeRate', label: 'Parity', type: 'NUMBER', width: '110px' },
      { fieldId: 'equivalent', label: 'Equivalent', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'notes', label: 'Notes', type: 'TEXT', width: '180px' },
      { fieldId: 'costCenterId', label: 'Cost Center', type: 'cost-center-selector', width: '160px' },
    ],
    layout: {
      lineFields: [
        { id: 'accountId', label: 'Account', type: 'account-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'debit', label: 'Debit', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'credit', label: 'Credit', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'currency', label: 'Currency', type: 'currency-selector', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'exchangeRate', label: 'Parity', type: 'NUMBER', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'equivalent', label: 'Equivalent', type: 'NUMBER', readOnly: true, computed: true, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'notes', label: 'Notes', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'costCenterId', label: 'Cost Center', type: 'cost-center-selector', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Journal Header', fieldIds: ['date', 'currency', 'exchangeRate', 'reference', 'description'] },
        { id: 'lines', title: 'Journal Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'Payment Voucher',
    code: 'payment',
    module: 'ACCOUNTING',
    voucherType: 'payment',
    persona: undefined,
    sidebarGroup: 'Documents',
    prefix: 'PV',
    workflow: undefined,
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Voucher', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true },
    ],
    headerFields: [
      { id: 'date', label: 'Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'payFromAccountId', label: 'Paid From', type: 'ACCOUNT_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.ACCOUNT, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'description', label: 'Description', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'payToAccountId', label: 'Pay To', type: 'account-selector', width: '220px', mandatory: true },
      { fieldId: 'amount', label: 'Amount', type: 'NUMBER', width: '120px', mandatory: true },
      { fieldId: 'notes', label: 'Notes', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'payToAccountId', label: 'Pay To', type: 'account-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'amount', label: 'Amount', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'notes', label: 'Notes', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Payment Details', fieldIds: ['date', 'payFromAccountId', 'currency', 'exchangeRate', 'description'] },
        { id: 'lines', title: 'Payments', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'Receipt Voucher',
    code: 'receipt',
    module: 'ACCOUNTING',
    voucherType: 'receipt',
    persona: undefined,
    sidebarGroup: 'Documents',
    prefix: 'RV',
    workflow: undefined,
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Voucher', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true },
    ],
    headerFields: [
      { id: 'date', label: 'Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'depositToAccountId', label: 'Deposit To', type: 'ACCOUNT_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.ACCOUNT, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'description', label: 'Description', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'receiveFromAccountId', label: 'Receive From', type: 'account-selector', width: '220px', mandatory: true },
      { fieldId: 'amount', label: 'Amount', type: 'NUMBER', width: '120px', mandatory: true },
      { fieldId: 'notes', label: 'Notes', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'receiveFromAccountId', label: 'Receive From', type: 'account-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'amount', label: 'Amount', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'notes', label: 'Notes', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Receipt Details', fieldIds: ['date', 'depositToAccountId', 'currency', 'exchangeRate', 'description'] },
        { id: 'lines', title: 'Receipts', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'Opening Balance',
    code: 'opening_balance',
    module: 'ACCOUNTING',
    voucherType: 'opening_balance',
    persona: undefined,
    sidebarGroup: 'Documents',
    prefix: 'OB',
    workflow: undefined,
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Voucher', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true },
    ],
    headerFields: [
      { id: 'date', label: 'Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'description', label: 'Description', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'accountId', label: 'Account', type: 'account-selector', width: '220px', mandatory: true },
      { fieldId: 'side', label: 'Side', type: 'SELECT', width: '100px', mandatory: true, options: DEBIT_CREDIT_SIDE_OPTIONS },
      { fieldId: 'amount', label: 'Amount', type: 'NUMBER', width: '120px', mandatory: true },
      { fieldId: 'notes', label: 'Notes', type: 'TEXT', width: '180px' },
      { fieldId: 'costCenterId', label: 'Cost Center', type: 'cost-center-selector', width: '160px' },
    ],
    layout: {
      lineFields: [
        { id: 'accountId', label: 'Account', type: 'account-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'side', label: 'Side', type: 'SELECT', mandatory: true, options: DEBIT_CREDIT_SIDE_OPTIONS, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'amount', label: 'Amount', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'notes', label: 'Notes', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'costCenterId', label: 'Cost Center', type: 'cost-center-selector', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Opening Balance Header', fieldIds: ['date', 'description'] },
        { id: 'lines', title: 'Opening Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'FX Revaluation',
    code: 'fx_revaluation',
    module: 'ACCOUNTING',
    voucherType: 'fx_revaluation',
    persona: undefined,
    sidebarGroup: 'Documents',
    prefix: 'FXR',
    workflow: undefined,
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [
      { type: 'print', label: 'Print Voucher', enabled: true },
      { type: 'download_pdf', label: 'Download PDF', enabled: true },
    ],
    headerFields: [
      { id: 'date', label: 'As Of Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'targetAccountId', label: 'Gain/Loss Account', type: 'ACCOUNT_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'description', label: 'Description', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'accountId', label: 'Account', type: 'account-selector', width: '220px', mandatory: true },
      { fieldId: 'currency', label: 'Currency', type: 'currency-selector', width: '110px' },
      { fieldId: 'foreignBalance', label: 'Foreign Balance', type: 'NUMBER', width: '120px' },
      { fieldId: 'newRate', label: 'New Rate', type: 'NUMBER', width: '110px', mandatory: true },
      { fieldId: 'deltaBase', label: 'Equivalent Delta', type: 'NUMBER', width: '140px', readOnly: true },
    ],
    layout: {
      lineFields: [
        { id: 'accountId', label: 'Account', type: 'account-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'currency', label: 'Currency', type: 'currency-selector', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'foreignBalance', label: 'Foreign Balance', type: 'NUMBER', readOnly: true, computed: true, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'newRate', label: 'New Rate', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'deltaBase', label: 'Equivalent Delta', type: 'NUMBER', readOnly: true, computed: true, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Revaluation Header', fieldIds: ['date', 'targetAccountId', 'description'] },
        { id: 'lines', title: 'Revaluation Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  // =========== SALES ===========
  {
    name: 'Delivery Note',
    code: 'delivery_note',
    module: 'SALES',
    voucherType: 'delivery_note',
    persona: undefined,
    sidebarGroup: 'Documents',
    prefix: 'DN',
    workflow: undefined,
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [{ type: 'print', label: 'Print Document', enabled: true }, { type: 'download_pdf', label: 'Download PDF', enabled: true }],
    headerFields: [
      { id: 'deliveryDate', label: 'Delivery Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'salesOrderId', label: 'Sales Order', type: 'SELECT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'customerId', label: 'Customer', type: 'party-selector', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'notes', label: 'Notes', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'soLineId', label: 'SO Line', type: 'TEXT', width: '130px' },
      { fieldId: 'deliveredQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'itemId', label: 'Item', type: 'item-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'soLineId', label: 'SO Line', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'deliveredQty', label: 'Quantity', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'uom', label: 'UOM', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'description', label: 'Description', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Delivery Details', fieldIds: ['deliveryDate', 'salesOrderId', 'customerId', 'warehouseId', 'notes'] },
        { id: 'lines', title: 'Delivery Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'Sales Return',
    code: 'sales_return',
    module: 'SALES',
    voucherType: 'sales_return',
    persona: undefined,
    sidebarGroup: 'Documents',
    prefix: 'SR',
    workflow: undefined,
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [{ type: 'print', label: 'Print Document', enabled: true }, { type: 'download_pdf', label: 'Download PDF', enabled: true }],
    headerFields: [
      { id: 'returnDate', label: 'Return Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'customerId', label: 'Customer', type: 'party-selector', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'salesInvoiceId', label: 'Sales Invoice', type: 'SELECT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'reason', label: 'Reason', type: 'TEXT', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'notes', label: 'Notes', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'returnQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'itemId', label: 'Item', type: 'item-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'returnQty', label: 'Quantity', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'uom', label: 'UOM', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true, computed: true, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'description', label: 'Description', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Return Details', fieldIds: ['returnDate', 'customerId', 'salesInvoiceId', 'currency', 'exchangeRate', 'reason', 'notes'] },
        { id: 'lines', title: 'Return Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'Sales Invoice (Direct)',
    code: 'sales_invoice_direct',
    module: 'SALES',
    voucherType: 'sales_invoice',
    persona: 'direct',
    sidebarGroup: 'Documents',
    prefix: 'SI',
    workflow: { mode: 'SIMPLE' },
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [{ type: 'print', label: 'Print Document', enabled: true }, { type: 'download_pdf', label: 'Download PDF', enabled: true }],
    headerFields: [
      { id: 'invoiceDate', label: 'Invoice Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'customerId', label: 'Customer', type: 'party-selector', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'warehouseId', label: 'Default Warehouse', type: 'warehouse-selector', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', readOnly: true, calculated: true, mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, computed: true, schemaVersion: 2 },
      { id: 'notes', label: 'Notes', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'itemId', label: 'Item', type: 'item-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'invoicedQty', label: 'Quantity', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'uom', label: 'UOM', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true, computed: true, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'description', label: 'Description', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['invoiceDate', 'customerId', 'warehouseId', 'currency', 'exchangeRate', 'totalAmount', 'notes'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'Sales Invoice (Linked)',
    code: 'sales_invoice_linked',
    module: 'SALES',
    voucherType: 'sales_invoice',
    persona: 'linked',
    sidebarGroup: 'Documents',
    prefix: 'SI',
    workflow: { mode: 'OPERATIONAL' },
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [{ type: 'print', label: 'Print Document', enabled: true }, { type: 'download_pdf', label: 'Download PDF', enabled: true }],
    headerFields: [
      { id: 'invoiceDate', label: 'Invoice Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'customerId', label: 'Customer', type: 'party-selector', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', readOnly: true, calculated: true, mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, computed: true, schemaVersion: 2 },
      { id: 'notes', label: 'Notes', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'itemId', label: 'Item', type: 'item-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'invoicedQty', label: 'Quantity', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'uom', label: 'UOM', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true, computed: true, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'description', label: 'Description', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['invoiceDate', 'customerId', 'currency', 'exchangeRate', 'totalAmount', 'notes'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'Sales Invoice (Service)',
    code: 'sales_invoice_service',
    module: 'SALES',
    voucherType: 'sales_invoice',
    persona: 'service',
    sidebarGroup: 'Documents',
    prefix: 'SI',
    workflow: undefined,
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [{ type: 'print', label: 'Print Document', enabled: true }, { type: 'download_pdf', label: 'Download PDF', enabled: true }],
    headerFields: [
      { id: 'invoiceDate', label: 'Invoice Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'customerId', label: 'Customer', type: 'party-selector', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', readOnly: true, calculated: true, mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, computed: true, schemaVersion: 2 },
      { id: 'notes', label: 'Notes', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Service / Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'itemId', label: 'Service / Item', type: 'item-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'invoicedQty', label: 'Quantity', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'uom', label: 'UOM', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true, computed: true, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'description', label: 'Description', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['invoiceDate', 'customerId', 'currency', 'exchangeRate', 'totalAmount', 'notes'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  // =========== PURCHASE ===========
  {
    name: 'Purchase Order',
    code: 'purchase_order',
    module: 'PURCHASE',
    voucherType: 'purchase_order',
    persona: undefined,
    sidebarGroup: 'Documents',
    prefix: 'PO',
    workflow: undefined,
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [{ type: 'print', label: 'Print Document', enabled: true }, { type: 'download_pdf', label: 'Download PDF', enabled: true }],
    headerFields: [
      { id: 'orderDate', label: 'Order Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'vendorId', label: 'Vendor', type: 'party-selector', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'notes', label: 'Notes', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '250px', mandatory: true },
      { fieldId: 'orderedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'itemId', label: 'Item', type: 'item-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'orderedQty', label: 'Quantity', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'uom', label: 'UOM', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true, computed: true, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'description', label: 'Description', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Order Details', fieldIds: ['orderDate', 'vendorId', 'currency', 'exchangeRate', 'notes'] },
        { id: 'lines', title: 'Items', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'Purchase Invoice (Direct)',
    code: 'purchase_invoice_direct',
    module: 'PURCHASE',
    voucherType: 'purchase_invoice',
    persona: 'direct',
    sidebarGroup: 'Documents',
    prefix: 'PI',
    workflow: { mode: 'SIMPLE' },
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [{ type: 'print', label: 'Print Document', enabled: true }, { type: 'download_pdf', label: 'Download PDF', enabled: true }],
    headerFields: [
      { id: 'invoiceDate', label: 'Invoice Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'vendorId', label: 'Vendor', type: 'vendor-account-selector', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', readOnly: true, calculated: true, mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, computed: true, schemaVersion: 2 },
      { id: 'notes', label: 'Notes', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'itemId', label: 'Item', type: 'item-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'invoicedQty', label: 'Quantity', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'uom', label: 'UOM', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true, computed: true, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'description', label: 'Description', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['invoiceDate', 'vendorId', 'currency', 'exchangeRate', 'totalAmount', 'notes'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'Purchase Invoice (Linked)',
    code: 'purchase_invoice_linked',
    module: 'PURCHASE',
    voucherType: 'purchase_invoice',
    persona: 'linked',
    sidebarGroup: 'Documents',
    prefix: 'PI',
    workflow: { mode: 'OPERATIONAL' },
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [{ type: 'print', label: 'Print Document', enabled: true }, { type: 'download_pdf', label: 'Download PDF', enabled: true }],
    headerFields: [
      { id: 'invoiceDate', label: 'Invoice Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'vendorId', label: 'Vendor', type: 'vendor-account-selector', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', readOnly: true, calculated: true, mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, computed: true, schemaVersion: 2 },
      { id: 'notes', label: 'Notes', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'itemId', label: 'Item', type: 'item-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'invoicedQty', label: 'Quantity', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'uom', label: 'UOM', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true, computed: true, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'description', label: 'Description', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['invoiceDate', 'vendorId', 'currency', 'exchangeRate', 'totalAmount', 'notes'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'Purchase Invoice (Service)',
    code: 'purchase_invoice_service',
    module: 'PURCHASE',
    voucherType: 'purchase_invoice',
    persona: 'service',
    sidebarGroup: 'Documents',
    prefix: 'PI',
    workflow: undefined,
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [{ type: 'print', label: 'Print Document', enabled: true }, { type: 'download_pdf', label: 'Download PDF', enabled: true }],
    headerFields: [
      { id: 'invoiceDate', label: 'Invoice Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'vendorId', label: 'Vendor', type: 'vendor-account-selector', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', readOnly: true, calculated: true, mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole.AMOUNT, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, computed: true, schemaVersion: 2 },
      { id: 'notes', label: 'Notes', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Service / Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'invoicedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', width: '120px' },
      { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', width: '120px', readOnly: true },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'itemId', label: 'Service / Item', type: 'item-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'invoicedQty', label: 'Quantity', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'uom', label: 'UOM', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true, computed: true, fieldClass: 'computed', bindingTarget: 'payload', nameLocked: true, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'description', label: 'Description', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Invoice Details', fieldIds: ['invoiceDate', 'vendorId', 'currency', 'exchangeRate', 'totalAmount', 'notes'] },
        { id: 'lines', title: 'Invoice Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'Goods Receipt',
    code: 'goods_receipt',
    module: 'PURCHASE',
    voucherType: 'goods_receipt',
    persona: undefined,
    sidebarGroup: 'Documents',
    prefix: 'GRN',
    workflow: undefined,
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [{ type: 'print', label: 'Print Document', enabled: true }, { type: 'download_pdf', label: 'Download PDF', enabled: true }],
    headerFields: [
      { id: 'receiptDate', label: 'Receipt Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'vendorId', label: 'Vendor', type: 'party-selector', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'notes', label: 'Notes', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'receivedQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitCostDoc', label: 'Unit Cost', type: 'NUMBER', width: '120px' },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'itemId', label: 'Item', type: 'item-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'receivedQty', label: 'Quantity', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'uom', label: 'UOM', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'unitCostDoc', label: 'Unit Cost', type: 'NUMBER', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'description', label: 'Description', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Receipt Details', fieldIds: ['receiptDate', 'vendorId', 'warehouseId', 'notes'] },
        { id: 'lines', title: 'Receipt Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
  {
    name: 'Purchase Return',
    code: 'purchase_return',
    module: 'PURCHASE',
    voucherType: 'purchase_return',
    persona: undefined,
    sidebarGroup: 'Documents',
    prefix: 'PR',
    workflow: undefined,
    isMultiLine: true,
    rules: [{ id: 'require_approval', label: 'Require Approval Workflow', enabled: true }],
    actions: [{ type: 'print', label: 'Print Document', enabled: true }, { type: 'download_pdf', label: 'Download PDF', enabled: true }],
    headerFields: [
      { id: 'returnDate', label: 'Return Date', type: 'DATE', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.DATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'vendorId', label: 'Vendor', type: 'party-selector', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.CURRENCY, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole.EXCHANGE_RATE, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'reason', label: 'Reason', type: 'TEXT', required: true, mandatory: true, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
      { id: 'notes', label: 'Notes', type: 'TEXT', mandatory: false, autoManaged: false, isPosting: false, postingRole: null, fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2 },
    ],
    tableColumns: [
      { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
      { fieldId: 'returnQty', label: 'Quantity', type: 'NUMBER', width: '100px', mandatory: true },
      { fieldId: 'uom', label: 'UOM', type: 'TEXT', width: '90px' },
      { fieldId: 'unitCostDoc', label: 'Unit Cost', type: 'NUMBER', width: '120px' },
      { fieldId: 'description', label: 'Description', type: 'TEXT', width: '220px' },
    ],
    layout: {
      lineFields: [
        { id: 'itemId', label: 'Item', type: 'item-selector', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'returnQty', label: 'Quantity', type: 'NUMBER', mandatory: true, fieldClass: 'system_core', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'uom', label: 'UOM', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'unitCostDoc', label: 'Unit Cost', type: 'NUMBER', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
        { id: 'description', label: 'Description', type: 'TEXT', fieldClass: 'system_optional', bindingTarget: 'payload', nameLocked: true, computed: false, schemaVersion: 2, isPosting: false, postingRole: null },
      ],
      sections: [
        { id: 'header', title: 'Return Details', fieldIds: ['returnDate', 'vendorId', 'warehouseId', 'currency', 'exchangeRate', 'reason', 'notes'] },
        { id: 'lines', title: 'Return Lines', fieldIds: ['lineItems'] },
      ],
    },
  },
];

export async function seedVoucherTypeDefinitions(prisma: PrismaClient): Promise<void> {
  console.log('  Seeding voucher_type_definitions (SYSTEM templates)...');

  for (const template of VOUCHER_TYPE_DEFINITIONS) {
    // The unique constraint is @@unique([companyId, code, module])
    const existing = await prisma.voucherTypeDefinition.findFirst({
      where: {
        companyId: SYSTEM_COMPANY_ID,
        code: template.code,
        module: template.module,
      },
      select: { id: true },
    });

    // Augment layout with _meta for fields not in the schema columns
    const layoutWithMeta = {
      ...template.layout,
      _meta: {
        voucherType: template.voucherType,
        persona: template.persona,
        sidebarGroup: template.sidebarGroup,
        prefix: template.prefix,
      },
    };

    if (existing) {
      await prisma.voucherTypeDefinition.update({
        where: { id: existing.id },
        data: {
          name: template.name,
          headerFields: template.headerFields,
          tableColumns: template.tableColumns,
          layout: layoutWithMeta,
          schemaVersion: 2,
          workflow: template.workflow ?? null,
          isMultiLine: template.isMultiLine,
          rules: template.rules,
          actions: template.actions,
          defaultCurrency: 'USD',
        },
      });
    } else {
      await prisma.voucherTypeDefinition.create({
        data: {
          id: randomUUID(),
          companyId: SYSTEM_COMPANY_ID,
          name: template.name,
          code: template.code,
          module: template.module,
          headerFields: template.headerFields,
          tableColumns: template.tableColumns,
          layout: layoutWithMeta,
          schemaVersion: 2,
          requiredPostingRoles: [],
          workflow: template.workflow ?? null,
          isMultiLine: template.isMultiLine,
          rules: template.rules,
          actions: template.actions,
          defaultCurrency: 'USD',
        },
      });
    }
    console.log(`    ✓ ${template.name} (${template.module})`);
  }
  console.log(`  ✓ ${VOUCHER_TYPE_DEFINITIONS.length} voucher type definitions upserted`);
}
