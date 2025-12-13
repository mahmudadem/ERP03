import { admin } from '../firebaseAdmin';
import { FirestoreCompanyModuleRepository } from '../infrastructure/firestore/repositories/company/FirestoreCompanyModuleRepository';

// Connect to emulators
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
process.env.FIREBASE_AUTH_EMULATOR_HOST = '127.0.0.1:9099';

async function resetAccounting() {
  const db = admin.firestore();
  console.log('Fetching all companies...');
  const companiesSnapshot = await db.collection('companies').get();

  for (const companyDoc of companiesSnapshot.docs) {
    const COMPANY_ID = companyDoc.id;
    console.log(`\n🔄 Processing Company: ${COMPANY_ID} (${companyDoc.data().name})`);

    const repo = new FirestoreCompanyModuleRepository(db);

    try {
      // 1. Reset Module Status
      await repo.update(COMPANY_ID, 'accounting', {
        initialized: false,
        initializationStatus: 'pending',
        config: {}, // Clear config
        updatedAt: new Date()
      });
      console.log('  ✅ Accounting module status reset to pending.');

      // 2. Delete existing accounts
      const accountsSnapshot = await db.collection('companies').doc(COMPANY_ID).collection('accounts').get();
      if (!accountsSnapshot.empty) {
        const batch = db.batch();
        accountsSnapshot.docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        await batch.commit();
        console.log(`  🗑️ Deleted ${accountsSnapshot.size} existing accounts.`);
      } else {
        console.log('  ℹ️ No existing accounts found.');
      }

    } catch (error) {
      console.error(`  ❌ Error processing company ${COMPANY_ID}:`, error);
    }
  }
}

resetAccounting().then(() => process.exit());
