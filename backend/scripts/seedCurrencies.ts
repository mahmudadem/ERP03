/**
 * Seed currencies to Firestore
 * 
 * Run with: npx ts-node scripts/seedCurrencies.ts
 * 
 * Requires Firebase emulators or production credentials.
 */

import admin from '../src/firebaseAdmin';
import { CURRENCY_SEED_DATA } from '../prisma/seeds/currencySeedData';

const db = admin.firestore();

async function seedCurrencies() {
  console.log('🌱 Seeding currencies to Firestore...');

  const batch = db.batch();
  
  for (const currency of CURRENCY_SEED_DATA) {
    const ref = db.collection('currencies').doc(currency.code);
    batch.set(ref, {
      code: currency.code,
      name: currency.name,
      symbol: currency.symbol,
      decimalPlaces: currency.decimalPlaces,
      isActive: true,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    console.log(`  ✓ ${currency.code} (${currency.name}) - ${currency.decimalPlaces} decimals`);
  }

  await batch.commit();
  console.log(`\n✅ Seeded ${CURRENCY_SEED_DATA.length} currencies to Firestore`);
}

// Run
seedCurrencies()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  });
