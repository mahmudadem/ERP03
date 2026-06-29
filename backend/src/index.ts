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

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  server = require('./api/server').default;
  serverReady = true;

  // Non-essential AI metadata sync runs AFTER the server is ready so it never
  // blocks request serving on a cold start (a major source of 503 storms).
  // Fire-and-forget; failures here must not affect availability.
  void (async () => {
    try {
      const syncedProfiles = await diContainer.aiModelProfileUseCase.syncBuiltInProfiles();
      if (syncedProfiles > 0) {
        console.log(`[AI Startup] Synced ${syncedProfiles} new model profile(s) from catalog.`);
      }
      const seededCerts = await diContainer.aiAutoSeedCertification.seed();
      console.log(`[AI Startup] Seeded ${seededCerts} certification(s) for well-known models.`);
    } catch (err) {
      console.warn('[AI Startup] Failed to sync AI metadata at startup:', err);
    }
  })();
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run initServer() with retry + exponential backoff.
 *
 * Startup validation reads from the database, so a DB that is briefly
 * unreachable at boot (common after a host reboot, or a not-yet-ready managed
 * Postgres on Supabase/Railway) would otherwise throw once and brick the
 * process into a permanent 503 with no recovery. Retrying lets the server
 * self-heal as soon as the database accepts connections.
 */
async function initServerWithRetry(): Promise<void> {
  const baseDelayMs = 2000;
  const maxDelayMs = 30000;
  let attempt = 0;

  // Keep trying indefinitely: a worker that can never reach its DB is useless,
  // but staying alive and becoming ready the moment the DB comes up is strictly
  // better than dying on the first failed attempt.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      await initServer();
      if (attempt > 1) {
        console.log(`✓ Server initialized successfully on attempt ${attempt}.`);
      }
      return;
    } catch (error) {
      const delayMs = Math.min(baseDelayMs * 2 ** (attempt - 1), maxDelayMs);
      console.error(
        `Failed to initialize server (attempt ${attempt}); retrying in ${delayMs}ms:`,
        error
      );
      await sleep(delayMs);
    }
  }
}

const initPromise = initServerWithRetry();

export const api = functions
  .runWith({
    // 512MB (up from the 256MB default) stops the container from being
    // OOM-killed while loading all six modules on a cold start — that OOM was
    // corrupting the Firestore gRPC channel and surfacing as 500s on reads.
    // (No minInstances: keeping a warm instance raises the minimum bill and
    // requires --force; the await-on-init change below already removes the 503
    // storm without it. Add `minInstances: 1` later if cold-start latency hurts.)
    memory: '512MB',
    timeoutSeconds: 120,
  })
  .https.onRequest(async (req: any, res: any) => {
    if (!serverReady || !server) {
      // Add CORS headers manually since the Express app (which has the cors middleware) is not ready yet
      res.set('Access-Control-Allow-Origin', '*');
      res.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-company-id, x-silent-error');

      // If it's a preflight request, return 204 immediately
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      // Instead of rejecting with 503 during a cold start (which caused a storm
      // of failures whenever the page fired many parallel requests at once),
      // wait for initialization to finish, then serve the request normally.
      // initServerWithRetry() resolves only on success, so we bound the wait to
      // stay well under the function timeout and fail soft if the DB is truly down.
      try {
        await Promise.race([
          initPromise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('init-timeout')), 90_000)),
        ]);
      } catch {
        res.status(503).json({ success: false, error: 'Server not ready, please retry' });
        return;
      }
    }

    server(req, res);
  });

export const accountingModule = {};
