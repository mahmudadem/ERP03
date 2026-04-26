"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedSystemVoucherTypes = void 0;
const VoucherTypeDefinition_1 = require("../domain/designer/entities/VoucherTypeDefinition");
const PostingRole_1 = require("../domain/designer/entities/PostingRole");
const crypto_1 = require("crypto");
const SYSTEM_COMPANY_ID = 'SYSTEM';
const inferFieldClass = (field) => {
    if (field.calculated || field.autoManaged || field.readOnly)
        return 'computed';
    if (field.required || field.mandatory || field.isPosting)
        return 'system_core';
    return 'system_optional';
};
const canonicalizeTemplateCode = (rawCode) => {
    const normalized = String(rawCode || '')
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    if (normalized === 'journal' || normalized === 'jv')
        return 'journal_entry';
    if (normalized === 'payment' || normalized === 'pv')
        return 'payment';
    if (normalized === 'receipt' || normalized === 'rv')
        return 'receipt';
    if (normalized === 'opening' || normalized === 'ob')
        return 'opening_balance';
    if (normalized === 'fx' || normalized === 'fxr' || normalized === 'revaluation')
        return 'fx_revaluation';
    return normalized;
};
const normalizeField = (field) => {
    var _a, _b, _c, _d, _e;
    return (Object.assign(Object.assign({}, field), { name: field.name || field.id, isPosting: (_a = field.isPosting) !== null && _a !== void 0 ? _a : false, postingRole: (_b = field.postingRole) !== null && _b !== void 0 ? _b : null, fieldClass: inferFieldClass(field), bindingTarget: 'payload', nameLocked: true, computed: (_e = (_d = (_c = field.computed) !== null && _c !== void 0 ? _c : field.calculated) !== null && _d !== void 0 ? _d : field.autoManaged) !== null && _e !== void 0 ? _e : false, schemaVersion: 2 }));
};
const lineField = (field) => {
    var _a, _b, _c;
    return normalizeField(Object.assign({ required: (_b = (_a = field.required) !== null && _a !== void 0 ? _a : field.mandatory) !== null && _b !== void 0 ? _b : false, readOnly: (_c = field.readOnly) !== null && _c !== void 0 ? _c : false }, field));
};
const fieldsFromColumns = (columns = []) => columns.map((column) => {
    var _a, _b;
    return lineField({
        id: column.fieldId,
        label: column.label || column.labelOverride || column.fieldId,
        type: column.type || 'TEXT',
        mandatory: (_a = column.mandatory) !== null && _a !== void 0 ? _a : false,
        readOnly: (_b = column.readOnly) !== null && _b !== void 0 ? _b : false,
    });
});
const templates = [
    // --- ACCOUNTING VOUCHERS ---
    {
        name: "Journal Entry",
        code: "journal_entry",
        module: "ACCOUNTING",
        sidebarGroup: "Vouchers",
        prefix: "JV",
        headerFields: [
            { id: "date", label: "Date", type: "DATE", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.DATE },
            { id: "currency", label: "Currency", type: "CURRENCY_SELECT", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.CURRENCY },
            { id: "exchangeRate", label: "Exchange Rate", type: "NUMBER", defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.EXCHANGE_RATE },
            { id: "reference", label: "Reference", type: "TEXT", category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
            { id: "description", label: "Description", type: "TEXT", category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null }
        ],
        tableColumns: [
            { fieldId: "accountId", label: "Account", type: "account-selector", width: "220px", mandatory: true },
            { fieldId: "side", label: "Side", type: "SELECT", width: "100px", mandatory: true },
            { fieldId: "amount", label: "Amount", type: "NUMBER", width: "120px", mandatory: true },
            { fieldId: "currency", label: "Currency", type: "currency-selector", width: "110px" },
            { fieldId: "exchangeRate", label: "Parity", type: "NUMBER", width: "110px" },
            { fieldId: "equivalent", label: "Equivalent", type: "NUMBER", width: "120px", readOnly: true },
            { fieldId: "notes", label: "Notes", type: "TEXT", width: "180px" },
            { fieldId: "costCenterId", label: "Cost Center", type: "cost-center-selector", width: "160px" }
        ],
        layout: {
            lineFields: [
                lineField({ id: "accountId", label: "Account", type: "account-selector", mandatory: true }),
                lineField({ id: "side", label: "Side", type: "SELECT", mandatory: true }),
                lineField({ id: "amount", label: "Amount", type: "NUMBER", mandatory: true }),
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
        module: "ACCOUNTING",
        sidebarGroup: "Vouchers",
        prefix: "PV",
        headerFields: [
            { id: "date", label: "Date", type: "DATE", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.DATE },
            { id: "payFromAccountId", label: "Paid From", type: "ACCOUNT_SELECT", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.ACCOUNT },
            { id: "currency", label: "Currency", type: "CURRENCY_SELECT", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.CURRENCY },
            { id: "exchangeRate", label: "Exchange Rate", type: "NUMBER", defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.EXCHANGE_RATE },
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
        module: "ACCOUNTING",
        sidebarGroup: "Vouchers",
        prefix: "RV",
        headerFields: [
            { id: "date", label: "Date", type: "DATE", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.DATE },
            { id: "depositToAccountId", label: "Deposit To", type: "ACCOUNT_SELECT", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.ACCOUNT },
            { id: "currency", label: "Currency", type: "CURRENCY_SELECT", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.CURRENCY },
            { id: "exchangeRate", label: "Exchange Rate", type: "NUMBER", defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.EXCHANGE_RATE },
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
        module: "ACCOUNTING",
        sidebarGroup: "Vouchers",
        prefix: "OB",
        headerFields: [
            { id: "date", label: "Date", type: "DATE", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.DATE },
            { id: "description", label: "Description", type: "TEXT", category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null }
        ],
        tableColumns: [
            { fieldId: "accountId", label: "Account", type: "account-selector", width: "220px", mandatory: true },
            { fieldId: "side", label: "Side", type: "SELECT", width: "100px", mandatory: true },
            { fieldId: "amount", label: "Amount", type: "NUMBER", width: "120px", mandatory: true },
            { fieldId: "notes", label: "Notes", type: "TEXT", width: "180px" },
            { fieldId: "costCenterId", label: "Cost Center", type: "cost-center-selector", width: "160px" }
        ],
        layout: {
            lineFields: fieldsFromColumns([
                { fieldId: "accountId", label: "Account", type: "account-selector", mandatory: true },
                { fieldId: "side", label: "Side", type: "SELECT", mandatory: true },
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
        module: "ACCOUNTING",
        sidebarGroup: "Vouchers",
        prefix: "FXR",
        headerFields: [
            { id: "date", label: "As Of Date", type: "DATE", required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.DATE },
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
    // --- SALES VOUCHERS ---
    {
        name: "Sales Order",
        code: "sales_order",
        module: "SALES",
        sidebarGroup: "Documents",
        prefix: "SO",
        headerFields: [
            { id: 'orderDate', label: 'Order Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'customerId', label: 'Customer', type: 'party-selector', relationTarget: 'customers', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false },
            { id: 'notes', label: 'Internal Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
        ],
        tableColumns: [
            { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
            { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', width: '180px' },
            { fieldId: 'orderedQty', label: 'Quantity', width: '100px', mandatory: true },
            { fieldId: 'uom', label: 'UOM', width: '90px' },
            { fieldId: 'unitPriceDoc', label: 'Unit Price', width: '120px' },
            { fieldId: 'taxCodeId', label: 'Tax Code', width: '130px' },
            { fieldId: 'lineTotal', label: 'Line Total', width: '120px', readOnly: true },
            { fieldId: 'description', label: 'Description', width: '220px' },
        ],
        layout: {
            lineFields: fieldsFromColumns([
                { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
                { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector' },
                { fieldId: 'orderedQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
                { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
                { fieldId: 'unitPriceDoc', label: 'Unit Price', type: 'NUMBER' },
                { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT' },
                { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true },
                { fieldId: 'description', label: 'Description', type: 'TEXT' },
            ]),
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
            { id: 'date', label: 'Invoice Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.DATE },
            { id: 'customerId', label: 'Customer', type: 'party-selector', relationTarget: 'customers', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: false, postingRole: null },
            { id: 'salesOrderId', label: 'Sales Order', type: 'SELECT', relationTarget: 'sales_orders', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
            { id: 'warehouseId', label: 'Default Warehouse', type: 'warehouse-selector', relationTarget: 'warehouses', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
            { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.CURRENCY },
            { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.EXCHANGE_RATE },
            { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, category: 'shared', mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole_1.PostingRole.AMOUNT },
            { id: 'description', label: 'Description', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
        ],
        tableColumns: [
            { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
            { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', width: '180px' },
            { fieldId: 'invoicedQty', label: 'Quantity', width: '100px', mandatory: true },
            { fieldId: 'uom', label: 'UOM', width: '90px' },
            { fieldId: 'unitPriceDoc', label: 'Unit Price', width: '120px' },
            { fieldId: 'taxCodeId', label: 'Tax Code', width: '130px' },
            { fieldId: 'lineTotal', label: 'Line Total', width: '120px', readOnly: true },
            { fieldId: 'description', label: 'Description', width: '220px' },
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
                { id: 'header', title: 'Invoice Details', fieldIds: ['date', 'customerId', 'salesOrderId', 'warehouseId', 'currency', 'exchangeRate', 'totalAmount', 'description'] },
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
        name: "Delivery Note",
        code: "delivery_note",
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
            { fieldId: 'soLineId', label: 'SO Line', width: '130px' },
            { fieldId: 'deliveredQty', label: 'Quantity', width: '100px', mandatory: true },
            { fieldId: 'uom', label: 'UOM', width: '90px' },
            { fieldId: 'description', label: 'Description', width: '220px' },
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
        module: "SALES",
        sidebarGroup: "Documents",
        prefix: "SR",
        headerFields: [
            { id: 'returnDate', label: 'Return Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'salesInvoiceId', label: 'Sales Invoice', type: 'SELECT', relationTarget: 'sales_invoices', category: 'shared', mandatory: false, autoManaged: false },
            { id: 'deliveryNoteId', label: 'Delivery Note', type: 'SELECT', relationTarget: 'delivery_notes', category: 'shared', mandatory: false, autoManaged: false },
            { id: 'salesOrderId', label: 'Sales Order', type: 'SELECT', relationTarget: 'sales_orders', category: 'shared', mandatory: false, autoManaged: false },
            { id: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', relationTarget: 'warehouses', category: 'shared', mandatory: false, autoManaged: false },
            { id: 'reason', label: 'Reason', type: 'TEXT', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'notes', label: 'Notes', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
        ],
        tableColumns: [
            { fieldId: 'itemId', label: 'Item', type: 'item-selector', width: '220px', mandatory: true },
            { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', width: '180px' },
            { fieldId: 'returnQty', label: 'Quantity', width: '100px', mandatory: true },
            { fieldId: 'uom', label: 'UOM', width: '90px' },
            { fieldId: 'taxCodeId', label: 'Tax Code', width: '130px' },
            { fieldId: 'description', label: 'Description', width: '220px' },
        ],
        layout: {
            lineFields: fieldsFromColumns([
                { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
                { fieldId: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector' },
                { fieldId: 'returnQty', label: 'Quantity', type: 'NUMBER', mandatory: true },
                { fieldId: 'uom', label: 'UOM', type: 'TEXT' },
                { fieldId: 'taxCodeId', label: 'Tax Code', type: 'SELECT' },
                { fieldId: 'description', label: 'Description', type: 'TEXT' },
            ]),
            sections: [
                { id: 'header', title: 'Return Details', fieldIds: ['returnDate', 'salesInvoiceId', 'deliveryNoteId', 'salesOrderId', 'warehouseId', 'reason', 'notes'] },
                { id: 'lines', title: 'Return Lines', fieldIds: ['lineItems'] },
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
            lineFields: fieldsFromColumns([
                { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
                { fieldId: 'quantity', label: 'Quantity', type: 'NUMBER', mandatory: true },
                { fieldId: 'unitPrice', label: 'Unit Price', type: 'NUMBER' },
                { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true },
            ]),
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
            { id: 'date', label: 'Invoice Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.DATE },
            { id: 'supplierId', label: 'Supplier', type: 'SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: false, postingRole: null },
            { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.CURRENCY },
            { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.EXCHANGE_RATE },
            { id: 'totalAmount', label: 'Total Amount', type: 'NUMBER', required: false, readOnly: true, calculated: true, category: 'shared', mandatory: false, autoManaged: true, isPosting: true, postingRole: PostingRole_1.PostingRole.AMOUNT },
            { id: 'description', label: 'Description', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false, isPosting: false, postingRole: null },
        ],
        tableColumns: [
            { fieldId: 'itemId', width: '220px', mandatory: true },
            { fieldId: 'quantity', width: '100px', mandatory: true },
            { fieldId: 'unitPrice', width: '100px' },
            { fieldId: 'lineTotal', width: '120px' },
        ],
        layout: {
            lineFields: fieldsFromColumns([
                { fieldId: 'itemId', label: 'Item', type: 'item-selector', mandatory: true },
                { fieldId: 'quantity', label: 'Quantity', type: 'NUMBER', mandatory: true },
                { fieldId: 'unitPrice', label: 'Unit Price', type: 'NUMBER' },
                { fieldId: 'lineTotal', label: 'Line Total', type: 'NUMBER', readOnly: true },
            ]),
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
    },
    {
        name: "Goods Receipt",
        code: "goods_receipt",
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
        module: "PURCHASE",
        sidebarGroup: "Documents",
        prefix: "PR",
        headerFields: [
            { id: 'returnDate', label: 'Return Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.DATE },
            { id: 'purchaseInvoiceId', label: 'Purchase Invoice', type: 'SELECT', relationTarget: 'purchase_invoices', category: 'shared', mandatory: false, autoManaged: false },
            { id: 'goodsReceiptId', label: 'Goods Receipt', type: 'SELECT', relationTarget: 'goods_receipts', category: 'shared', mandatory: false, autoManaged: false },
            { id: 'purchaseOrderId', label: 'Purchase Order', type: 'SELECT', relationTarget: 'purchase_orders', category: 'shared', mandatory: false, autoManaged: false },
            { id: 'vendorId', label: 'Vendor', type: 'party-selector', relationTarget: 'vendors', category: 'shared', mandatory: false, autoManaged: false },
            { id: 'warehouseId', label: 'Warehouse', type: 'warehouse-selector', relationTarget: 'warehouses', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.CURRENCY },
            { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, required: true, category: 'core', mandatory: true, autoManaged: false, isPosting: true, postingRole: PostingRole_1.PostingRole.EXCHANGE_RATE },
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
const seedSystemVoucherTypes = async (repo) => {
    var _a, _b;
    console.log('Seeding System Voucher Types...');
    const existingTemplates = await repo.getSystemTemplates();
    for (const t of templates) {
        try {
            const existing = existingTemplates.find(ex => canonicalizeTemplateCode(ex.code) === canonicalizeTemplateCode(t.code));
            const id = existing ? existing.id : (0, crypto_1.randomUUID)();
            const headerFields = t.headerFields.map((f) => normalizeField(f));
            const layout = Object.assign(Object.assign({}, (t.layout || {})), { lineFields: Array.isArray((_a = t.layout) === null || _a === void 0 ? void 0 : _a.lineFields)
                    ? t.layout.lineFields.map((f) => normalizeField(f))
                    : undefined });
            const def = new VoucherTypeDefinition_1.VoucherTypeDefinition(id, SYSTEM_COMPANY_ID, t.name, t.code, t.module, headerFields, t.tableColumns, layout, 2, undefined, t.workflow, t.uiModeOverrides, (_b = t.isMultiLine) !== null && _b !== void 0 ? _b : true, t.rules || [], t.actions || [], t.defaultCurrency);
            // FIX 2: Convert class instance to plain object for Firestore compatibility
            const plainObject = JSON.parse(JSON.stringify(def));
            if (existing) {
                await repo.updateVoucherType(SYSTEM_COMPANY_ID, id, plainObject);
                console.log(`  🔄 Updated template: ${t.name} (${t.code})`);
            }
            else {
                await repo.createVoucherType(plainObject);
                console.log(`  ✅ Created template: ${t.name} (${t.code})`);
            }
        }
        catch (err) {
            console.error(`  ❌ Failed to seed template ${t.name}:`, err.message);
        }
    }
    console.log('System Voucher Types Seeding Complete.');
};
exports.seedSystemVoucherTypes = seedSystemVoucherTypes;
//# sourceMappingURL=seedSystemVoucherTypes.js.map