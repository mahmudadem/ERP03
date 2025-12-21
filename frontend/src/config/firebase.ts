import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, Firestore, connectFirestoreEmulator } from 'firebase/firestore';
import { env } from './env';

let app: FirebaseApp;

if (getApps().length > 0) {
  app = getApp();
} else {
  app = initializeApp({
    apiKey: env.firebase.apiKey,
    authDomain: env.firebase.authDomain,
    projectId: env.firebase.projectId,
    storageBucket: env.firebase.storageBucket,
    messagingSenderId: env.firebase.messagingSenderId,
    appId: env.firebase.appId,
  });
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);

// Auto-connect to local emulators when enabled
if (typeof window !== 'undefined') {
  const useEmulators = (import.meta as any).env?.VITE_USE_EMULATORS === 'true';
  
  // Auth emulator
  const authEmulatorHost = (import.meta as any).env?.VITE_FIREBASE_AUTH_EMULATOR_HOST || 'http://127.0.0.1:9099';
  if (useEmulators) {
    try {
      connectAuthEmulator(auth, authEmulatorHost, { disableWarnings: true });
      // eslint-disable-next-line no-console
      console.info(`Auth emulator connected at ${authEmulatorHost}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Auth emulator connection skipped/failed', e);
    }
  }
  
  // Firestore emulator
  const firestoreEmulatorHost = (import.meta as any).env?.VITE_FIREBASE_FIRESTORE_EMULATOR_HOST || '127.0.0.1';
  const firestoreEmulatorPort = (import.meta as any).env?.VITE_FIREBASE_FIRESTORE_EMULATOR_PORT || 8080;
  if (useEmulators) {
    try {
      connectFirestoreEmulator(db, firestoreEmulatorHost, firestoreEmulatorPort);
      // eslint-disable-next-line no-console
      console.info(`Firestore emulator connected at ${firestoreEmulatorHost}:${firestoreEmulatorPort}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Firestore emulator connection skipped/failed', e);
    }
  }
}

export { app };

if (typeof window !== 'undefined') {
  // Expose firebase tools for debugging
  (window as any).__auth = auth;
  (window as any).__db = db;
  (window as any).__app = app;
}
