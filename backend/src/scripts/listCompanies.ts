
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'erp-03';

import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
}
const db = admin.firestore();

async function main() {
  console.log('Listing companies...');
  const snap = await db.collection('companies').get();
  
  if (snap.empty) {
    console.log('No companies found.');
    return;
  }

  for (const doc of snap.docs) {
    const data = doc.data();
    console.log(`\nCompany ID: ${doc.id}`);
    console.log(`Name: ${data.name || 'Unnamed'}`);
    
    // Check accounts
    const accSnap = await db.collection('companies').doc(doc.id)
      .collection('accounting').doc('Data').collection('accounts').limit(5).get();
      
    console.log(`Accounts found: ${accSnap.size > 0 ? 'YES' : 'NO'}`);
    if (accSnap.size > 0) {
        console.log('Sample accounts:', accSnap.docs.map(d => d.data().name).join(', '));
    }
  }
}

main().catch(console.error);
