import { db } from '../backend/src/config/firebase';

const companyId = 'M02hOfA04zJg8CAtc3zI';

async function migrateDefinitions() {
  console.log(`Starting migration for company: ${companyId}`);
  
  // Standard accounting path where things are currently stuck
  const wrongPath = `companies/${companyId}/accounting/Settings/voucher_types`;
  const snapshot = await db.collection(wrongPath).get();
  
  console.log(`Found ${snapshot.size} definitions in accounting path.`);
  
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const code = data.code;
    let targetModule = '';
    
    if (['sales_order', 'delivery_note', 'sales_invoice', 'sales_return'].includes(code)) {
      targetModule = 'sales';
    } else if (['purchase_order', 'grn', 'purchase_invoice', 'purchase_return'].includes(code)) {
      targetModule = 'purchase';
    }
    
    if (targetModule) {
      const correctPath = `companies/${companyId}/${targetModule}/Settings/voucher_types`;
      console.log(`  -> Moving ${code} to ${correctPath}`);
      
      // 1. Save to new location
      await db.collection(correctPath).doc(doc.id).set({
        ...data,
        module: targetModule.toUpperCase(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      // 2. Delete from old location
      await doc.ref.delete();
      console.log(`     ✅ Done.`);
    } else {
      console.log(`  -- Skipping ${code} (belongs to accounting)`);
    }
  }
  
  console.log('Migration Complete.');
}

migrateDefinitions();
