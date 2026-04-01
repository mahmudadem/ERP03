import { DocumentReference, Firestore, Query } from 'firebase-admin/firestore';
import { StockTransfer, StockTransferStatus } from '../../../../domain/inventory/entities/StockTransfer';
import {
  IStockTransferRepository,
  StockTransferListOptions,
} from '../../../../repository/interfaces/inventory/IStockTransferRepository';
import { StockTransferMapper } from '../../mappers/InventoryMappers';
import { getInventoryCollection } from './InventoryFirestorePaths';

export class FirestoreStockTransferRepository implements IStockTransferRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getInventoryCollection(this.db, companyId, 'stock_transfers');
  }

  private async resolveRefById(id: string): Promise<DocumentReference | null> {
    const snap = await this.db.collectionGroup('stock_transfers').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].ref;
  }

  private applyPaging(query: Query, opts?: StockTransferListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  async createTransfer(transfer: StockTransfer): Promise<void> {
    await this.collection(transfer.companyId).doc(transfer.id).set(StockTransferMapper.toPersistence(transfer));
  }

  async updateTransfer(id: string, data: Partial<StockTransfer>): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.update(data as any);
  }

  async getTransfer(id: string): Promise<StockTransfer | null> {
    const ref = await this.resolveRefById(id);
    if (!ref) return null;

    const doc = await ref.get();
    if (!doc.exists) return null;

    return StockTransferMapper.toDomain(doc.data());
  }

  async getCompanyTransfers(companyId: string, opts?: StockTransferListOptions): Promise<StockTransfer[]> {
    let query: Query = this.collection(companyId).orderBy('date', 'desc');
    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => StockTransferMapper.toDomain(doc.data()));
  }

  async getByStatus(
    companyId: string,
    status: StockTransferStatus,
    opts?: StockTransferListOptions
  ): Promise<StockTransfer[]> {
    let query: Query = this.collection(companyId)
      .where('status', '==', status)
      .orderBy('date', 'desc');

    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => StockTransferMapper.toDomain(doc.data()));
  }

  async deleteTransfer(id: string): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.delete();
  }
}
