import { Request, Response, NextFunction } from 'express';
import admin from '../../../firebaseAdmin';
import { getPrismaClient } from '../../../infrastructure/prisma/prismaClient';

type CheckStatus = 'ok' | 'warn' | 'error';

interface DiagnosticCheck {
  status: CheckStatus;
  label: string;
  detail?: string;
  latencyMs?: number;
}

const redact = (value?: string | null): string | null => {
  if (!value) return null;
  if (value.length <= 12) return 'configured';
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
};

const envValue = (key: string): string | null => {
  const value = process.env[key];
  return value && value.trim() ? value : null;
};

const parseFirebaseConfig = (): Record<string, unknown> => {
  const raw = envValue('FIREBASE_CONFIG');
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const timedCheck = async (label: string, fn: () => Promise<string | undefined>): Promise<DiagnosticCheck> => {
  const started = Date.now();
  try {
    const detail = await fn();
    return {
      status: 'ok',
      label,
      detail,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      status: 'error',
      label,
      detail: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - started,
    };
  }
};

const getOverallStatus = (checks: DiagnosticCheck[]): CheckStatus => {
  if (checks.some((check) => check.status === 'error')) return 'error';
  if (checks.some((check) => check.status === 'warn')) return 'warn';
  return 'ok';
};

export class DeploymentDiagnosticsController {
  static async getDiagnostics(req: Request, res: Response, next: NextFunction) {
    try {
      const firebaseConfig = parseFirebaseConfig();
      const projectId =
        envValue('GCLOUD_PROJECT') ||
        envValue('GOOGLE_CLOUD_PROJECT') ||
        (typeof firebaseConfig.projectId === 'string' ? firebaseConfig.projectId : null) ||
        'erp-03';
      const dbType = (envValue('DB_TYPE') || 'FIRESTORE').toUpperCase();
      const actorUid = (req as any).user?.uid || null;

      const authCheck = await timedCheck('Firebase Auth token/user check', async () => {
        if (!actorUid) throw new Error('No authenticated actor on request');
        await admin.auth().getUser(actorUid);
        return 'Authenticated SUPER_ADMIN request and Firebase Auth user lookup succeeded';
      });

      const dbCheck = await timedCheck(`${dbType} database check`, async () => {
        if (dbType === 'SQL') {
          await getPrismaClient().$queryRaw`SELECT 1`;
          return 'SQL SELECT 1 succeeded through Prisma';
        }
        const collections = await admin.firestore().listCollections();
        return `Firestore root collection lookup succeeded (${collections.length} root collections visible)`;
      });

      const firebaseCheck = await timedCheck('Firebase Admin SDK check', async () => {
        const app = admin.app();
        if (!app) throw new Error('Firebase Admin app is not initialized');
        return `Admin SDK initialized for project ${projectId}`;
      });

      const checks = [authCheck, dbCheck, firebaseCheck];
      const memory = process.memoryUsage();

      res.json({
        success: true,
        data: {
          generatedAt: new Date().toISOString(),
          overallStatus: getOverallStatus(checks),
          checks,
          backend: {
            service: envValue('K_SERVICE') || envValue('FUNCTION_TARGET') || envValue('FUNCTION_NAME') || 'api',
            revision: envValue('K_REVISION') || envValue('FUNCTION_VERSION') || null,
            region: envValue('FUNCTION_REGION') || envValue('GCLOUD_REGION') || null,
            nodeEnv: envValue('NODE_ENV') || 'development',
            nodeVersion: process.version,
            uptimeSeconds: Math.round(process.uptime()),
            memoryMb: {
              rss: Math.round(memory.rss / 1024 / 1024),
              heapUsed: Math.round(memory.heapUsed / 1024 / 1024),
              heapTotal: Math.round(memory.heapTotal / 1024 / 1024),
            },
          },
          database: {
            type: dbType,
            connection: dbCheck.status,
          },
          auth: {
            provider: 'Firebase Auth',
            requestAuthenticated: true,
            superAdminGuard: true,
            actorUid: actorUid ? redact(actorUid) : null,
            connection: authCheck.status,
          },
          firebase: {
            projectId,
            adminApps: admin.apps.length,
            firestoreEmulator: Boolean(envValue('FIRESTORE_EMULATOR_HOST')),
            authEmulator: Boolean(envValue('FIREBASE_AUTH_EMULATOR_HOST')),
            databaseEmulator: Boolean(envValue('FIREBASE_DATABASE_EMULATOR_HOST')),
            storageBucketConfigured: Boolean(
              envValue('FIREBASE_STORAGE_BUCKET') || typeof firebaseConfig.storageBucket === 'string'
            ),
            databaseUrlConfigured: Boolean(
              envValue('FIREBASE_DATABASE_URL') || typeof firebaseConfig.databaseURL === 'string'
            ),
          },
          deployment: {
            projectId,
            cloudRunService: envValue('K_SERVICE'),
            cloudRunRevision: envValue('K_REVISION'),
            functionTarget: envValue('FUNCTION_TARGET') || envValue('FUNCTION_NAME'),
            commit: envValue('GIT_COMMIT') || envValue('COMMIT_SHA') || envValue('SOURCE_VERSION'),
            secretsRedacted: true,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
}
