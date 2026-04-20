"use strict";
/**
 * Seed Refined Default Voucher Types to system_metadata/voucher_types/items
 *
 * Run with: npm run seed:vouchers
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
// Force Firestore Emulator usage for local seeding
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
// Initialize Firebase Admin for standalone execution
if (!admin.apps.length) {
    admin.initializeApp({
        projectId: process.env.GCLOUD_PROJECT,
    });
}
const db = admin.firestore();
const COMMON_RULES = [
    {
        id: 'require_approval',
        label: 'Require Approval Workflow',
        enabled: true,
        description: 'Vouchers must be approved by a supervisor.',
    },
    {
        id: 'prevent_negative_cash',
        label: 'Prevent Negative Cash',
        enabled: true,
        description: 'Block saving if cash accounts go negative.',
    },
    {
        id: 'allow_future_date',
        label: 'Allow Future Posting Dates',
        enabled: true,
        description: 'Users can select dates in the future.',
    },
    {
        id: 'mandatory_attachments',
        label: 'Mandatory Attachments',
        enabled: true,
        description: 'Require at least one file upload.',
    },
];
const COMMON_ACTIONS = [
    { type: 'print', label: 'Print Voucher', enabled: false },
    { type: 'email', label: 'Email PDF', enabled: false },
    { type: 'download_pdf', label: 'Download PDF', enabled: true },
    { type: 'download_excel', label: 'Download Excel', enabled: true },
    { type: 'import_csv', label: 'Import Lines (CSV)', enabled: true },
    { type: 'export_json', label: 'Export JSON', enabled: false },
];
// Enhanced voucher type definitions
const DEFAULT_VOUCHER_TYPES = [
    {
        id: 'journal_entry',
        code: 'JOURNAL_ENTRY',
        name: 'Journal Voucher',
        schemaVersion: 2,
        prefix: 'JV-',
        nextNumber: 1000,
        enabled: true,
        isRecommended: true,
        isSystemDefault: true,
        isLocked: true,
        inUse: false,
        baseType: 'JOURNAL_ENTRY',
        headerFields: [
            { id: 'date', label: 'Posting Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: true },
            { id: 'reference', label: 'Reference', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
            { id: 'description', label: 'Description', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
        ],
        tableColumns: [
            { id: 'account', fieldId: 'accountSelector', label: 'Account', width: '30%', mandatory: true },
            { id: 'debit', fieldId: 'debit', label: 'Debit', width: '15%', mandatory: true },
            { id: 'credit', fieldId: 'credit', label: 'Credit', width: '15%', mandatory: true },
            { id: 'currency', fieldId: 'currency', label: 'Currency', width: '10%' },
            { id: 'notes', fieldId: 'notes', label: 'Line Description', width: '30%' },
        ],
        rules: [
            { id: 'require_approval', label: 'Require Approval Workflow', enabled: true, description: 'Vouchers must be approved by a supervisor.' },
            { id: 'prevent_negative_cash', label: 'Prevent Negative Cash', enabled: false, description: 'Block saving if cash accounts go negative.' },
            { id: 'allow_future_date', label: 'Allow Future Posting Dates', enabled: true, description: 'Users can select dates in the future.' },
        ],
        actions: [
            { type: 'print', label: 'Print Voucher', enabled: true },
            { type: 'email', label: 'Email PDF', enabled: true },
            { type: 'download_pdf', label: 'Download PDF', enabled: true },
        ],
        layout: {
            sections: [
                { id: 'header', title: 'Voucher Header', fieldIds: ['date', 'currency', 'exchangeRate', 'reference', 'description'] },
                { id: 'lines', title: 'Entries', fieldIds: ['lineItems'] },
            ],
        },
        isMultiLine: true,
        tableStyle: 'web',
    },
    {
        id: 'payment_voucher',
        code: 'PAYMENT',
        name: 'Payment Voucher',
        schemaVersion: 2,
        prefix: 'PV-',
        nextNumber: 1000,
        enabled: true,
        isRecommended: true,
        isSystemDefault: true,
        isLocked: true,
        inUse: false,
        baseType: 'PAYMENT',
        headerFields: [
            { id: 'date', label: 'Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'account', label: 'Paid From Account', type: 'SELECT', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: true },
            { id: 'description', label: 'Description', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
        ],
        tableColumns: [
            { id: 'account', fieldId: 'accountSelector', label: 'Pay to Account', width: '40%', mandatory: true },
            { id: 'amount', fieldId: 'amount', label: 'Amount', width: '20%', mandatory: true },
            { id: 'notes', fieldId: 'notes', label: 'Description', width: '40%' },
        ],
        rules: [
            { id: 'require_approval', label: 'Require Approval Workflow', enabled: true, description: 'Vouchers must be approved.' },
        ],
        actions: [
            { type: 'print', label: 'Print Voucher', enabled: true },
            { type: 'download_pdf', label: 'Download PDF', enabled: true },
        ],
        layout: {
            sections: [
                { id: 'header', title: 'Payment Details', fieldIds: ['date', 'account', 'currency', 'exchangeRate', 'description'] },
                { id: 'lines', title: 'Payments', fieldIds: ['lineItems'] },
            ],
        },
        isMultiLine: true,
        tableStyle: 'web',
    },
    {
        id: 'receipt_voucher',
        code: 'RECEIPT',
        name: 'Receipt Voucher',
        schemaVersion: 2,
        prefix: 'RV-',
        nextNumber: 1000,
        enabled: true,
        isRecommended: true,
        isSystemDefault: true,
        isLocked: true,
        inUse: false,
        baseType: 'RECEIPT',
        headerFields: [
            { id: 'date', label: 'Date', type: 'DATE', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'account', label: 'Received Into Account', type: 'SELECT', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'currency', label: 'Currency', type: 'CURRENCY_SELECT', required: true, category: 'core', mandatory: true, autoManaged: false },
            { id: 'exchangeRate', label: 'Exchange Rate', type: 'NUMBER', defaultValue: 1, category: 'core', mandatory: true, autoManaged: true },
            { id: 'description', label: 'Description', type: 'TEXT', category: 'shared', mandatory: false, autoManaged: false },
        ],
        tableColumns: [
            { id: 'account', fieldId: 'accountSelector', label: 'Received From Account', width: '40%', mandatory: true },
            { id: 'amount', fieldId: 'amount', label: 'Amount', width: '20%', mandatory: true },
            { id: 'notes', fieldId: 'notes', label: 'Description', width: '40%' },
        ],
        rules: [
            { id: 'require_approval', label: 'Require Approval Workflow', enabled: true, description: 'Vouchers must be approved.' },
        ],
        actions: [
            { type: 'print', label: 'Print Voucher', enabled: true },
            { type: 'download_pdf', label: 'Download PDF', enabled: true },
        ],
        layout: {
            sections: [
                { id: 'header', title: 'Receipt Details', fieldIds: ['date', 'account', 'currency', 'exchangeRate', 'description'] },
                { id: 'lines', title: 'Receipts', fieldIds: ['lineItems'] },
            ],
        },
        isMultiLine: true,
        tableStyle: 'web',
    },
];
async function seedDefaultVoucherTypes() {
    console.log('🌱 Seeding Refined Default Voucher Types...');
    try {
        const batch = db.batch();
        for (const voucherType of DEFAULT_VOUCHER_TYPES) {
            const docRef = db
                .collection('system_metadata')
                .doc('voucher_types')
                .collection('items')
                .doc(voucherType.id);
            const dataToSave = Object.assign(Object.assign({}, voucherType), { createdAt: firestore_1.FieldValue.serverTimestamp(), updatedAt: firestore_1.FieldValue.serverTimestamp() });
            batch.set(docRef, dataToSave);
            console.log(`  ✅ Prepared: ${voucherType.name} (${voucherType.prefix})`);
        }
        await batch.commit();
        console.log('\n✅ SUCCESS! Refined voucher types seeded to Firestore');
        console.log(`   Location: system_metadata/voucher_types/items/`);
        console.log(`   Count: ${DEFAULT_VOUCHER_TYPES.length} voucher types seeded.`);
    }
    catch (error) {
        console.error('❌ ERROR: Failed to seed voucher types', error);
        process.exit(1);
    }
}
seedDefaultVoucherTypes()
    .then(() => {
    console.log('🎉 Seed completed successfully!\n');
    process.exit(0);
});
//# sourceMappingURL=seedDefaultVoucherTypes.js.map