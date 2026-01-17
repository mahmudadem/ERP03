import * as path from 'path';
import { PERMISSION_CATALOG } from '../config/PermissionCatalog';

// --- Initialization Logic ---
const admin = require('firebase-admin');

if (admin.apps.length === 0) {
  try {
     const serviceAccountPath = path.resolve(__dirname, '../../service-account.json');
     if (require('fs').existsSync(serviceAccountPath)) {
        admin.initializeApp({ credential: admin.credential.cert(serviceAccountPath) });
     } else {
        admin.initializeApp({ projectId: 'erp-03' });
     }
  } catch (e) {
     admin.initializeApp({ projectId: 'erp-03' });
  }
}

const db = admin.firestore();

if (process.env.USE_EMULATOR === 'true') {
  const host = process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080';
  const [hostname, port] = host.split(':');
  db.settings({
    host: `${hostname}:${port}`,
    ssl: false
  });
  console.log(`🔧 Using Firestore Emulator at ${host}\n`);
}
// ----------------------------------------------------------------

async function syncPermissions() {
  console.log('🔄 Starting Permission Catalog Sync to system_metadata/permissions/items...');

  const batch = db.batch();
  
  // Reference to: system_metadata/permissions/items/{permissionId}
  const itemsCollection = db.collection('system_metadata').doc('permissions').collection('items');

  let count = 0;
  
  for (const module of PERMISSION_CATALOG) {
      for (const perm of module.permissions) {
          const permissionDoc = {
              id: perm.id,
              category: module.moduleId,
              labelEn: perm.label,
              labelAr: perm.label,
              labelTr: perm.label,
              descriptionEn: perm.description || '',
              descriptionAr: perm.description || '',
              descriptionTr: perm.description || '',
              module: module.moduleId,
              updatedAt: new Date()
          };

          const docRef = itemsCollection.doc(perm.id);
          batch.set(docRef, permissionDoc, { merge: true });
          count++;
      }
  }

  await batch.commit();
  console.log(`✅ Successfully synced ${count} permissions to Firestore.`);
}

syncPermissions().catch(console.error);
