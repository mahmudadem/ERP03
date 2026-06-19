import { DocumentReference, Firestore, Query, Transaction } from 'firebase-admin/firestore';
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

  private async resolveRefById(id: string): Promise<DocumentReference | null> {
    const snap = await this.db.collectionGroup('inventory_revaluations').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].ref;
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
    const clean = JSON.parse(JSON.stringify(data));
    if (txn) {
      txn.update(ref, clean);
      return;
    }
    await ref.update(clean);
  }

  async getRevaluation(id: string): Promise<InventoryRevaluation | null> {
    const ref = await this.resolveRefById(id);
    if (!ref) return null;
    const doc = await ref.get();
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

  async deleteRevaluation(id: string): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.delete();
  }
}
