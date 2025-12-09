/**
 * Verify what data exists in Firestore emulator
 */

import * as admin from 'firebase-admin';

// Initialize
if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'demo-project' });
}

const db = admin.firestore();

// Configure emulator
if (process.env.USE_EMULATOR === 'true') {
  const host = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  const [hostname, port] = host.split(':');
  db.settings({
    host: `${hostname}:${port}`,
    ssl: false
  });
  console.log(`🔧 Using Firestore Emulator at ${host}\n`);
}

async function verifyData() {
  try {
    console.log('🔍 Checking Firestore data...\n');

    // Check vouchers collection
    console.log('📋 Checking vouchers collection:');
    const vouchersSnapshot = await db.collection('vouchers').get();
    console.log(`   Found ${vouchersSnapshot.size} documents\n`);

    if (vouchersSnapshot.empty) {
      console.log('   ❌ No vouchers found!\n');
    } else {
      console.log('   Vouchers:');
      vouchersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${doc.id}: ${data.voucherNo || 'N/A'} (${data.status})`);
      });
      console.log('');
    }

    // Check companies
    console.log('🏢 Checking companies collection:');
    const companiesSnapshot = await db.collection('companies').get();
    console.log(`   Found ${companiesSnapshot.size} companies`);
    companiesSnapshot.forEach(doc => {
      console.log(`   - ${doc.id}: ${doc.data().name}`);
    });
    console.log('');

    // Check users
    console.log('👥 Checking users collection:');
    const usersSnapshot = await db.collection('users').get();
    console.log(`   Found ${usersSnapshot.size} users`);
    console.log('');

    console.log('✅ Verification complete\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

verifyData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
