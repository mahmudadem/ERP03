/**
 * Quick test script to verify currencies have decimalPlaces
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

import admin from '../src/firebaseAdmin';

const db = admin.firestore();

async function checkCurrencies() {
  console.log('Checking currencies in Firestore...\n');
  
  const snapshot = await db.collection('system_metadata').doc('currencies').collection('items').get();
  
  if (snapshot.empty) {
    console.log('❌ No currencies found!');
    return;
  }
  
  console.log(`Found ${snapshot.docs.length} currencies:\n`);
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const hasDecimal = data.decimalPlaces !== undefined;
    console.log(`${hasDecimal ? '✅' : '❌'} ${data.code}: decimalPlaces=${data.decimalPlaces ?? 'MISSING'}`);
  });
}

checkCurrencies().then(() => process.exit(0)).catch(e => {
  console.error(e);
  process.exit(1);
});
