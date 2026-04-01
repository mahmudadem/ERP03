import { DocumentReference, Firestore, Query } from 'firebase-admin/firestore';
import { Warehouse } from '../../../../domain/inventory/entities/Warehouse';
import { IWarehouseRepository, WarehouseListOptions } from '../../../../repository/interfaces/inventory/IWarehouseRepository';
import { WarehouseMapper } from '../../mappers/InventoryMappers';
import { getInventoryCollection } from './InventoryFirestorePaths';

export class FirestoreWarehouseRepository implements IWarehouseRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getInventoryCollection(this.db, companyId, 'warehouses');
  }

  private async resolveRefById(id: string): Promise<DocumentReference | null> {
    const snap = await this.db.collectionGroup('warehouses').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].ref;
  }

  private applyListOptions(query: Query, opts?: WarehouseListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  async createWarehouse(warehouse: Warehouse): Promise<void> {
    await this.collection(warehouse.companyId).doc(warehouse.id).set(WarehouseMapper.toPersistence(warehouse));
  }

  async updateWarehouse(id: string, data: Partial<Warehouse>): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.update(data as any);
  }

  async getWarehouse(id: string): Promise<Warehouse | null> {
    const ref = await this.resolveRefById(id);
    if (!ref) return null;
    const doc = await ref.get();
    if (!doc.exists) return null;
    return WarehouseMapper.toDomain(doc.data());
  }

  async getCompanyWarehouses(companyId: string, opts?: WarehouseListOptions): Promise<Warehouse[]> {
    let query: Query = this.collection(companyId);

    if (opts?.active !== undefined) {
      query = query.where('active', '==', opts.active);
    }

    query = query.orderBy('code', 'asc');
    query = this.applyListOptions(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => WarehouseMapper.toDomain(doc.data()));
  }

  async getWarehouseByCode(companyId: string, code: string): Promise<Warehouse | null> {
    const snap = await this.collection(companyId).where('code', '==', code).limit(1).get();
    if (snap.empty) return null;
    return WarehouseMapper.toDomain(snap.docs[0].data());
  }
}
