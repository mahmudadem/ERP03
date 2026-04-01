import { DocumentReference, Firestore, Query } from 'firebase-admin/firestore';
import { ItemCategory } from '../../../../domain/inventory/entities/ItemCategory';
import {
  CategoryListOptions,
  IItemCategoryRepository,
} from '../../../../repository/interfaces/inventory/IItemCategoryRepository';
import { ItemCategoryMapper } from '../../mappers/InventoryMappers';
import { getInventoryCollection } from './InventoryFirestorePaths';

export class FirestoreItemCategoryRepository implements IItemCategoryRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getInventoryCollection(this.db, companyId, 'categories');
  }

  private async resolveRefById(id: string): Promise<DocumentReference | null> {
    const snap = await this.db.collectionGroup('categories').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].ref;
  }

  private applyPaging(query: Query, opts?: CategoryListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  async createCategory(category: ItemCategory): Promise<void> {
    await this.collection(category.companyId).doc(category.id).set(ItemCategoryMapper.toPersistence(category));
  }

  async updateCategory(id: string, data: Partial<ItemCategory>): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.update(data as any);
  }

  async getCategory(id: string): Promise<ItemCategory | null> {
    const ref = await this.resolveRefById(id);
    if (!ref) return null;
    const doc = await ref.get();
    if (!doc.exists) return null;
    return ItemCategoryMapper.toDomain(doc.data());
  }

  async getCompanyCategories(companyId: string, opts?: CategoryListOptions): Promise<ItemCategory[]> {
    let query: Query = this.collection(companyId).orderBy('sortOrder', 'asc').orderBy('name', 'asc');

    if (opts?.active !== undefined) {
      query = query.where('active', '==', opts.active);
    }

    query = this.applyPaging(query, opts);
    const snap = await query.get();
    return snap.docs.map((doc) => ItemCategoryMapper.toDomain(doc.data()));
  }

  async getCategoriesByParent(
    companyId: string,
    parentId?: string,
    opts?: CategoryListOptions
  ): Promise<ItemCategory[]> {
    let query: Query = this.collection(companyId).orderBy('sortOrder', 'asc').orderBy('name', 'asc');

    if (opts?.active !== undefined) {
      query = query.where('active', '==', opts.active);
    }

    if (parentId) {
      query = query.where('parentId', '==', parentId);
      query = this.applyPaging(query, opts);
      const snap = await query.get();
      return snap.docs.map((doc) => ItemCategoryMapper.toDomain(doc.data()));
    }

    query = this.applyPaging(query, opts);
    const snap = await query.get();

    return snap.docs
      .map((doc) => ItemCategoryMapper.toDomain(doc.data()))
      .filter((category) => !category.parentId);
  }

  async deleteCategory(id: string): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.delete();
  }
}
