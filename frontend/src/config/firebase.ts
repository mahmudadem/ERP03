import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, connectAuthEmulator } from 'firebase/auth';
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

// Auto-connect to local Auth emulator when enabled
if (typeof window !== 'undefined') {
  const useEmulators = (import.meta as any).env?.VITE_USE_EMULATORS === 'true';
  const emulatorHost = (import.meta as any).env?.VITE_FIREBASE_AUTH_EMULATOR_HOST || 'http://127.0.0.1:9099';
  if (useEmulators) {
    try {
      connectAuthEmulator(auth, emulatorHost, { disableWarnings: true });
      // eslint-disable-next-line no-console
      console.info(`Auth emulator connected at ${emulatorHost}`);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Auth emulator connection skipped/failed', e);
    }
  }
}
export { app };

if (typeof window !== 'undefined') {
  // Expose firebase tools for debugging
  (window as any).__auth = auth;
  (window as any).__app = app;
}
