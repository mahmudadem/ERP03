/**
 * idempotencyMiddleware.ts
 *
 * Optional idempotency for POST endpoints that create vouchers / movements.
 *
 * Contract:
 *   - If `Idempotency-Key` header is present:
 *       - SHA-256 hash of request body is computed.
 *       - Lookup `companies/{companyId}/idempotency_keys/{key}`.
 *       - If exists with same bodyHash    → replay stored response (no business logic runs).
 *       - If exists with different bodyHash → respond 409 Conflict.
 *       - If absent → proceed, capture status + body, persist with 24h TTL.
 *   - If the header is missing → middleware is a no-op (warn-only mode). Future PR may enforce.
 *
 * Notes:
 *   - Requires `authMiddleware` upstream so `req.user.companyId` is set.
 *   - Storage uses the FirestoreIdempotencyKeyRepository via diContainer.
 *   - Hashing is deterministic on the stringified body; client must send identical bytes for replay.
 */
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';
import { diContainer } from '../../infrastructure/di/bindRepositories';
import { IDEMPOTENCY_KEY_TTL_MS } from '../../domain/system/entities/IdempotencyKey';

const HEADER = 'idempotency-key';
const MAX_KEY_LEN = 255;

function hashBody(body: unknown): string {
  const serialized = body === undefined || body === null ? '' : JSON.stringify(body);
  return createHash('sha256').update(serialized).digest('hex');
}

export const idempotencyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const rawKey = req.headers[HEADER];
  const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

  if (!key || typeof key !== 'string') {
    // Warn-only mode for now: missing key on a sensitive endpoint is logged but allowed.
    console.warn(`[idempotency] ${req.method} ${req.originalUrl} called without Idempotency-Key`);
    return next();
  }

  if (key.length > MAX_KEY_LEN) {
    return res.status(400).json({ success: false, error: { code: 'IDEMPOTENCY_KEY_TOO_LONG' } });
  }

  const companyId: string | null = (req as any).user?.companyId ?? null;
  if (!companyId) {
    // No tenant context — cannot scope key. Pass through; auth/tenant middleware will catch it.
    return next();
  }

  const repo = diContainer.idempotencyKeyRepository;
  const bodyHash = hashBody((req as any).body);

  let existing;
  try {
    existing = await repo.get(companyId, key);
  } catch (err) {
    console.warn('[idempotency] lookup failed; proceeding without replay', err);
    return next();
  }

  if (existing) {
    if (existing.bodyHash !== bodyHash) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'IDEMPOTENCY_KEY_CONFLICT',
          message:
            'Idempotency-Key already used with a different request body. ' +
            'Reuse the same body to retry, or supply a fresh key.',
        },
      });
    }
    // Replay
    return res.status(existing.statusCode).json(existing.responseBody);
  }

  // Capture response so we can persist after the handler runs.
  const originalJson = res.json.bind(res);
  let captured = false;
  (res as any).json = function (body: unknown) {
    if (!captured) {
      captured = true;
      const statusCode = res.statusCode || 200;
      // Best-effort persist; do not block response on failure.
      repo
        .put({
          key,
          companyId,
          method: req.method,
          path: req.originalUrl,
          bodyHash,
          statusCode,
          responseBody: body,
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + IDEMPOTENCY_KEY_TTL_MS),
        })
        .catch((err) => console.warn('[idempotency] persist failed', err));
    }
    return originalJson(body);
  };

  return next();
};
