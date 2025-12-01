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

// Auto-connect to local Auth emulator when running on localhost (unless explicitly disabled)
if (typeof window !== 'undefined') {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const emulatorDisabled = (import.meta as any).env?.VITE_DISABLE_AUTH_EMULATOR === 'true';
  if (isLocalhost && !emulatorDisabled) {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      // eslint-disable-next-line no-console
      console.info('Auth emulator connected at http://localhost:9099');
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('Auth emulator connection skipped/failed', e);
    }
  }
}
export { app };
