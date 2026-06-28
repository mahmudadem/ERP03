import { PrismaClient } from '@prisma/client';
import { IdempotencyKeyRecord } from '../../../../domain/system/entities/IdempotencyKey';
import { IIdempotencyKeyRepository } from '../../../../repository/interfaces/system/IIdempotencyKeyRepository';

export class PrismaIdempotencyKeyRepository implements IIdempotencyKeyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(companyId: string, key: string): Promise<IdempotencyKeyRecord | null> {
    const row = await (this.prisma as any).idempotencyKey.findUnique({
      where: { companyId_key: { companyId, key } },
    });
    if (!row) return null;
    const expiresAt: Date = row.expiresAt;
    if (expiresAt.getTime() <= Date.now()) {
      // Stale — treat as absent; lazy expiry
      return null;
    }
    return {
      key: row.key,
      companyId: row.companyId,
      method: row.method,
      path: row.path,
      bodyHash: row.bodyHash,
      statusCode: row.statusCode,
      responseBody: row.responseBody,
      createdAt: row.createdAt,
      expiresAt,
    };
  }

  async put(record: IdempotencyKeyRecord): Promise<void> {
    await (this.prisma as any).idempotencyKey.upsert({
      where: { companyId_key: { companyId: record.companyId, key: record.key } },
      create: {
        companyId: record.companyId,
        key: record.key,
        method: record.method,
        path: record.path,
        bodyHash: record.bodyHash,
        statusCode: record.statusCode,
        responseBody: record.responseBody as any,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
      },
      update: {
        method: record.method,
        path: record.path,
        bodyHash: record.bodyHash,
        statusCode: record.statusCode,
        responseBody: record.responseBody as any,
        expiresAt: record.expiresAt,
      },
    });
  }

  async delete(companyId: string, key: string): Promise<void> {
    await (this.prisma as any).idempotencyKey.deleteMany({
      where: { companyId, key },
    });
  }
}
