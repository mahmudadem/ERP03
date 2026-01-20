process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
import admin from './firebaseAdmin';
const db = admin.firestore();

async function check() {
  const s = await db.collectionGroup('accounts').limit(5).get();
  if (s.empty) {
     console.log('No accounts found anywhere!');
  } else {
     s.forEach(d => console.log('Path:', d.ref.path, 'CompanyId:', d.data().companyId));
  }
  process.exit(0);
}

check();
