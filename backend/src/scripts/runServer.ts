import './envConfig';
import express from 'express';
import '../firebaseAdmin';
import { registerAllModules } from '../modules';
import { ModuleRegistry } from '../application/platform/ModuleRegistry';

// Register modules before loading server
registerAllModules();
ModuleRegistry.getInstance().initializeAll().catch(console.error);

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
