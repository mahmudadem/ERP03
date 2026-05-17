
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.GCLOUD_PROJECT = 'erp-03';

import admin from 'firebase-admin';
if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'erp-03' });
}
const db = admin.firestore();
const auth = admin.auth();

async function debugContext() {
  console.log('--- Companies ---');
  const companies = await db.collection('companies').get();
  companies.forEach(doc => {
    console.log(`ID: ${doc.id}, Name: ${doc.data().name}`);
  });

  console.log('\n--- Users ---');
  const users = await auth.listUsers();
  for (const user of users.users) {
    console.log(`Email: ${user.email}, UID: ${user.uid}, Claims: ${JSON.stringify(user.customClaims)}`);
  }
}

debugContext().catch(console.error);
