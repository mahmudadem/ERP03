import { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import { StockLevel } from '../../../../domain/inventory/entities/StockLevel';
import {
  IStockLevelRepository,
  StockLevelListOptions,
} from '../../../../repository/interfaces/inventory/IStockLevelRepository';
import { StockLevelMapper } from '../../mappers/InventoryMappers';
import { getInventoryCollection } from './InventoryFirestorePaths';

export class FirestoreStockLevelRepository implements IStockLevelRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getInventoryCollection(this.db, companyId, 'stock_levels');
  }

  private applyPaging(query: Query, opts?: StockLevelListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  async getLevel(companyId: string, itemId: string, warehouseId: string): Promise<StockLevel | null> {
    const id = StockLevel.compositeId(itemId, warehouseId);
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return StockLevelMapper.toDomain(doc.data());
  }

  async getLevelsByItem(companyId: string, itemId: string, opts?: StockLevelListOptions): Promise<StockLevel[]> {
    let query: Query = this.collection(companyId)
      .where('itemId', '==', itemId)
      .orderBy('warehouseId', 'asc');

    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => StockLevelMapper.toDomain(doc.data()));
  }

  async getLevelsByWarehouse(
    companyId: string,
    warehouseId: string,
    opts?: StockLevelListOptions
  ): Promise<StockLevel[]> {
    let query: Query = this.collection(companyId)
      .where('warehouseId', '==', warehouseId)
      .orderBy('itemId', 'asc');

    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => StockLevelMapper.toDomain(doc.data()));
  }

  async getAllLevels(companyId: string, opts?: StockLevelListOptions): Promise<StockLevel[]> {
    let query: Query = this.collection(companyId).orderBy('itemId', 'asc');

    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => StockLevelMapper.toDomain(doc.data()));
  }

  async upsertLevel(level: StockLevel): Promise<void> {
    await this.collection(level.companyId).doc(level.id).set(StockLevelMapper.toPersistence(level));
  }

  async getLevelInTransaction(
    transaction: unknown,
    companyId: string,
    itemId: string,
    warehouseId: string
  ): Promise<StockLevel | null> {
    const txn = transaction as Transaction;
    const id = StockLevel.compositeId(itemId, warehouseId);
    const ref = this.collection(companyId).doc(id);
    const doc = await txn.get(ref);

    if (!doc.exists) return null;
    return StockLevelMapper.toDomain(doc.data());
  }

  async upsertLevelInTransaction(transaction: unknown, level: StockLevel): Promise<void> {
    const txn = transaction as Transaction;
    const ref = this.collection(level.companyId).doc(level.id);
    txn.set(ref, StockLevelMapper.toPersistence(level));
  }
}
