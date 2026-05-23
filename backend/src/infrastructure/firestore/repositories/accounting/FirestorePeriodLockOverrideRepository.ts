import { Firestore, Query } from 'firebase-admin/firestore';
import { PeriodLockOverride } from '../../../../domain/accounting/entities/PeriodLockOverride';
import {
  IPeriodLockOverrideRepository,
  PeriodLockOverrideListOptions,
} from '../../../../repository/interfaces/accounting/IPeriodLockOverrideRepository';
import { getSalesCollection } from '../sales/SalesFirestorePaths';

interface PeriodLockOverrideDoc {
  id: string;
  companyId: string;
  sourceModule: string;
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  documentDate: string;
  lockedThroughDate: string;
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
  createdAt: string;
}

class PeriodLockOverrideMapper {
  static toPersistence(override: PeriodLockOverride): PeriodLockOverrideDoc {
    return {
      id: override.id,
      companyId: override.companyId,
      sourceModule: override.sourceModule,
      sourceType: override.sourceType,
      sourceId: override.sourceId,
      sourceNumber: override.sourceNumber,
      documentDate: override.documentDate,
      lockedThroughDate: override.lockedThroughDate,
      reason: override.reason,
      overriddenBy: override.overriddenBy,
      overriddenAt: override.overriddenAt.toISOString(),
      createdAt: override.createdAt.toISOString(),
    };
  }

  static toDomain(data: any): PeriodLockOverride {
    return new PeriodLockOverride({
      id: data.id,
      companyId: data.companyId,
      sourceModule: data.sourceModule as 'sales',
      sourceType: data.sourceType as PeriodLockOverride['sourceType'],
      sourceId: data.sourceId,
      sourceNumber: data.sourceNumber,
      documentDate: data.documentDate,
      lockedThroughDate: data.lockedThroughDate,
      reason: data.reason,
      overriddenBy: data.overriddenBy,
      overriddenAt: new Date(data.overriddenAt),
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
    });
  }
}

export class FirestorePeriodLockOverrideRepository implements IPeriodLockOverrideRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'period_lock_overrides');
  }

  async create(override: PeriodLockOverride, _transaction?: unknown): Promise<void> {
    const ref = this.collection(override.companyId).doc(override.id);
    const data = PeriodLockOverrideMapper.toPersistence(override);
    await ref.set(data);
  }

  async listByCompany(
    companyId: string,
    opts?: PeriodLockOverrideListOptions
  ): Promise<PeriodLockOverride[]> {
    let query: Query = this.collection(companyId);
    query = query.orderBy('createdAt', 'desc');
    if (opts?.limit) query = query.limit(opts.limit);
    const snap = await query.get();
    return snap.docs.map((doc) => PeriodLockOverrideMapper.toDomain(doc.data()));
  }

  async findBySource(companyId: string, sourceId: string): Promise<PeriodLockOverride | null> {
    const snap = await this.collection(companyId)
      .where('sourceId', '==', sourceId)
      .limit(1)
      .get();
    if (snap.empty) return null;
    return PeriodLockOverrideMapper.toDomain(snap.docs[0].data());
  }
}
