import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import {
  PromotionRule,
  BuyXGetYConfig,
  ThresholdDiscountConfig,
} from '../../../../domain/sales/entities/PromotionRule';
import {
  IPromotionRuleRepository,
  PromotionRuleListOptions,
} from '../../../../repository/interfaces/sales/IPromotionRuleRepository';
import { getSalesCollection } from './SalesFirestorePaths';

// ---------------------------------------------------------------------------
// Inline mapper (kept private to avoid touching the shared SalesMappers.ts)
// ---------------------------------------------------------------------------

interface PromotionRuleDoc {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  priority: number;
  validFrom: string | null;
  validTo: string | null;
  scope: string;
  itemIds: string[];
  categoryIds: string[];
  buyXGetY: BuyXGetYConfig | null;
  thresholdDiscount: ThresholdDiscountConfig | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

class PromotionRuleMapper {
  static toPersistence(rule: PromotionRule): PromotionRuleDoc {
    return {
      id: rule.id,
      companyId: rule.companyId,
      name: rule.name,
      description: rule.description ?? null,
      type: rule.type,
      status: rule.status,
      priority: rule.priority,
      validFrom: rule.validFrom ?? null,
      validTo: rule.validTo ?? null,
      scope: rule.scope,
      itemIds: rule.itemIds,
      categoryIds: rule.categoryIds,
      buyXGetY: rule.buyXGetY ?? null,
      thresholdDiscount: rule.thresholdDiscount ?? null,
      createdBy: rule.createdBy,
      createdAt: rule.createdAt.toISOString(),
      updatedAt: rule.updatedAt.toISOString(),
    };
  }

  static toDomain(data: any): PromotionRule {
    return new PromotionRule({
      id: data.id,
      companyId: data.companyId,
      name: data.name,
      description: data.description != null ? data.description : undefined,
      type: data.type,
      status: data.status,
      priority: data.priority,
      validFrom: data.validFrom != null ? data.validFrom : undefined,
      validTo: data.validTo != null ? data.validTo : undefined,
      scope: data.scope,
      itemIds: data.itemIds ?? [],
      categoryIds: data.categoryIds ?? [],
      buyXGetY: data.buyXGetY != null ? data.buyXGetY : undefined,
      thresholdDiscount: data.thresholdDiscount != null ? data.thresholdDiscount : undefined,
      createdBy: data.createdBy,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : undefined,
    });
  }
}

// ---------------------------------------------------------------------------
// Repository
// ---------------------------------------------------------------------------

export class FirestorePromotionRuleRepository implements IPromotionRuleRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSalesCollection(this.db, companyId, 'promotion_rules');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async create(rule: PromotionRule, transaction?: unknown): Promise<void> {
    const ref = this.collection(rule.companyId).doc(rule.id);
    const data = PromotionRuleMapper.toPersistence(rule);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data);
      return;
    }
    await ref.set(data);
  }

  async update(rule: PromotionRule, transaction?: unknown): Promise<void> {
    const ref = this.collection(rule.companyId).doc(rule.id);
    const data = PromotionRuleMapper.toPersistence(rule);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.set(ref, data, { merge: true });
      return;
    }
    await ref.set(data, { merge: true });
  }

  async getById(companyId: string, id: string): Promise<PromotionRule | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return PromotionRuleMapper.toDomain(doc.data());
  }

  async list(
    companyId: string,
    opts?: PromotionRuleListOptions
  ): Promise<PromotionRule[]> {
    let query: Query = this.collection(companyId);

    // Default to ACTIVE-only unless a status filter is set or includeInactive is true.
    if (opts?.status) {
      query = query.where('status', '==', opts.status);
    } else if (!opts?.includeInactive) {
      query = query.where('status', '==', 'ACTIVE');
    }

    if (opts?.type) {
      query = query.where('type', '==', opts.type);
    }

    // Return lowest priority number first (evaluated first)
    query = query.orderBy('priority', 'asc');

    if (opts?.offset) query = query.offset(opts.offset);
    if (opts?.limit) query = query.limit(opts.limit);

    const snap = await query.get();
    return snap.docs.map((doc) => PromotionRuleMapper.toDomain(doc.data()));
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.collection(companyId).doc(id).delete();
  }
}
