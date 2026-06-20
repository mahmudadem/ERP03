import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import {
  InventoryRevaluation,
  InventoryRevaluationStatus,
} from '../../../../domain/inventory/entities/InventoryRevaluation';
import {
  IInventoryRevaluationRepository,
  InventoryRevaluationListOptions,
} from '../../../../repository/interfaces/inventory/IInventoryRevaluationRepository';
import { InventoryRevaluationMapper } from '../../mappers/InventoryMappers';
import { getInventoryCollection } from './InventoryFirestorePaths';

export class FirestoreInventoryRevaluationRepository implements IInventoryRevaluationRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getInventoryCollection(this.db, companyId, 'inventory_revaluations');
  }

  private applyPaging(query: Query, opts?: InventoryRevaluationListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async createRevaluation(revaluation: InventoryRevaluation, transaction?: unknown): Promise<void> {
    const ref = this.collection(revaluation.companyId).doc(revaluation.id);
    const txn = this.asTransaction(transaction);
    const payload = InventoryRevaluationMapper.toPersistence(revaluation);
    if (txn) {
      txn.set(ref, payload);
      return;
    }
    await ref.set(payload);
  }

  async updateRevaluation(
    companyId: string,
    id: string,
    data: Partial<InventoryRevaluation>,
    transaction?: unknown
  ): Promise<void> {
    const ref = this.collection(companyId).doc(id);
    const txn = this.asTransaction(transaction);
    if (txn) {
      txn.update(ref, data as any);
      return;
    }
    await ref.update(data as any);
  }

  async getRevaluation(companyId: string, id: string): Promise<InventoryRevaluation | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return InventoryRevaluationMapper.toDomain(doc.data());
  }

  async getCompanyRevaluations(
    companyId: string,
    opts?: InventoryRevaluationListOptions
  ): Promise<InventoryRevaluation[]> {
    let query: Query = this.collection(companyId).orderBy('date', 'desc');
    query = this.applyPaging(query, opts);
    const snap = await query.get();
    return snap.docs.map((doc) => InventoryRevaluationMapper.toDomain(doc.data()));
  }

  async getByStatus(
    companyId: string,
    status: InventoryRevaluationStatus,
    opts?: InventoryRevaluationListOptions
  ): Promise<InventoryRevaluation[]> {
    let query: Query = this.collection(companyId)
      .where('status', '==', status)
      .orderBy('date', 'desc');
    query = this.applyPaging(query, opts);
    const snap = await query.get();
    return snap.docs.map((doc) => InventoryRevaluationMapper.toDomain(doc.data()));
  }

  async deleteRevaluation(companyId: string, id: string): Promise<void> {
    await this.collection(companyId).doc(id).delete();
  }
}
