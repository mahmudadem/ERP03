
process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = 'localhost:9099';
process.env.FIREBASE_DATABASE_EMULATOR_HOST = 'localhost:9000';
process.env.GCLOUD_PROJECT = 'erp-03';

const admin = require('firebase-admin');
if (!admin.apps.length) {
  admin.initializeApp({ 
    projectId: 'erp-03',
    databaseURL: 'http://localhost:9000/?ns=erp-03'
  });
}
const rtdb = admin.database();

async function debugRTDB() {
  console.log('\n--- Full RTDB ---');
  const snapshot = await rtdb.ref().get();
  console.log(JSON.stringify(snapshot.val(), null, 2));
}

debugRTDB().catch(console.error);
