import admin from 'firebase-admin';

const projectId =
  process.env.GCLOUD_PROJECT ||
  (process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG).projectId) ||
  'erp-03';

// Storage bucket is optional in many local/dev setups. Provide a safe fallback to
// prevent Firebase Admin from throwing at module load when code calls
// `storage().bucket()` without a configured name (e.g., in emulators).
const storageBucket =
  process.env.FIREBASE_STORAGE_BUCKET ||
  (process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG).storageBucket) ||
  'dev-null-bucket'; // harmless fallback for emulators/local

// DEBUG: Log environment
console.log('🔍 Firebase Init:', {
  projectId,
  FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
  FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST,
  FUNCTIONS_EMULATOR: process.env.FUNCTIONS_EMULATOR
});

// Configure emulators
if (process.env.FUNCTIONS_EMULATOR || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  // Auth Emulator
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
  
  // Firestore Emulator  
  process.env.FIRESTORE_EMULATOR_HOST ||= 'localhost:8080';
  
  console.log('✅ Emulator vars set:', {
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST
  });
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId, storageBucket });
}

export { admin };
export default admin;
