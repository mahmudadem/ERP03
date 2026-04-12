import { DocumentReference, Firestore, Query, Transaction } from 'firebase-admin/firestore';
import {
  StockAdjustment,
  StockAdjustmentStatus,
} from '../../../../domain/inventory/entities/StockAdjustment';
import {
  IStockAdjustmentRepository,
  StockAdjustmentListOptions,
} from '../../../../repository/interfaces/inventory/IStockAdjustmentRepository';
import { StockAdjustmentMapper } from '../../mappers/InventoryMappers';
import { getInventoryCollection } from './InventoryFirestorePaths';

export class FirestoreStockAdjustmentRepository implements IStockAdjustmentRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getInventoryCollection(this.db, companyId, 'stock_adjustments');
  }

  private async resolveRefById(id: string): Promise<DocumentReference | null> {
    const snap = await this.db.collectionGroup('stock_adjustments').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].ref;
  }

  private applyPaging(query: Query, opts?: StockAdjustmentListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  async createAdjustment(adjustment: StockAdjustment, transaction?: unknown): Promise<void> {
    const ref = this.collection(adjustment.companyId).doc(adjustment.id);
    const txn = this.asTransaction(transaction);
    const payload = StockAdjustmentMapper.toPersistence(adjustment);
    if (txn) {
      txn.set(ref, payload);
      return;
    }
    await ref.set(payload);
  }

  async updateAdjustment(
    companyId: string,
    id: string,
    data: Partial<StockAdjustment>,
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

  async getAdjustment(id: string): Promise<StockAdjustment | null> {
    const ref = await this.resolveRefById(id);
    if (!ref) return null;

    const doc = await ref.get();
    if (!doc.exists) return null;

    return StockAdjustmentMapper.toDomain(doc.data());
  }

  async getCompanyAdjustments(
    companyId: string,
    opts?: StockAdjustmentListOptions
  ): Promise<StockAdjustment[]> {
    let query: Query = this.collection(companyId).orderBy('date', 'desc');
    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => StockAdjustmentMapper.toDomain(doc.data()));
  }

  async getByStatus(
    companyId: string,
    status: StockAdjustmentStatus,
    opts?: StockAdjustmentListOptions
  ): Promise<StockAdjustment[]> {
    let query: Query = this.collection(companyId)
      .where('status', '==', status)
      .orderBy('date', 'desc');

    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => StockAdjustmentMapper.toDomain(doc.data()));
  }

  async deleteAdjustment(id: string): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.delete();
  }
}
