import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { PostingLog } from '../../../../domain/accounting/entities/PostingLog';
import { IPostingLogRepository } from '../../../../repository/interfaces/accounting/IPostingLogRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

const toTimestamp = (d: Date) => Timestamp.fromDate(d);
const fromTimestamp = (v: any): Date => (v?.toDate ? v.toDate() : new Date(v));

export class FirestorePostingLogRepository implements IPostingLogRepository {
  constructor(private readonly db: admin.firestore.Firestore) {}

  private col(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('posting_logs');
  }

  private toDomain(data: any): PostingLog {
    return new PostingLog({
      id: data.id,
      companyId: data.companyId,
      sourceModule: data.sourceModule,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      sourceDocNumber: data.sourceDocNumber,
      strategy: data.strategy,
      voucherIds: data.voucherIds ?? [],
      decisions: data.decisions ?? [],
      warnings: data.warnings ?? [],
      idempotencyKey: data.idempotencyKey,
      postedAt: fromTimestamp(data.postedAt),
      postedBy: data.postedBy,
    });
  }

  async create(log: PostingLog, transaction?: unknown): Promise<void> {
    try {
      const data = log.toJSON();
      data.postedAt = toTimestamp(log.postedAt);
      const docRef = this.col(log.companyId).doc(log.id);
      const tx = transaction as admin.firestore.Transaction | undefined;
      if (tx && typeof tx.set === 'function') {
        tx.set(docRef, data);
        return;
      }
      await docRef.set(data);
    } catch (err: any) {
      console.error('[FirestorePostingLogRepository] underlying error:', {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        logId: log.id,
        sourceId: log.sourceId,
      });
      throw new InfrastructureError('Failed to write PostingLog', err);
    }
  }

  async getById(companyId: string, id: string): Promise<PostingLog | null> {
    const snap = await this.col(companyId).doc(id).get();
    if (!snap.exists) return null;
    return this.toDomain(snap.data());
  }

  async findBySourceId(companyId: string, sourceId: string): Promise<PostingLog[]> {
    const snap = await this.col(companyId).where('sourceId', '==', sourceId).get();
    return snap.docs.map((d) => this.toDomain(d.data()));
  }

  async listBySource(
    companyId: string,
    filter: { sourceModule?: string; sourceType?: string; limit?: number }
  ): Promise<PostingLog[]> {
    let q: admin.firestore.Query = this.col(companyId);
    if (filter.sourceModule) q = q.where('sourceModule', '==', filter.sourceModule);
    if (filter.sourceType) q = q.where('sourceType', '==', filter.sourceType);
    if (filter.limit) q = q.limit(filter.limit);
    const snap = await q.get();
    return snap.docs.map((d) => this.toDomain(d.data()));
  }
}
