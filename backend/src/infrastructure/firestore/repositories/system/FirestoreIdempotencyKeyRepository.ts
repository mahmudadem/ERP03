import * as admin from 'firebase-admin';
import { IdempotencyKeyRecord } from '../../../../domain/system/entities/IdempotencyKey';
import { IIdempotencyKeyRepository } from '../../../../repository/interfaces/system/IIdempotencyKeyRepository';

const toTimestamp = (d: Date) => admin.firestore.Timestamp.fromDate(d);

export class FirestoreIdempotencyKeyRepository implements IIdempotencyKeyRepository {
  constructor(private readonly db: admin.firestore.Firestore) {}

  private doc(companyId: string, key: string) {
    return this.db
      .collection('companies')
      .doc(companyId)
      .collection('idempotency_keys')
      .doc(key);
  }

  async get(companyId: string, key: string): Promise<IdempotencyKeyRecord | null> {
    const snap = await this.doc(companyId, key).get();
    if (!snap.exists) return null;
    const data = snap.data() as any;
    const expiresAt: Date = data.expiresAt?.toDate?.() ?? new Date(data.expiresAt);
    if (expiresAt.getTime() <= Date.now()) {
      // Stale; treat as absent. Lazy expiry — actual deletion handled by Firestore TTL policy.
      return null;
    }
    return {
      key: data.key,
      companyId: data.companyId,
      method: data.method,
      path: data.path,
      bodyHash: data.bodyHash,
      statusCode: data.statusCode,
      responseBody: data.responseBody,
      createdAt: data.createdAt?.toDate?.() ?? new Date(data.createdAt),
      expiresAt,
    };
  }

  async put(record: IdempotencyKeyRecord): Promise<void> {
    await this.doc(record.companyId, record.key).set({
      key: record.key,
      companyId: record.companyId,
      method: record.method,
      path: record.path,
      bodyHash: record.bodyHash,
      statusCode: record.statusCode,
      responseBody: record.responseBody,
      createdAt: toTimestamp(record.createdAt),
      expiresAt: toTimestamp(record.expiresAt),
    });
  }

  async delete(companyId: string, key: string): Promise<void> {
    await this.doc(companyId, key).delete();
  }
}
