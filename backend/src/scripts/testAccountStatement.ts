
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';

import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}
const db = admin.firestore();

// Copy-paste of the repo logic we want to test
async function testGetAccountStatement() {
  const companyId = 'cmp_mkvfwfm5_h1t3vi';
  
  // Find account ID for 10201 again to be sure
  const accSnap = await db.collection('companies').doc(companyId)
    .collection('accounting').doc('Data').collection('accounts')
    .where('userCode', '==', '10201').get();
  const accountId = accSnap.docs[0].id;

  const startDate = '2026-01-01';
  const endDate = '2026-02-14'; // Today

  console.log(`Testing getAccountStatement for ${accountId} from ${startDate} to ${endDate}`);

  const startTs = Timestamp.fromDate(new Date(startDate + 'T00:00:00'));
  const endTs = Timestamp.fromDate(new Date(endDate + 'T23:59:59.999'));

  const ledgerCol = db.collection('companies').doc(companyId)
    .collection('accounting').doc('Data').collection('ledger');

  const query = ledgerCol
    .where('isPosted', '==', true)
    .where('accountId', '==', accountId)
    .where('date', '>=', startTs)
    .where('date', '<=', endTs)
    .orderBy('date', 'asc');

  const snap = await query.get();
  console.log(`Query found ${snap.size} records.`);
  
  if (snap.size > 0 && snap.size < 20) {
      snap.docs.forEach(d => console.log(d.data().date.toDate(), d.data().voucherNo));
  }
}

testGetAccountStatement().catch(console.error);
