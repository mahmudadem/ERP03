/**
 * Force seed currencies with decimalPlaces
 */
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';

import admin from '../src/firebaseAdmin';

const db = admin.firestore();

const CURRENCIES = [
  { code: 'USD', name: 'US Dollar', symbol: '$', locale: 'en-US', decimalPlaces: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', locale: 'de-DE', decimalPlaces: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', locale: 'en-GB', decimalPlaces: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', locale: 'ja-JP', decimalPlaces: 0 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', locale: 'tr-TR', decimalPlaces: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', locale: 'en-CA', decimalPlaces: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', locale: 'en-AU', decimalPlaces: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'Fr', locale: 'de-CH', decimalPlaces: 2 },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥', locale: 'zh-CN', decimalPlaces: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', locale: 'en-IN', decimalPlaces: 2 },
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', locale: 'ar-AE', decimalPlaces: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س', locale: 'ar-SA', decimalPlaces: 2 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', locale: 'ar-EG', decimalPlaces: 2 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك', locale: 'ar-KW', decimalPlaces: 3 },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب', locale: 'ar-BH', decimalPlaces: 3 },
  { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.', locale: 'ar-OM', decimalPlaces: 3 },
  { code: 'JOD', name: 'Jordanian Dinar', symbol: 'د.ا', locale: 'ar-JO', decimalPlaces: 3 },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق', locale: 'ar-QA', decimalPlaces: 2 },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩', locale: 'ko-KR', decimalPlaces: 0 },
];

async function forceSeedCurrencies() {
  console.log(`🌱 Force seeding ${CURRENCIES.length} currencies with decimalPlaces...`);
  
  const collectionRef = db.collection('system_metadata').doc('currencies').collection('items');
  
  // Delete all existing
  const existing = await collectionRef.get();
  console.log(`  🗑️  Deleting ${existing.docs.length} existing documents...`);
  
  const batch1 = db.batch();
  existing.docs.forEach(doc => batch1.delete(doc.ref));
  await batch1.commit();
  console.log('  ✅ Deleted old currencies');
  
  // Add new with decimalPlaces
  const batch2 = db.batch();
  for (const currency of CURRENCIES) {
    const docRef = collectionRef.doc(currency.code);
    batch2.set(docRef, {
      ...currency,
      isActive: true,
      updatedAt: new Date().toISOString(),
    });
    console.log(`  ✓ ${currency.code} (decimalPlaces: ${currency.decimalPlaces})`);
  }
  await batch2.commit();
  
  console.log(`\n✅ Successfully seeded ${CURRENCIES.length} currencies!`);
}

forceSeedCurrencies()
  .then(() => process.exit(0))
  .catch(e => {
    console.error('❌ Error:', e);
    process.exit(1);
  });
