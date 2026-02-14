
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}
const db = admin.firestore();

async function main() {
  const companyId = 'cmp_mkvfwfm5_h1t3vi';
  const accountId = '40102'; // Export Sales (Contra) - or check the main one

  // Check the main account 10201
  // First find its ID
  const accountsSnap = await db.collection('companies').doc(companyId)
    .collection('accounting').doc('Data').collection('accounts')
    .where('userCode', '==', '10201').get();

  if (accountsSnap.empty) {
    console.log('Account 10201 not found');
    return;
  }
  const accId = accountsSnap.docs[0].id;
  console.log('Account 10201 ID:', accId);

  const ledgerCol = db.collection('companies').doc(companyId)
    .collection('accounting').doc('Data').collection('ledger');

  const snap = await ledgerCol
    .where('accountId', '==', accId)
    .get();

  console.log(`Total ledger entries for 10201: ${snap.size}`);

  // Check dates
  if (snap.size > 0) {
      const dates = snap.docs.map(d => d.data().date.toDate().toISOString().split('T')[0]).sort();
      console.log('First date:', dates[0]);
      console.log('Last date:', dates[dates.length - 1]);
  }
}

main().catch(console.error);
