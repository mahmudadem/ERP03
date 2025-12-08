import admin from 'firebase-admin';

const projectId =
  process.env.GCLOUD_PROJECT ||
  (process.env.FIREBASE_CONFIG && JSON.parse(process.env.FIREBASE_CONFIG).projectId) ||
  'erp-03';

if (process.env.FUNCTIONS_EMULATOR || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  process.env.FIREBASE_AUTH_EMULATOR_HOST ||= '127.0.0.1:9099';
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId });
}

export { admin };
export default admin;
