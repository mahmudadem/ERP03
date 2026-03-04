/**
 * Seed Refined Default Voucher Types to system_metadata/voucher_types/items
 * 
 * Run with: npm run seed:vouchers
 */

// Force Firestore Emulator usage for local seeding
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

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
      { id: 'voucherNumber', label: 'voucherNumber', type: 'text', order: 0 },
      { id: 'description', label: 'description', type: 'text', order: 2 },
      { id: 'status', label: 'status', type: 'text', order: 0 },
      { id: 'createdBy', label: 'createdBy', type: 'text', order: 0 },
      { id: 'createdAt', label: 'createdAt', type: 'text', order: 0 },
      { id: 'date', label: 'date', type: 'text', order: 0 },
      { id: 'account', label: 'account', type: 'text', order: 1 },
      { id: 'currency', label: 'currency', type: 'text', order: 1 },
      { id: 'currencyExchange', label: 'currencyExchange', type: 'text', order: 1 },
    ],
    tableColumns: [
      { id: 'payToAccountId', fieldId: 'payToAccountId', label: 'payToAccountId', labelOverride: 'payToAccountId', width: '200px', type: 'text', order: 0 },
      { id: 'amount', fieldId: 'amount', label: 'amount', labelOverride: 'amount', width: '100px', type: 'text', order: 0 },
      { id: 'notes', fieldId: 'notes', label: 'notes', labelOverride: 'notes', width: '200px', type: 'text', order: 0 },
    ],
    uiModeOverrides: {
      classic: {
        sections: {
          EXTRA: { fields: [], order: 2 },
          ACTIONS: {
            fields: [
              { fieldId: 'action_download_pdf', row: 0, col: 0, colSpan: 12 },
              { fieldId: 'action_download_excel', row: 1, col: 0, colSpan: 12 },
              { fieldId: 'action_import_csv', row: 2, col: 0, colSpan: 12 },
            ],
            order: 3,
          },
          HEADER: {
            fields: [
              { fieldId: 'voucherNumber', row: 0, col: 0, colSpan: 12 },
              { fieldId: 'status', row: 1, col: 0, colSpan: 12 },
              { fieldId: 'createdBy', row: 2, col: 0, colSpan: 12 },
              { fieldId: 'createdAt', row: 3, col: 0, colSpan: 12 },
              { fieldId: 'date', row: 4, col: 0, colSpan: 12 },
              { fieldId: 'description', row: 5, col: 0, colSpan: 12 },
              { fieldId: 'currency', row: 6, col: 0, colSpan: 12 },
              { fieldId: 'currencyExchange', row: 7, col: 0, colSpan: 12 },
              { fieldId: 'account', row: 8, col: 0, colSpan: 12 },
            ],
            order: 0,
          },
          BODY: { fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }], order: 1 },
        },
      },
      windows: {
        sections: {
          EXTRA: { fields: [], order: 2 },
          ACTIONS: {
            fields: [
              { fieldId: 'action_download_excel', row: 0, col: 4, colSpan: 4 },
              { fieldId: 'action_import_csv', row: 0, col: 8, colSpan: 4 },
              { fieldId: 'action_download_pdf', row: 0, col: 0, colSpan: 4 },
            ],
            order: 3,
          },
          HEADER: {
            fields: [
              { fieldId: 'voucherNumber', row: 0, col: 0, colSpan: 2 },
              { fieldId: 'description', row: 2, col: 0, colSpan: 12 },
              { fieldId: 'status', row: 0, col: 2, colSpan: 2 },
              { fieldId: 'createdBy', row: 0, col: 4, colSpan: 2 },
              { fieldId: 'createdAt', row: 0, col: 6, colSpan: 2 },
              { fieldId: 'date', row: 0, col: 8, colSpan: 4 },
              { fieldId: 'account', row: 1, col: 0, colSpan: 3 },
              { fieldId: 'currency', row: 1, col: 3, colSpan: 3 },
              { fieldId: 'currencyExchange', row: 1, col: 6, colSpan: 6 },
            ],
            order: 0,
          },
          BODY: { fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }], order: 1 },
        },
      },
    },
    layout: {
      classic: {
        sections: {
          HEADER: {
            order: 0,
            fields: [
              { fieldId: 'voucherNumber', row: 0, col: 0, colSpan: 12 },
              { fieldId: 'status', row: 1, col: 0, colSpan: 12 },
              { fieldId: 'createdBy', row: 2, col: 0, colSpan: 12 },
              { fieldId: 'createdAt', row: 3, col: 0, colSpan: 12 },
              { fieldId: 'date', row: 4, col: 0, colSpan: 12 },
              { fieldId: 'description', row: 5, col: 0, colSpan: 12 },
              { fieldId: 'currency', row: 6, col: 0, colSpan: 12 },
              { fieldId: 'currencyExchange', row: 7, col: 0, colSpan: 12 },
              { fieldId: 'account', row: 8, col: 0, colSpan: 12 },
            ],
          },
          BODY: { order: 1, fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }] },
          EXTRA: { order: 2, fields: [] },
          ACTIONS: {
            order: 3,
            fields: [
              { fieldId: 'action_download_pdf', row: 0, col: 0, colSpan: 12 },
              { fieldId: 'action_download_excel', row: 1, col: 0, colSpan: 12 },
              { fieldId: 'action_import_csv', row: 2, col: 0, colSpan: 12 },
            ],
          },
        },
      },
      windows: {
        sections: {
          HEADER: {
            order: 0,
            fields: [
              { fieldId: 'voucherNumber', row: 0, col: 0, colSpan: 2 },
              { fieldId: 'description', row: 2, col: 0, colSpan: 12 },
              { fieldId: 'status', row: 0, col: 2, colSpan: 2 },
              { fieldId: 'createdBy', row: 0, col: 4, colSpan: 2 },
              { fieldId: 'createdAt', row: 0, col: 6, colSpan: 2 },
              { fieldId: 'date', row: 0, col: 8, colSpan: 4 },
              { fieldId: 'account', row: 1, col: 0, colSpan: 3 },
              { fieldId: 'currency', row: 1, col: 3, colSpan: 3 },
              { fieldId: 'currencyExchange', row: 1, col: 6, colSpan: 6 },
            ],
          },
          BODY: { order: 1, fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }] },
          EXTRA: { order: 2, fields: [] },
          ACTIONS: {
            order: 3,
            fields: [
              { fieldId: 'action_download_excel', row: 0, col: 4, colSpan: 4 },
              { fieldId: 'action_import_csv', row: 0, col: 8, colSpan: 4 },
              { fieldId: 'action_download_pdf', row: 0, col: 0, colSpan: 4 },
            ],
          },
        },
      },
    },
    isMultiLine: true,
    requiresApproval: true,
    rules: COMMON_RULES,
    actions: COMMON_ACTIONS,
    enabledActions: ['download_pdf', 'download_excel', 'import_csv'],
    tableStyle: 'classic',
    defaultCurrency: '',
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
      { id: 'voucherNumber', label: 'voucherNumber', type: 'text', order: 0 },
      { id: 'description', label: 'description', type: 'text', order: 2 },
      { id: 'status', label: 'status', type: 'text', order: 0 },
      { id: 'createdBy', label: 'createdBy', type: 'text', order: 0 },
      { id: 'createdAt', label: 'createdAt', type: 'text', order: 0 },
      { id: 'date', label: 'date', type: 'text', order: 0 },
      { id: 'account', label: 'account', type: 'text', order: 1 },
      { id: 'currency', label: 'currency', type: 'text', order: 1 },
      { id: 'currencyExchange', label: 'currencyExchange', type: 'text', order: 1 },
    ],
    tableColumns: [
      { id: 'receiveFromAccountId', fieldId: 'receiveFromAccountId', label: 'receiveFromAccountId', labelOverride: 'receiveFromAccountId', width: '200px', type: 'text', order: 0 },
      { id: 'amount', fieldId: 'amount', label: 'amount', labelOverride: 'amount', width: '100px', type: 'text', order: 0 },
      { id: 'notes', fieldId: 'notes', label: 'notes', labelOverride: 'notes', width: '200px', type: 'text', order: 0 },
    ],
    uiModeOverrides: {
      classic: {
        sections: {
          EXTRA: { fields: [], order: 2 },
          ACTIONS: {
            fields: [
              { fieldId: 'action_download_pdf', row: 0, col: 0, colSpan: 12 },
              { fieldId: 'action_download_excel', row: 1, col: 0, colSpan: 12 },
              { fieldId: 'action_import_csv', row: 2, col: 0, colSpan: 12 },
            ],
            order: 3,
          },
          HEADER: {
            fields: [
              { fieldId: 'voucherNumber', row: 0, col: 0, colSpan: 12 },
              { fieldId: 'status', row: 1, col: 0, colSpan: 12 },
              { fieldId: 'createdBy', row: 2, col: 0, colSpan: 12 },
              { fieldId: 'createdAt', row: 3, col: 0, colSpan: 12 },
              { fieldId: 'date', row: 4, col: 0, colSpan: 12 },
              { fieldId: 'description', row: 5, col: 0, colSpan: 12 },
              { fieldId: 'currency', row: 6, col: 0, colSpan: 12 },
              { fieldId: 'currencyExchange', row: 7, col: 0, colSpan: 12 },
              { fieldId: 'account', row: 8, col: 0, colSpan: 12 },
            ],
            order: 0,
          },
          BODY: { fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }], order: 1 },
        },
      },
      windows: {
        sections: {
          EXTRA: { fields: [], order: 2 },
          ACTIONS: {
            fields: [
              { fieldId: 'action_download_excel', row: 0, col: 4, colSpan: 4 },
              { fieldId: 'action_import_csv', row: 0, col: 8, colSpan: 4 },
              { fieldId: 'action_download_pdf', row: 0, col: 0, colSpan: 4 },
            ],
            order: 3,
          },
          HEADER: {
            fields: [
              { fieldId: 'voucherNumber', row: 0, col: 0, colSpan: 2 },
              { fieldId: 'description', row: 2, col: 0, colSpan: 12 },
              { fieldId: 'status', row: 0, col: 2, colSpan: 2 },
              { fieldId: 'createdBy', row: 0, col: 4, colSpan: 2 },
              { fieldId: 'createdAt', row: 0, col: 6, colSpan: 2 },
              { fieldId: 'date', row: 0, col: 8, colSpan: 4 },
              { fieldId: 'account', row: 1, col: 0, colSpan: 3 },
              { fieldId: 'currency', row: 1, col: 3, colSpan: 3 },
              { fieldId: 'currencyExchange', row: 1, col: 6, colSpan: 6 },
            ],
            order: 0,
          },
          BODY: { fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }], order: 1 },
        },
      },
    },
    layout: {
      classic: {
        sections: {
          HEADER: {
            order: 0,
            fields: [
              { fieldId: 'voucherNumber', row: 0, col: 0, colSpan: 12 },
              { fieldId: 'status', row: 1, col: 0, colSpan: 12 },
              { fieldId: 'createdBy', row: 2, col: 0, colSpan: 12 },
              { fieldId: 'createdAt', row: 3, col: 0, colSpan: 12 },
              { fieldId: 'date', row: 4, col: 0, colSpan: 12 },
              { fieldId: 'description', row: 5, col: 0, colSpan: 12 },
              { fieldId: 'currency', row: 6, col: 0, colSpan: 12 },
              { fieldId: 'currencyExchange', row: 7, col: 0, colSpan: 12 },
              { fieldId: 'account', row: 8, col: 0, colSpan: 12 },
            ],
          },
          BODY: { order: 1, fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }] },
          EXTRA: { order: 2, fields: [] },
          ACTIONS: {
            order: 3,
            fields: [
              { fieldId: 'action_download_pdf', row: 0, col: 0, colSpan: 12 },
              { fieldId: 'action_download_excel', row: 1, col: 0, colSpan: 12 },
              { fieldId: 'action_import_csv', row: 2, col: 0, colSpan: 12 },
            ],
          },
        },
      },
      windows: {
        sections: {
          HEADER: {
            order: 0,
            fields: [
              { fieldId: 'voucherNumber', row: 0, col: 0, colSpan: 2 },
              { fieldId: 'description', row: 2, col: 0, colSpan: 12 },
              { fieldId: 'status', row: 0, col: 2, colSpan: 2 },
              { fieldId: 'createdBy', row: 0, col: 4, colSpan: 2 },
              { fieldId: 'createdAt', row: 0, col: 6, colSpan: 2 },
              { fieldId: 'date', row: 0, col: 8, colSpan: 4 },
              { fieldId: 'account', row: 1, col: 0, colSpan: 3 },
              { fieldId: 'currency', row: 1, col: 3, colSpan: 3 },
              { fieldId: 'currencyExchange', row: 1, col: 6, colSpan: 6 },
            ],
          },
          BODY: { order: 1, fields: [{ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }] },
          EXTRA: { order: 2, fields: [] },
          ACTIONS: {
            order: 3,
            fields: [
              { fieldId: 'action_download_excel', row: 0, col: 4, colSpan: 4 },
              { fieldId: 'action_import_csv', row: 0, col: 8, colSpan: 4 },
              { fieldId: 'action_download_pdf', row: 0, col: 0, colSpan: 4 },
            ],
          },
        },
      },
    },
    isMultiLine: true,
    requiresApproval: false,
    rules: COMMON_RULES,
    actions: COMMON_ACTIONS,
    enabledActions: ['download_pdf', 'download_excel', 'import_csv'],
    tableStyle: 'classic',
    defaultCurrency: '',
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
      
      const dataToSave = {
        ...voucherType,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      batch.set(docRef, dataToSave);
      console.log(`  ✅ Prepared: ${voucherType.name} (${voucherType.prefix})`);
    }
    
    await batch.commit();
    
    console.log('\n✅ SUCCESS! Refined voucher types seeded to Firestore');
    console.log(`   Location: system_metadata/voucher_types/items/`);
    console.log(`   Count: ${DEFAULT_VOUCHER_TYPES.length} voucher types seeded.`);
    
  } catch (error) {
    console.error('❌ ERROR: Failed to seed voucher types', error);
    process.exit(1);
  }
}

seedDefaultVoucherTypes()
  .then(() => {
    console.log('🎉 Seed completed successfully!\n');
    process.exit(0);
  });
