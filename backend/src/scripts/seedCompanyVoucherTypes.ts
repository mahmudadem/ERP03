// Force Firestore Emulator usage for local seeding
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';

import * as admin from 'firebase-admin';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT,
  });
}

const db = admin.firestore();

const COMPANY_ID = 'cmp_mjc0ctvo_6v71ci'; // User provided ID

/**
 * Update seeder to use 'voucherNo' consistently as that's what's in the Domain Entity.
 */
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
          HEADER: { order: 1, fields: [ { fieldId: 'date', row: 0, col: 0, colSpan: 6 }, { fieldId: 'voucherNo', row: 0, col: 6, colSpan: 6 }, { fieldId: 'description', row: 1, col: 0, colSpan: 12 } ] },
          BODY: { order: 2, fields: [ { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 } ] },
          EXTRA: { order: 3, fields: [ { fieldId: 'notes', row: 0, col: 0, colSpan: 12 } ] }
        }
      },
      windows: {
        sections: {
          HEADER: { order: 1, fields: [ { fieldId: 'date', row: 0, col: 0, colSpan: 6 }, { fieldId: 'voucherNo', row: 0, col: 6, colSpan: 6 }, { fieldId: 'description', row: 1, col: 0, colSpan: 12 } ] },
          BODY: { order: 2, fields: [ { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 } ] },
          EXTRA: { order: 3, fields: [ { fieldId: 'notes', row: 0, col: 0, colSpan: 12 } ] }
        }
      }
    },
    isMultiLine: true,
    tableColumns: ['account', 'debit', 'credit', 'notes'],
    requiresApproval: false,
    preventNegativeCash: false,
    allowFutureDates: true,
    mandatoryAttachments: false,
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
          HEADER: { order: 1, fields: [ { fieldId: 'date', row: 0, col: 0, colSpan: 6 }, { fieldId: 'voucherNo', row: 0, col: 6, colSpan: 6 }, { fieldId: 'payee', row: 1, col: 0, colSpan: 12 } ] },
          BODY: { order: 2, fields: [ { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 } ] },
          EXTRA: { order: 3, fields: [ { fieldId: 'notes', row: 0, col: 0, colSpan: 12 } ] }
        }
      },
      windows: {
        sections: {
          HEADER: { order: 1, fields: [ { fieldId: 'date', row: 0, col: 0, colSpan: 6 }, { fieldId: 'voucherNo', row: 0, col: 6, colSpan: 6 }, { fieldId: 'payee', row: 1, col: 0, colSpan: 12 } ] },
          BODY: { order: 2, fields: [ { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 } ] },
          EXTRA: { order: 3, fields: [ { fieldId: 'notes', row: 0, col: 0, colSpan: 12 } ] }
        }
      }
    },
    isMultiLine: true,
    tableColumns: ['account', 'debit', 'credit'],
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
          HEADER: { order: 1, fields: [ { fieldId: 'date', row: 0, col: 0, colSpan: 6 }, { fieldId: 'voucherNo', row: 0, col: 6, colSpan: 6 }, { fieldId: 'receivedFrom', row: 1, col: 0, colSpan: 12 } ] },
          BODY: { order: 2, fields: [ { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 } ] },
          EXTRA: { order: 3, fields: [ { fieldId: 'notes', row: 0, col: 0, colSpan: 12 } ] }
        }
      },
      windows: {
        sections: {
          HEADER: { order: 1, fields: [ { fieldId: 'date', row: 0, col: 0, colSpan: 6 }, { fieldId: 'voucherNo', row: 0, col: 6, colSpan: 6 }, { fieldId: 'receivedFrom', row: 1, col: 0, colSpan: 12 } ] },
          BODY: { order: 2, fields: [ { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 } ] },
          EXTRA: { order: 3, fields: [ { fieldId: 'notes', row: 0, col: 0, colSpan: 12 } ] }
        }
      }
    },
    isMultiLine: true,
    tableColumns: ['account', 'debit', 'credit'],
  },
  {
    id: 'sales_invoice',
    code: 'SALES_INVOICE',
    name: 'Sales Invoice',
    schemaVersion: 2,
    prefix: 'SINV-',
    nextNumber: 1000,
    enabled: true,
    isRecommended: true,
    isSystemDefault: true,
    layout: {
      classic: {
        sections: {
          HEADER: { order: 1, fields: [ { fieldId: 'date', row: 0, col: 0, colSpan: 6 }, { fieldId: 'voucherNo', row: 0, col: 6, colSpan: 6 }, { fieldId: 'customer', row: 1, col: 0, colSpan: 12 } ] },
          BODY: { order: 2, fields: [ { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 } ] },
          EXTRA: { order: 3, fields: [ { fieldId: 'notes', row: 0, col: 0, colSpan: 12 } ] }
        }
      },
      windows: {
        sections: {
          HEADER: { order: 1, fields: [ { fieldId: 'date', row: 0, col: 0, colSpan: 6 }, { fieldId: 'voucherNo', row: 0, col: 6, colSpan: 6 }, { fieldId: 'customer', row: 1, col: 0, colSpan: 12 } ] },
          BODY: { order: 2, fields: [ { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 } ] },
          EXTRA: { order: 3, fields: [ { fieldId: 'notes', row: 0, col: 0, colSpan: 12 } ] }
        }
      }
    },
    isMultiLine: true,
  },
  {
    id: 'purchase_invoice',
    code: 'PURCHASE_INVOICE',
    name: 'Purchase Invoice',
    schemaVersion: 2,
    prefix: 'PINV-',
    nextNumber: 1000,
    enabled: true,
    isRecommended: true,
    isSystemDefault: true,
    layout: {
      classic: {
        sections: {
          HEADER: { order: 1, fields: [ { fieldId: 'date', row: 0, col: 0, colSpan: 6 }, { fieldId: 'voucherNo', row: 0, col: 6, colSpan: 6 }, { fieldId: 'supplier', row: 1, col: 0, colSpan: 12 } ] },
          BODY: { order: 2, fields: [ { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 } ] },
          EXTRA: { order: 3, fields: [ { fieldId: 'notes', row: 0, col: 0, colSpan: 12 } ] }
        }
      },
      windows: {
        sections: {
          HEADER: { order: 1, fields: [ { fieldId: 'date', row: 0, col: 0, colSpan: 6 }, { fieldId: 'voucherNo', row: 0, col: 6, colSpan: 6 }, { fieldId: 'supplier', row: 1, col: 0, colSpan: 12 } ] },
          BODY: { order: 2, fields: [ { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 } ] },
          EXTRA: { order: 3, fields: [ { fieldId: 'notes', row: 0, col: 0, colSpan: 12 } ] }
        }
      }
    },
    isMultiLine: true,
  }
];

async function seedCompanyVoucherTypes() {
  console.log(`🌱 Seeding Voucher Types for company: ${COMPANY_ID}`);
  
  try {
    const batch = db.batch();
    
    for (const voucherType of DEFAULT_VOUCHER_TYPES) {
      const docRef = db
        .collection('companies')
        .doc(COMPANY_ID)
        .collection('voucherTypes')
        .doc(voucherType.id);
      
      const dataToSave = {
        ...voucherType,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      batch.set(docRef, dataToSave);
      console.log(`  ✅ Prepared: ${voucherType.name} (${voucherType.prefix})`);
    }
    
    await batch.commit();
    console.log(`✅ Success! Seeded voucher types to companies/${COMPANY_ID}/voucherTypes`);
  } catch (error) {
    console.error('❌ Error seeding voucher types:', error);
    process.exit(1);
  }
}

seedCompanyVoucherTypes().then(() => process.exit(0));
