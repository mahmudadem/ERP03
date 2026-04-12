import { DocumentReference, Firestore, Query } from 'firebase-admin/firestore';
import { Item } from '../../../../domain/inventory/entities/Item';
import { IItemRepository, ItemListOptions } from '../../../../repository/interfaces/inventory/IItemRepository';
import { ItemMapper } from '../../mappers/InventoryMappers';
import { getInventoryCollection } from './InventoryFirestorePaths';

export class FirestoreItemRepository implements IItemRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getInventoryCollection(this.db, companyId, 'items');
  }

  private async resolveRefById(id: string): Promise<DocumentReference | null> {
    const snap = await this.db.collectionGroup('items').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].ref;
  }

  private applyListOptions(query: Query, opts?: ItemListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  async createItem(item: Item): Promise<void> {
    await this.collection(item.companyId).doc(item.id).set(ItemMapper.toPersistence(item));
  }

  async updateItem(id: string, data: Partial<Item>): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.update(data as any);
  }

  async setItemActive(id: string, active: boolean): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.update({ active, updatedAt: new Date() });
  }

  async getItem(id: string): Promise<Item | null> {
    const ref = await this.resolveRefById(id);
    if (!ref) return null;
    const doc = await ref.get();
    if (!doc.exists) return null;
    return ItemMapper.toDomain(doc.data());
  }

  async getCompanyItems(companyId: string, opts?: ItemListOptions): Promise<Item[]> {
    let query: Query = this.collection(companyId);

    if (opts?.type) query = query.where('type', '==', opts.type);
    if (opts?.categoryId) query = query.where('categoryId', '==', opts.categoryId);
    if (opts?.active !== undefined) query = query.where('active', '==', opts.active);
    if (opts?.trackInventory !== undefined) query = query.where('trackInventory', '==', opts.trackInventory);

    query = query.orderBy('code', 'asc');
    query = this.applyListOptions(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => ItemMapper.toDomain(doc.data()));
  }

  async getItemByCode(companyId: string, code: string): Promise<Item | null> {
    const snap = await this.collection(companyId).where('code', '==', code).limit(1).get();
    if (snap.empty) return null;
    return ItemMapper.toDomain(snap.docs[0].data());
  }

  async getItemsByCategory(companyId: string, categoryId: string, opts?: ItemListOptions): Promise<Item[]> {
    let query: Query = this.collection(companyId)
      .where('categoryId', '==', categoryId)
      .orderBy('code', 'asc');

    query = this.applyListOptions(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => ItemMapper.toDomain(doc.data()));
  }

  async searchItems(companyId: string, query: string, opts?: ItemListOptions): Promise<Item[]> {
    const normalized = (query || '').trim().toLowerCase();
    if (!normalized) {
      return this.getCompanyItems(companyId, opts);
    }

    const list = await this.getCompanyItems(companyId, {
      ...opts,
      limit: opts?.limit ?? 100,
      offset: opts?.offset ?? 0,
    });

    return list.filter((item) =>
      item.code.toLowerCase().includes(normalized) ||
      item.name.toLowerCase().includes(normalized) ||
      (item.barcode || '').toLowerCase().includes(normalized)
    );
  }

  async deleteItem(id: string): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.delete();
  }

  async hasMovements(companyId: string, itemId: string): Promise<boolean> {
    const snap = await getInventoryCollection(this.db, companyId, 'stock_movements')
      .where('itemId', '==', itemId)
      .limit(1)
      .get();

    return !snap.empty;
  }
}
