
// Force Emulator Connection
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';
process.env.GCLOUD_PROJECT = 'erp-03';

import admin from 'firebase-admin';
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'erp-03' });
}
const db = admin.firestore();

async function checkSpecificAccount() {
  const companyId = 'cmp_mklltbsu_sjq5z6'; // Taken from screenshot
  const accountId = 'bae9dc92-1c8e-4058-bb09-99d220030922'; // Taken from screenshot
  const voucherId = 'c098994c-7a75-4e98-bd98-a569e292dd85'; // Taken from screenshot

  console.log(`Checking Company: ${companyId}`);

  // 1. Check Account
  const accDoc = await db.collection('companies').doc(companyId).collection('accounts').doc(accountId).get();
  if (accDoc.exists) {
    console.log('✅ Account EXISTS!');
    console.log('Account Data:', accDoc.data());
  } else {
    console.log('❌ Account MISSING! This is why the report shows "Unknown Account".');
    console.log('Searching for any account with this ID in ALL companies...');
    const snapshot = await db.collectionGroup('accounts').get();
    const found = snapshot.docs.find(d => d.id === accountId);
    if (found) {
        console.log(`⚠️ Found this account in a DIFFERENT company: ${found.ref.path}`);
    } else {
        console.log('❌ Account not found in ANY company.');
    }
  }

  // 2. Check Voucher
  const vDoc = await db.collection('companies').doc(companyId).collection('vouchers').doc(voucherId).get();
  if (vDoc.exists) {
    console.log('✅ Voucher EXISTS!');
    console.log('Voucher No:', vDoc.data()?.voucherNo);
  } else {
    console.log('❌ Voucher MISSING!');
  }
}

checkSpecificAccount().catch(console.error);
