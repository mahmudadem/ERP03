import { DocumentReference, Firestore, Query } from 'firebase-admin/firestore';
import { UomConversion } from '../../../../domain/inventory/entities/UomConversion';
import {
  IUomConversionRepository,
  UomConversionListOptions,
} from '../../../../repository/interfaces/inventory/IUomConversionRepository';
import { UomConversionMapper } from '../../mappers/InventoryMappers';
import { getInventoryCollection } from './InventoryFirestorePaths';

export class FirestoreUomConversionRepository implements IUomConversionRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getInventoryCollection(this.db, companyId, 'uom_conversions');
  }

  private async resolveRefById(id: string): Promise<DocumentReference | null> {
    const snap = await this.db.collectionGroup('uom_conversions').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].ref;
  }

  private applyPaging(query: Query, opts?: UomConversionListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  async createConversion(conversion: UomConversion): Promise<void> {
    await this.collection(conversion.companyId).doc(conversion.id).set(UomConversionMapper.toPersistence(conversion));
  }

  async updateConversion(id: string, data: Partial<UomConversion>): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.update(data as any);
  }

  async getConversion(id: string): Promise<UomConversion | null> {
    const ref = await this.resolveRefById(id);
    if (!ref) return null;
    const doc = await ref.get();
    if (!doc.exists) return null;
    return UomConversionMapper.toDomain(doc.data());
  }

  async getConversionsForItem(
    companyId: string,
    itemId: string,
    opts?: UomConversionListOptions
  ): Promise<UomConversion[]> {
    let query: Query = this.collection(companyId).where('itemId', '==', itemId).orderBy('fromUom', 'asc');

    if (opts?.active !== undefined) {
      query = query.where('active', '==', opts.active);
    }

    query = this.applyPaging(query, opts);
    const snap = await query.get();
    return snap.docs.map((doc) => UomConversionMapper.toDomain(doc.data()));
  }

  async getCompanyConversions(companyId: string, opts?: UomConversionListOptions): Promise<UomConversion[]> {
    let query: Query = this.collection(companyId).orderBy('itemId', 'asc').orderBy('fromUom', 'asc');

    if (opts?.active !== undefined) {
      query = query.where('active', '==', opts.active);
    }

    query = this.applyPaging(query, opts);
    const snap = await query.get();
    return snap.docs.map((doc) => UomConversionMapper.toDomain(doc.data()));
  }

  async deleteConversion(id: string): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.delete();
  }
}
