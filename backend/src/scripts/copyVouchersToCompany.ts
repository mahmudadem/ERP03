/**
 * Quick script to copy system voucher types to a company
 * Run with: ts-node src/scripts/copyVouchersToCompany.ts
 */

// Force Firestore Emulator usage
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.GCLOUD_PROJECT,
  });
}

console.log(`🔧 Using Firestore Emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);
console.log(`🔧 Project ID: ${process.env.GCLOUD_PROJECT}\n`);

const db = admin.firestore();

async function copyVouchersToCompany(companyId: string) {
  console.log(`📋 Copying voucher types to company: ${companyId}\n`);
  
  try {
    // Load default voucher types from system_metadata
    const systemVouchersRef = db.collection('system_metadata').doc('voucher_types').collection('items');
    const snapshot = await systemVouchersRef.get();
    
    if (snapshot.empty) {
      console.error('❌ No voucher types found in system_metadata/voucher_types/items');
      console.log('   Run: npm run seed:vouchers first');
      return;
    }
    
    const batch = db.batch();
    let count = 0;
    
    snapshot.forEach(doc => {
      const voucherType = doc.data();
      
      // Create a copy for this company
      const companyVoucherRef = db
        .collection('companies')
        .doc(companyId)
        .collection('voucherTypes')
        .doc(doc.id);
      
      // Add company-specific metadata
      const companyVoucher = {
        ...voucherType,
        companyId,
        enabled: true,  // Make sure it's enabled!
        isSystemDefault: false, // Company can edit this
        inUse: false,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      
      batch.set(companyVoucherRef, companyVoucher, { merge: true });
      console.log(`  ✅ Prepared: ${voucherType.name} (${voucherType.prefix})`);
      count++;
    });
    
    await batch.commit();
    
    console.log('');
    console.log(`✅ SUCCESS! Copied ${count} voucher types to company ${companyId}`);
    console.log(`   Location: companies/${companyId}/voucherTypes/`);
    console.log('');
    
  } catch (error) {
    console.error('❌ ERROR:', error);
    throw error;
  }
}

// Get company ID from command line or use default
const companyId = process.argv[2] || 'cmp_mj68xtdu_hqgjc1'; // Default from your session

copyVouchersToCompany(companyId)
  .then(() => {
    console.log('🎉 Done!\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Failed:', error);
    process.exit(1);
  });
