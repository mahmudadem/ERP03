/**
 * List ALL collections in Firestore to see what's actually there
 */

import * as admin from 'firebase-admin';

if (admin.apps.length === 0) {
  admin.initializeApp({ projectId: 'demo-project' });
}

const db = admin.firestore();

if (process.env.USE_EMULATOR === 'true') {
  const host = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  const [hostname, port] = host.split(':');
  db.settings({ host: `${hostname}:${port}`, ssl: false });
  console.log(`🔧 Using Firestore Emulator at ${host}\n`);
}

async function listAllCollections() {
  try {
    console.log('📚 Listing ALL top-level collections:\n');
    
    const collections = await db.listCollections();
    
    if (collections.length === 0) {
      console.log('❌ No collections found!\n');
      return;
    }
    
    for (const collection of collections) {
      const snapshot = await collection.limit(5).get();
      console.log(`\n📁 ${collection.id} (${snapshot.size} docs shown, may have more):`);
      
      snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${doc.id}`);
        // Show first few fields
        const keys = Object.keys(data).slice(0, 3);
        keys.forEach(key => {
          const value = data[key];
          const display = typeof value === 'string' ? value.substring(0, 30) : JSON.stringify(value).substring(0, 30);
          console.log(`      ${key}: ${display}`);
        });
      });
    }
    
    console.log('\n✅ Done\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

listAllCollections()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
