import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { createHash } from 'crypto';

const mockRepo: {
  get: jest.Mock<(companyId: string, key: string) => Promise<any>>;
  put: jest.Mock<(record: any) => Promise<void>>;
  delete: jest.Mock<(companyId: string, key: string) => Promise<void>>;
} = {
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
};

jest.mock('../../../infrastructure/di/bindRepositories', () => ({
  diContainer: {
    get idempotencyKeyRepository() {
      return mockRepo;
    },
  },
}));

import { idempotencyMiddleware } from '../../../api/middlewares/idempotencyMiddleware';

const hashBody = (body: unknown): string =>
  createHash('sha256').update(body === undefined || body === null ? '' : JSON.stringify(body)).digest('hex');

const buildReqRes = (
  overrides: { key?: string | string[]; companyId?: string | null; body?: unknown; method?: string; url?: string } = {}
) => {
  const req: any = {
    headers: overrides.key !== undefined ? { 'idempotency-key': overrides.key } : {},
    user: overrides.companyId === null ? {} : { companyId: overrides.companyId ?? 'cmp-1' },
    body: overrides.body ?? { foo: 'bar' },
    method: overrides.method ?? 'POST',
    originalUrl: overrides.url ?? '/tenant/sales/invoices/abc/post',
  };
  const res: any = { statusCode: 200 };
  res.json = jest.fn((body: unknown) => body);
  res.status = jest.fn((code: number) => {
    res.statusCode = code;
    return res;
  });
  const next = jest.fn();
  return { req, res, next };
};

describe('idempotencyMiddleware', () => {
  beforeEach(() => {
    mockRepo.get.mockReset();
    mockRepo.put.mockReset();
    mockRepo.delete.mockReset();
  });

  it('passes through when Idempotency-Key header is missing', async () => {
    const { req, res, next } = buildReqRes({ key: undefined });
    await idempotencyMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockRepo.get).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  it('responds 400 when key exceeds max length', async () => {
    const longKey = 'a'.repeat(300);
    const { req, res, next } = buildReqRes({ key: longKey });
    await idempotencyMiddleware(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_TOO_LONG' }) })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it('passes through when no companyId on request', async () => {
    const { req, res, next } = buildReqRes({ key: 'abc-key', companyId: null });
    await idempotencyMiddleware(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(mockRepo.get).not.toHaveBeenCalled();
  });

  it('replays cached response when key + body hash match', async () => {
    const body = { invoiceId: 'inv-1' };
    const cached = {
      key: 'abc-key',
      companyId: 'cmp-1',
      method: 'POST',
      path: '/tenant/sales/invoices/abc/post',
      bodyHash: hashBody(body),
      statusCode: 201,
      responseBody: { success: true, data: { id: 'inv-1' } },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    };
    mockRepo.get.mockResolvedValueOnce(cached as any);

    const { req, res, next } = buildReqRes({ key: 'abc-key', body });
    await idempotencyMiddleware(req, res, next);

    expect(mockRepo.get).toHaveBeenCalledWith('cmp-1', 'abc-key');
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(cached.responseBody);
    expect(next).not.toHaveBeenCalled();
    expect(mockRepo.put).not.toHaveBeenCalled();
  });

  it('responds 409 when same key is reused with a different body', async () => {
    mockRepo.get.mockResolvedValueOnce({
      key: 'abc-key',
      companyId: 'cmp-1',
      method: 'POST',
      path: '/tenant/sales/invoices/abc/post',
      bodyHash: hashBody({ different: true }),
      statusCode: 200,
      responseBody: { ok: true },
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    } as any);

    const { req, res, next } = buildReqRes({ key: 'abc-key', body: { foo: 'bar' } });
    await idempotencyMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, error: expect.objectContaining({ code: 'IDEMPOTENCY_KEY_CONFLICT' }) })
    );
    expect(next).not.toHaveBeenCalled();
    expect(mockRepo.put).not.toHaveBeenCalled();
  });

  it('proceeds to handler and persists response when no prior record exists', async () => {
    mockRepo.get.mockResolvedValueOnce(null);
    mockRepo.put.mockResolvedValueOnce(undefined);

    const body = { invoiceId: 'inv-2' };
    const { req, res, next } = buildReqRes({ key: 'fresh-key', body });
    await idempotencyMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(mockRepo.put).not.toHaveBeenCalled();

    // Simulate handler calling res.json
    res.status(201);
    res.json({ success: true, data: { id: 'inv-2' } });

    // put is best-effort and not awaited; flush microtasks
    await new Promise((resolve) => setImmediate(resolve));

    expect(mockRepo.put).toHaveBeenCalledTimes(1);
    const persistedRecord = mockRepo.put.mock.calls[0][0] as any;
    expect(persistedRecord.key).toBe('fresh-key');
    expect(persistedRecord.companyId).toBe('cmp-1');
    expect(persistedRecord.method).toBe('POST');
    expect(persistedRecord.bodyHash).toBe(hashBody(body));
    expect(persistedRecord.statusCode).toBe(201);
    expect(persistedRecord.responseBody).toEqual({ success: true, data: { id: 'inv-2' } });
  });

  it('proceeds when repo lookup throws (defensive)', async () => {
    mockRepo.get.mockRejectedValueOnce(new Error('Firestore unavailable'));

    const { req, res, next } = buildReqRes({ key: 'abc-key' });
    await idempotencyMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.json).not.toHaveBeenCalled();
  });
});
