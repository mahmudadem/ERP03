import { db } from '../backend/src/config/firebase'; // Adjust path if needed

const companyId = 'M02hOfA04zJg8CAtc3zI';
const modules = ['accounting', 'sales', 'purchase'];

async function check() {
  console.log(`Checking definitions for company: ${companyId}`);
  
  for (const mod of modules) {
    const path = `companies/${companyId}/${mod}/Settings/voucher_types`;
    console.log(`Checking path: ${path}`);
    const snapshot = await db.collection(path).get();
    console.log(`- Found ${snapshot.size} definitions`);
    snapshot.forEach(doc => {
      console.log(`  * ${doc.id}: ${doc.data().name} (${doc.data().code})`);
    });
  }
}

check();
