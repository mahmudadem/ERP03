import './firebaseAdmin';
import * as functions from 'firebase-functions';
import { registerAllModules } from './modules';
import { ModuleRegistry } from './application/platform/ModuleRegistry';
import { runModuleStartupValidation } from './modules/moduleStartupValidation';

let server: any = null;
let serverReady = false;

async function initServer() {
  registerAllModules();
  await ModuleRegistry.getInstance().initializeAll();
  await runModuleStartupValidation();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  server = require('./api/server').default;
  serverReady = true;
}

initServer().catch((error) => {
  console.error('Failed to initialize server:', error);
});

export const api = functions.https.onRequest(async (req: any, res: any) => {
  if (!serverReady || !server) {
    res.status(503).json({ success: false, error: 'Server not ready, please retry' });
    return;
  }

  server(req, res);
});

export const accountingModule = {};