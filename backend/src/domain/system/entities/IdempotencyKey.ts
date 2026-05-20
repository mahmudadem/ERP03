export interface IdempotencyKeyRecord {
  key: string;
  companyId: string;
  method: string;
  path: string;
  bodyHash: string;
  statusCode: number;
  responseBody: unknown;
  createdAt: Date;
  expiresAt: Date;
}

export const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000;
