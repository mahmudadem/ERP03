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
// Enhanced voucher type definitions
const DEFAULT_VOUCHER_TYPES = [
    {
        id: 'journal_entry',
        code: 'JOURNAL_ENTRY',
        name: 'Journal Entry',
        schemaVersion: 2,
        prefix: 'JE-',
        nextNumber: 1000,
        enabled: true,
        isRecommended: true,
        isSystemDefault: true,
        inUse: false,
        layout: {
            classic: {
                sections: {
                    HEADER: {
                        order: 1,
                        fields: [
                            { fieldId: 'date', row: 0, col: 0, colSpan: 6 },
                            { fieldId: 'voucherNumber', row: 0, col: 6, colSpan: 6 },
                            { fieldId: 'description', row: 1, col: 0, colSpan: 12 },
                        ]
                    },
                    BODY: { order: 2, fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }] },
                    EXTRA: { order: 3, fields: [{ fieldId: 'notes', row: 0, col: 0, colSpan: 12 }] },
                    ACTIONS: { order: 4, fields: [] }
                }
            },
            windows: {
                sections: {
                    HEADER: {
                        order: 1,
                        fields: [
                            { fieldId: 'date', row: 0, col: 0, colSpan: 4 },
                            { fieldId: 'voucherNumber', row: 0, col: 4, colSpan: 4 },
                            { fieldId: 'status', row: 0, col: 8, colSpan: 4 },
                            { fieldId: 'description', row: 1, col: 0, colSpan: 12 },
                        ]
                    },
                    BODY: { order: 2, fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }] },
                    EXTRA: { order: 3, fields: [{ fieldId: 'notes', row: 0, col: 0, colSpan: 12 }] },
                    ACTIONS: { order: 4, fields: [] }
                }
            }
        },
        isMultiLine: true,
        tableColumns: [
            { fieldId: 'account', width: '30%', labelOverride: 'Account' },
            { fieldId: 'debit', width: '20%', labelOverride: 'Debit' },
            { fieldId: 'credit', width: '20%', labelOverride: 'Credit' },
            { fieldId: 'notes', width: '30%', labelOverride: 'Line Description' }
        ],
        requiresApproval: false,
        enabledActions: ['print', 'email', 'download_pdf'],
    },
    {
        id: 'payment_voucher',
        code: 'PAYMENT_VOUCHER',
        name: 'Payment Voucher',
        schemaVersion: 2,
        prefix: 'PV-',
        nextNumber: 1000,
        enabled: true,
        isRecommended: true,
        isSystemDefault: true,
        inUse: false,
        layout: {
            classic: {
                sections: {
                    HEADER: {
                        order: 1,
                        fields: [
                            { fieldId: 'date', row: 0, col: 0, colSpan: 6 },
                            { fieldId: 'voucherNumber', row: 0, col: 6, colSpan: 6 },
                            { fieldId: 'payee', row: 1, col: 0, colSpan: 6 },
                            { fieldId: 'paymentMethod', row: 1, col: 6, colSpan: 6 },
                        ]
                    },
                    BODY: { order: 2, fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }] },
                    EXTRA: { order: 3, fields: [{ fieldId: 'notes', row: 0, col: 0, colSpan: 12 }] },
                    ACTIONS: { order: 4, fields: [] }
                }
            },
            windows: {
                sections: {
                    HEADER: {
                        order: 1,
                        fields: [
                            { fieldId: 'date', row: 0, col: 0, colSpan: 4 },
                            { fieldId: 'voucherNumber', row: 0, col: 4, colSpan: 4 },
                            { fieldId: 'status', row: 0, col: 8, colSpan: 4 },
                            { fieldId: 'payee', row: 1, col: 0, colSpan: 6 },
                            { fieldId: 'paymentMethod', row: 1, col: 6, colSpan: 6 },
                        ]
                    },
                    BODY: { order: 2, fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }] },
                    EXTRA: { order: 3, fields: [{ fieldId: 'notes', row: 0, col: 0, colSpan: 12 }] },
                    ACTIONS: { order: 4, fields: [] }
                }
            }
        },
        isMultiLine: true,
        tableColumns: [
            { fieldId: 'account', width: '40%', labelOverride: 'Expense/Asset Account' },
            { fieldId: 'amount', width: '20%', labelOverride: 'Amount' },
            { fieldId: 'reference', width: '20%', labelOverride: 'Ref #' },
            { fieldId: 'notes', width: '20%', labelOverride: 'Notes' }
        ],
        requiresApproval: true,
        enabledActions: ['print', 'email', 'download_pdf'],
    },
    {
        id: 'receipt_voucher',
        code: 'RECEIPT_VOUCHER',
        name: 'Receipt Voucher',
        schemaVersion: 2,
        prefix: 'RV-',
        nextNumber: 1000,
        enabled: true,
        isRecommended: true,
        isSystemDefault: true,
        inUse: false,
        layout: {
            classic: {
                sections: {
                    HEADER: {
                        order: 1,
                        fields: [
                            { fieldId: 'date', row: 0, col: 0, colSpan: 6 },
                            { fieldId: 'voucherNumber', row: 0, col: 6, colSpan: 6 },
                            { fieldId: 'receivedFrom', row: 1, col: 0, colSpan: 6 },
                            { fieldId: 'receiptMethod', row: 1, col: 6, colSpan: 6 },
                        ]
                    },
                    BODY: { order: 2, fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }] },
                    EXTRA: { order: 3, fields: [{ fieldId: 'notes', row: 0, col: 0, colSpan: 12 }] },
                    ACTIONS: { order: 4, fields: [] }
                }
            },
            windows: {
                sections: {
                    HEADER: {
                        order: 1,
                        fields: [
                            { fieldId: 'date', row: 0, col: 0, colSpan: 4 },
                            { fieldId: 'voucherNumber', row: 0, col: 4, colSpan: 4 },
                            { fieldId: 'status', row: 0, col: 8, colSpan: 4 },
                            { fieldId: 'receivedFrom', row: 1, col: 0, colSpan: 6 },
                            { fieldId: 'receiptMethod', row: 1, col: 6, colSpan: 6 },
                        ]
                    },
                    BODY: { order: 2, fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }] },
                    EXTRA: { order: 3, fields: [{ fieldId: 'notes', row: 0, col: 0, colSpan: 12 }] },
                    ACTIONS: { order: 4, fields: [] }
                }
            }
        },
        isMultiLine: true,
        tableColumns: [
            { fieldId: 'account', width: '40%', labelOverride: 'Inbound Account' },
            { fieldId: 'amount', width: '20%', labelOverride: 'Amount' },
            { fieldId: 'reference', width: '20%', labelOverride: 'Ref #' },
            { fieldId: 'notes', width: '20%', labelOverride: 'Notes' }
        ],
        requiresApproval: false,
        enabledActions: ['print', 'email', 'download_pdf'],
    },
    {
        id: 'transfer_voucher',
        code: 'TRANSFER_VOUCHER',
        name: 'Transfer Voucher',
        schemaVersion: 2,
        prefix: 'TRF-',
        nextNumber: 1000,
        enabled: true,
        isRecommended: true,
        isSystemDefault: true,
        inUse: false,
        layout: {
            classic: {
                sections: {
                    HEADER: {
                        order: 1,
                        fields: [
                            { fieldId: 'date', row: 0, col: 0, colSpan: 6 },
                            { fieldId: 'voucherNumber', row: 0, col: 6, colSpan: 6 },
                            { fieldId: 'fromAccount', row: 1, col: 0, colSpan: 6 },
                            { fieldId: 'toAccount', row: 1, col: 6, colSpan: 6 },
                            { fieldId: 'amount', row: 2, col: 0, colSpan: 4 },
                            { fieldId: 'exchangeRate', row: 2, col: 4, colSpan: 4 },
                            { fieldId: 'reference', row: 2, col: 8, colSpan: 4 },
                        ]
                    },
                    BODY: { order: 2, fields: [] },
                    EXTRA: { order: 3, fields: [{ fieldId: 'notes', row: 0, col: 0, colSpan: 12 }] },
                    ACTIONS: { order: 4, fields: [] }
                }
            },
            windows: {
                sections: {
                    HEADER: {
                        order: 1,
                        fields: [
                            { fieldId: 'date', row: 0, col: 0, colSpan: 4 },
                            { fieldId: 'voucherNumber', row: 0, col: 4, colSpan: 4 },
                            { fieldId: 'status', row: 0, col: 8, colSpan: 4 },
                            { fieldId: 'fromAccount', row: 1, col: 0, colSpan: 6 },
                            { fieldId: 'toAccount', row: 1, col: 6, colSpan: 6 },
                            { fieldId: 'fromAmount', row: 2, col: 0, colSpan: 4 },
                            { fieldId: 'toAmount', row: 2, col: 4, colSpan: 4 },
                            { fieldId: 'exchangeRate', row: 2, col: 8, colSpan: 4 },
                        ]
                    },
                    BODY: { order: 2, fields: [] },
                    EXTRA: { order: 3, fields: [{ fieldId: 'notes', row: 0, col: 0, colSpan: 12 }] },
                    ACTIONS: { order: 4, fields: [] }
                }
            }
        },
        isMultiLine: false,
        requiresApproval: true,
        enabledActions: ['print', 'email', 'download_pdf'],
    },
    {
        id: 'invoice',
        code: 'INVOICE',
        name: 'Invoice',
        schemaVersion: 2,
        prefix: 'INV-',
        nextNumber: 1000,
        enabled: true,
        isRecommended: true,
        isSystemDefault: true,
        inUse: false,
        layout: {
            classic: {
                sections: {
                    HEADER: {
                        order: 1,
                        fields: [
                            { fieldId: 'date', row: 0, col: 0, colSpan: 6 },
                            { fieldId: 'voucherNumber', row: 0, col: 6, colSpan: 6 },
                            { fieldId: 'customer', row: 1, col: 0, colSpan: 6 },
                            { fieldId: 'dueDate', row: 1, col: 6, colSpan: 6 },
                        ]
                    },
                    BODY: { order: 2, fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }] },
                    EXTRA: { order: 3, fields: [{ fieldId: 'notes', row: 0, col: 0, colSpan: 12 }] },
                    ACTIONS: { order: 4, fields: [] }
                }
            },
            windows: {
                sections: {
                    HEADER: {
                        order: 1,
                        fields: [
                            { fieldId: 'date', row: 0, col: 0, colSpan: 4 },
                            { fieldId: 'voucherNumber', row: 0, col: 4, colSpan: 4 },
                            { fieldId: 'status', row: 0, col: 8, colSpan: 4 },
                            { fieldId: 'customer', row: 1, col: 0, colSpan: 8 },
                            { fieldId: 'dueDate', row: 1, col: 8, colSpan: 4 },
                        ]
                    },
                    BODY: { order: 2, fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }] },
                    EXTRA: { order: 3, fields: [{ fieldId: 'notes', row: 0, col: 0, colSpan: 12 }] },
                    ACTIONS: { order: 4, fields: [] }
                }
            }
        },
        isMultiLine: true,
        tableColumns: [
            { fieldId: 'item', width: '30%', labelOverride: 'Product/Service' },
            { fieldId: 'quantity', width: '10%', labelOverride: 'Qty' },
            { fieldId: 'rate', width: '15%', labelOverride: 'Unit Price' },
            { fieldId: 'amount', width: '15%', labelOverride: 'Total' },
            { fieldId: 'vatPercent', width: '10%', labelOverride: 'VAT %' },
            { fieldId: 'notes', width: '20%', labelOverride: 'Description' }
        ],
        requiresApproval: false,
        enabledActions: ['print', 'email', 'download_pdf', 'download_excel'],
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