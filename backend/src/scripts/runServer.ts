import './envConfig';
import express from 'express';
import '../firebaseAdmin';
import { registerAllModules } from '../modules';
import { ModuleRegistry } from '../application/platform/ModuleRegistry';
import { runModuleStartupValidation } from '../modules/moduleStartupValidation';
import { diContainer } from '../infrastructure/di/bindRepositories';

// Register modules before loading server
registerAllModules();
ModuleRegistry.getInstance().initializeAll().catch(console.error);
runModuleStartupValidation().catch(console.error);

// Auto-seed AI model certifications for well-known models (idempotent, non-blocking)
diContainer.aiAutoSeedCertification.seed()
  .then((count: number) => console.log(`[AI Auto-Certification] Seeded ${count} certification(s) at startup.`))
  .catch((err: unknown) => console.warn('[AI Auto-Certification] Failed to seed at startup:', err));

import server from '../api/server';

const app = express();

// Mount the server under the Firebase Functions path to match frontend config
const MOUNT_PATH = '/erp-03/us-central1/api';
app.use(MOUNT_PATH, server);

const PORT = 5001;

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
  console.log(`Mounted at http://localhost:${PORT}${MOUNT_PATH}`);
});
