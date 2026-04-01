import { DocumentReference, Firestore, Query, Transaction } from 'firebase-admin/firestore';
import {
  MovementType,
  ReferenceType,
  StockDirection,
  StockMovement,
} from '../../../../domain/inventory/entities/StockMovement';
import {
  IStockMovementRepository,
  MovementQueryOptions,
} from '../../../../repository/interfaces/inventory/IStockMovementRepository';
import { StockMovementMapper } from '../../mappers/InventoryMappers';
import { getInventoryCollection } from './InventoryFirestorePaths';

export class FirestoreStockMovementRepository implements IStockMovementRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getInventoryCollection(this.db, companyId, 'stock_movements');
  }

  private asTransaction(transaction?: unknown): Transaction | undefined {
    if (!transaction) return undefined;
    return transaction as Transaction;
  }

  private async resolveRefById(id: string): Promise<DocumentReference | null> {
    const snap = await this.db.collectionGroup('stock_movements').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].ref;
  }

  private applyMovementFilters(
    query: Query,
    movementType?: MovementType,
    direction?: StockDirection
  ): Query {
    let ref = query;
    if (movementType) ref = ref.where('movementType', '==', movementType);
    if (direction) ref = ref.where('direction', '==', direction);
    return ref;
  }

  private applyPaging(query: Query, opts?: MovementQueryOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  async recordMovement(movement: StockMovement, transaction?: unknown): Promise<void> {
    const ref = this.collection(movement.companyId).doc(movement.id);
    const data = StockMovementMapper.toPersistence(movement);
    const txn = this.asTransaction(transaction);

    if (txn) {
      txn.set(ref, data);
      return;
    }

    await ref.set(data);
  }

  async getItemMovements(companyId: string, itemId: string, opts?: MovementQueryOptions): Promise<StockMovement[]> {
    let query: Query = this.collection(companyId)
      .where('itemId', '==', itemId)
      .orderBy('postingSeq', 'desc');

    query = this.applyMovementFilters(query, opts?.movementType, opts?.direction);
    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => StockMovementMapper.toDomain(doc.data()));
  }

  async getWarehouseMovements(
    companyId: string,
    warehouseId: string,
    opts?: MovementQueryOptions
  ): Promise<StockMovement[]> {
    let query: Query = this.collection(companyId)
      .where('warehouseId', '==', warehouseId)
      .orderBy('postingSeq', 'desc');

    query = this.applyMovementFilters(query, opts?.movementType, opts?.direction);
    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => StockMovementMapper.toDomain(doc.data()));
  }

  async getMovementsByReference(
    companyId: string,
    referenceType: ReferenceType,
    referenceId: string
  ): Promise<StockMovement[]> {
    const snap = await this.collection(companyId)
      .where('referenceType', '==', referenceType)
      .where('referenceId', '==', referenceId)
      .orderBy('postingSeq', 'desc')
      .get();

    return snap.docs.map((doc) => StockMovementMapper.toDomain(doc.data()));
  }

  async getMovementByReference(
    companyId: string,
    referenceType: ReferenceType,
    referenceId: string,
    referenceLineId?: string
  ): Promise<StockMovement | null> {
    let query: Query = this.collection(companyId)
      .where('referenceType', '==', referenceType)
      .where('referenceId', '==', referenceId);

    if (referenceLineId !== undefined && referenceLineId !== null && referenceLineId !== '') {
      query = query.where('referenceLineId', '==', referenceLineId);
    }

    const snap = await query.orderBy('postingSeq', 'desc').limit(1).get();
    if (snap.empty) return null;

    return StockMovementMapper.toDomain(snap.docs[0].data());
  }

  async getMovementsByDateRange(
    companyId: string,
    from: string,
    to: string,
    opts?: MovementQueryOptions
  ): Promise<StockMovement[]> {
    let query: Query = this.collection(companyId)
      .where('date', '>=', from)
      .where('date', '<=', to)
      .orderBy('date', 'desc')
      .orderBy('postingSeq', 'desc');

    query = this.applyMovementFilters(query, opts?.movementType, opts?.direction);
    query = this.applyPaging(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => StockMovementMapper.toDomain(doc.data()));
  }

  async getUnsettledMovements(companyId: string): Promise<StockMovement[]> {
    const snap = await this.collection(companyId)
      .where('costSettled', '==', false)
      .orderBy('postingSeq', 'desc')
      .get();

    return snap.docs.map((doc) => StockMovementMapper.toDomain(doc.data()));
  }

  async getMovement(id: string): Promise<StockMovement | null> {
    const ref = await this.resolveRefById(id);
    if (!ref) return null;

    const doc = await ref.get();
    if (!doc.exists) return null;

    return StockMovementMapper.toDomain(doc.data());
  }
}
