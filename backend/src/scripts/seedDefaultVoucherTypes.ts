/**
 * Seed Default Voucher Types to system_metadata/voucher_types/items
 * 
 * Run with: npm run seed:vouchers
 */

// Force Firestore Emulator usage for local seeding
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';

import * as admin from 'firebase-admin';

// Initialize Firebase Admin for standalone execution
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT,
  });
}

console.log(`🔧 Using Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
console.log(`🔧 Project ID: ${process.env.GCLOUD_PROJECT}\n`);

const db = admin.firestore();

// Default voucher type definitions
const DEFAULT_VOUCHER_TYPES = [
  {
    id: 'journal_entry',
    code: 'JOURNAL_ENTRY',
    name: 'Journal Entry',
    schemaVersion: 2,
    prefix: 'JE-',
    nextNumber: 1000,
    enabled: true,
    isRecommended: true, // Recommended for all businesses
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
          BODY: {
            order: 2,
            fields: [
              { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }
            ]
          },
          EXTRA: {
            order: 3,
            fields: [
              { fieldId: 'notes', row: 0, col: 0, colSpan: 12 }
            ]
          },
          ACTIONS: {
            order: 4,
            fields: []
          }
        }
      },
      windows: {
        sections: {
          HEADER: {
            order: 1,
            fields: [
              { fieldId: 'date', row: 0, col: 0, colSpan: 6 },
              { fieldId: 'voucherNumber', row: 0, col: 6, colSpan: 6 },
              { fieldId: 'description', row: 1, col: 0, colSpan: 12 },
            ]
          },
          BODY: {
            order: 2,
            fields: [
              { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }
            ]
          },
          EXTRA: {
            order: 3,
            fields: [
              { fieldId: 'notes', row: 0, col: 0, colSpan: 12 }
            ]
          },
          ACTIONS: {
            order: 4,
            fields: []
          }
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
          HEADER: {
            order: 1,
            fields: [
              { fieldId: 'date', row: 0, col: 0, colSpan: 6 },
              { fieldId: 'voucherNumber', row: 0, col: 6, colSpan: 6 },
              { fieldId: 'payee', row: 1, col: 0, colSpan: 12 },
            ]
          },
          BODY: {
            order: 2,
            fields: [
              { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }
            ]
          },
          EXTRA: {
            order: 3,
            fields: [
              { fieldId: 'notes', row: 0, col: 0, colSpan: 12 }
            ]
          },
          ACTIONS: {
            order: 4,
            fields: []
          }
        }
      },
      windows: {
        sections: {
          HEADER: {
            order: 1,
            fields: [
              { fieldId: 'date', row: 0, col: 0, colSpan: 6 },
              { fieldId: 'voucherNumber', row: 0, col: 6, colSpan: 6 },
              { fieldId: 'payee', row: 1, col: 0, colSpan: 12 },
            ]
          },
          BODY: {
            order: 2,
            fields: [
              { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }
            ]
          },
          EXTRA: {
            order: 3,
            fields: [
              { fieldId: 'notes', row: 0, col: 0, colSpan: 12 }
            ]
          },
          ACTIONS: {
            order: 4,
            fields: []
          }
        }
      }
    },
    
    isMultiLine: true,
    tableColumns: ['account', 'debit', 'credit'],
    
    requiresApproval: true,
    preventNegativeCash: true,
    allowFutureDates: false,
    mandatoryAttachments: false,
    
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
              { fieldId: 'receivedFrom', row: 1, col: 0, colSpan: 12 },
            ]
          },
          BODY: {
            order: 2,
            fields: [
              { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }
            ]
          },
          EXTRA: {
            order: 3,
            fields: [
              { fieldId: 'notes', row: 0, col: 0, colSpan: 12 }
            ]
          },
          ACTIONS: {
            order: 4,
            fields: []
          }
        }
      },
      windows: {
        sections: {
          HEADER: {
            order: 1,
            fields: [
              { fieldId: 'date', row: 0, col: 0, colSpan: 6 },
              { fieldId: 'voucherNumber', row: 0, col: 6, colSpan: 6 },
              { fieldId: 'receivedFrom', row: 1, col: 0, colSpan: 12 },
            ]
          },
          BODY: {
            order: 2,
            fields: [
              { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }
            ]
          },
          EXTRA: {
            order: 3,
            fields: [
              { fieldId: 'notes', row: 0, col: 0, colSpan: 12 }
            ]
          },
          ACTIONS: {
            order: 4,
            fields: []
          }
        }
      }
    },
    
    isMultiLine: true,
    tableColumns: ['account', 'debit', 'credit'],
    
    requiresApproval: false,
    preventNegativeCash: false,
    allowFutureDates: false,
    mandatoryAttachments: false,
    
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
              { fieldId: 'customer', row: 1, col: 0, colSpan: 12 },
            ]
          },
          BODY: {
            order: 2,
            fields: [
              { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }
            ]
          },
          EXTRA: {
            order: 3,
            fields: [
              { fieldId: 'notes', row: 0, col: 0, colSpan: 12 }
            ]
          },
          ACTIONS: {
            order: 4,
            fields: []
          }
        }
      },
      windows: {
        sections: {
          HEADER: {
            order: 1,
            fields: [
              { fieldId: 'date', row: 0, col: 0, colSpan: 6 },
              { fieldId: 'voucherNumber', row: 0, col: 6, colSpan: 6 },
              { fieldId: 'customer', row: 1, col: 0, colSpan: 12 },
            ]
          },
          BODY: {
            order: 2,
            fields: [
              { fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 }
            ]
          },
          EXTRA: {
            order: 3,
            fields: [
              { fieldId: 'notes', row: 0, col: 0, colSpan: 12 }
            ]
          },
          ACTIONS: {
            order: 4,
            fields: []
          }
        }
      }
    },
    
    isMultiLine: true,
    tableColumns: ['account', 'debit', 'notes'],
    
    requiresApproval: false,
    preventNegativeCash: false,
    allowFutureDates: true,
    mandatoryAttachments: false,
    
    enabledActions: ['print', 'email', 'download_pdf'],
  },
];

async function seedDefaultVoucherTypes() {
  console.log('🌱 Seeding Default Voucher Types...');
  console.log('');
  
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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      batch.set(docRef, dataToSave);
      console.log(`  ✅ Prepared: ${voucherType.name} (${voucherType.prefix})`);
    }
    
    await batch.commit();
    
    console.log('');
    console.log('✅ SUCCESS! Seeded default voucher types to Firestore');
    console.log(`   Location: system_metadata/voucher_types/items/`);
    console.log(`   Count: ${DEFAULT_VOUCHER_TYPES.length} voucher types`);
    console.log('');
    console.log('Default Voucher Types:');
    DEFAULT_VOUCHER_TYPES.forEach(vt => {
      console.log(`  - ${vt.name} (${vt.prefix}) - ${vt.code}`);
    });
    console.log('');
    
  } catch (error) {
    console.error('❌ ERROR: Failed to seed voucher types', error);
    throw error;
  }
}

// Run the seed
seedDefaultVoucherTypes()
  .then(() => {
    console.log('🎉 Seed completed successfully!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Seed failed:', error);
    process.exit(1);
  });
