
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}
const db = admin.firestore();

async function main() {
  console.log('Scanning companies for Account 10201...');
  const companiesSnap = await db.collection('companies').get();
  
  for (const doc of companiesSnap.docs) {
    const companyName = doc.data().name || 'Unknown';
    const cid = doc.id;
    
    // Find account 10201
    const accSnap = await db.collection('companies').doc(cid)
      .collection('accounting').doc('Data').collection('accounts')
      .where('userCode', '==', '10201').get();

    if (accSnap.empty) {
      console.log(`[${cid}] ${companyName}: Account 10201 NOT FOUND`);
      continue;
    }

    const acc = accSnap.docs[0];
    const aid = acc.id;
    const accName = acc.data().name;

    // Count ledger entries
    const ledgerSnap = await db.collection('companies').doc(cid)
      .collection('accounting').doc('Data').collection('ledger')
      .where('accountId', '==', aid)
      .count()
      .get();
      
    console.log(`[${cid}] ${companyName}: Found 10201 (${accName}) - ID: ${aid} - Ledger Entries: ${ledgerSnap.data().count}`);
  }
}

main().catch(console.error);
