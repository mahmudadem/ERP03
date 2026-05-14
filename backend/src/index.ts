import './firebaseAdmin';
import * as functions from 'firebase-functions';
import { registerAllModules } from './modules';
import { ModuleRegistry } from './application/platform/ModuleRegistry';
import { runModuleStartupValidation } from './modules/moduleStartupValidation';
import { diContainer } from './infrastructure/di/bindRepositories';

let server: any = null;
let serverReady = false;

async function initServer() {
  registerAllModules();
  await ModuleRegistry.getInstance().initializeAll();
  await runModuleStartupValidation();

  // Auto-seed AI model certifications for well-known models (idempotent)
  try {
    const seeded = await diContainer.aiAutoSeedCertification.seed();
    console.log(`[AI Auto-Certification] Seeded ${seeded} certification(s) at startup.`);
  } catch (err) {
    console.warn('[AI Auto-Certification] Failed to seed at startup:', err);
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  server = require('./api/server').default;
  serverReady = true;
}

initServer().catch((error) => {
  console.error('Failed to initialize server:', error);
});

export const api = functions.https.onRequest(async (req: any, res: any) => {
  if (!serverReady || !server) {
    // Add CORS headers manually since the Express app (which has the cors middleware) is not ready yet
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-company-id, x-silent-error');
    
    // If it's a preflight request, return 204
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }
    
    res.status(503).json({ success: false, error: 'Server not ready, please retry' });
    return;
  }

  server(req, res);
});

export const accountingModule = {};