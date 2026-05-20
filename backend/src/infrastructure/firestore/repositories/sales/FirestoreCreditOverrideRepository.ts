import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { CreditOverride } from '../../../../domain/sales/entities/CreditOverride';
import {
  ICreditOverrideRepository,
  CreditOverrideListOptions,
} from '../../../../repository/interfaces/sales/ICreditOverrideRepository';
import { getSalesCollection } from './SalesFirestorePaths';

// ---------------------------------------------------------------------------
// Inline mapper (kept private to avoid touching the shared SalesMappers.ts)
// ---------------------------------------------------------------------------

interface CreditOverrideDoc {
  id: string;
  companyId: string;
  customerId: string;
  sourceType: string;
  sourceId: string;
  sourceNumber: string;
  creditLimit: number;
  currentExposure: number;
  orderAmount: number;
  projectedExposure: number;
  reason: string;
  overriddenBy: string;
  overriddenAt: string;
  createdAt: string;
}

class CreditOverrideMapper {
  static toPersistence(override: CreditOverride): CreditOverrideDoc {
    return {
      id: override.id,
      companyId: override.companyId,
      customerId: override.customerId,
      sourceType: override.sourceType,
      sourceId: override.sourceId,
      sourceNumber: override.sourceNumber,
      creditLimit: override.creditLimit,
      currentExposure: override.currentExposure,
      orderAmount: override.orderAmount,
      projectedExposure: override.projectedExposure,
      reason: override.reason,
      overriddenBy: override.overriddenBy,
      overriddenAt: override.overriddenAt.toISOString(),
      createdAt: override.createdAt.toISOString(),
    };
  }

  static toDomain(data: any): CreditOverride {
    return new CreditOverride({
      id: data.id,
      companyId: data.companyId,
      customerId: data.customerId,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      sourceNumber: data.sourceNumber,
      creditLimit: data.creditLimit,
      currentExposure: data.currentExposure,
      orderAmount: data.orderAmount,
      projectedExposure: data.projectedExposure,
      reason: data.reason,
      overriddenBy: data.overriddenBy,
      overriddenAt: new Date(data.overriddenAt),
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class FirestoreCreditOverrideRepository implements ICreditOverrideRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'credit_overrides');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(override: CreditOverride, transaction?: unknown): Promise<void> {
    const ref = this.collection(override.companyId).doc(override.id);
    const data = CreditOverrideMapper.toPersistence(override);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async getById(companyId: string, id: string): Promise<CreditOverride | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return CreditOverrideMapper.toDomain(doc.data());
  }

  async list(
    companyId: string,
    opts?: CreditOverrideListOptions
  ): Promise<CreditOverride[]> {
    let query: Query = this.collection(companyId);

    if (opts?.customerId) {
      query = query.where('customerId', '==', opts.customerId);
    }
    if (opts?.sourceId) {
      query = query.where('sourceId', '==', opts.sourceId);
    }

    query = query.orderBy('createdAt', 'desc');

    if (opts?.offset) query = query.offset(opts.offset);
    if (opts?.limit) query = query.limit(opts.limit);

    const snap = await query.get();
    return snap.docs.map((doc) => CreditOverrideMapper.toDomain(doc.data()));
  }
}
