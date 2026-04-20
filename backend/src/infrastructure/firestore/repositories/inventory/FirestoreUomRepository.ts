import { DocumentReference, Firestore, Query } from 'firebase-admin/firestore';
import { Uom } from '../../../../domain/inventory/entities/Uom';
import { IUomRepository, UomListOptions } from '../../../../repository/interfaces/inventory/IUomRepository';
import { UomMapper } from '../../mappers/InventoryMappers';
import { getInventoryCollection } from './InventoryFirestorePaths';

export class FirestoreUomRepository implements IUomRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getInventoryCollection(this.db, companyId, 'uoms');
  }

  private async resolveRefById(id: string): Promise<DocumentReference | null> {
    const snap = await this.db.collectionGroup('uoms').where('id', '==', id).limit(1).get();
    if (snap.empty) return null;
    return snap.docs[0].ref;
  }

  private applyListOptions(query: Query, opts?: UomListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  async createUom(uom: Uom): Promise<void> {
    await this.collection(uom.companyId).doc(uom.id).set(UomMapper.toPersistence(uom));
  }

  async updateUom(id: string, data: Partial<Uom>): Promise<void> {
    const ref = await this.resolveRefById(id);
    if (!ref) return;
    await ref.update(data as any);
  }

  async getUom(id: string): Promise<Uom | null> {
    const ref = await this.resolveRefById(id);
    if (!ref) return null;
    const snap = await ref.get();
    if (!snap.exists) return null;
    return UomMapper.toDomain(snap.data());
  }

  async getCompanyUoms(companyId: string, opts?: UomListOptions): Promise<Uom[]> {
    let query: Query = this.collection(companyId);

    if (opts?.active !== undefined) {
      query = query.where('active', '==', opts.active);
    }

    query = query.orderBy('code', 'asc');
    query = this.applyListOptions(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => UomMapper.toDomain(doc.data()));
  }

  async getUomByCode(companyId: string, code: string): Promise<Uom | null> {
    const normalizedCode = (code || '').trim().toUpperCase();
    if (!normalizedCode) return null;

    const exact = await this.collection(companyId).where('code', '==', normalizedCode).limit(1).get();
    if (!exact.empty) return UomMapper.toDomain(exact.docs[0].data());

    const all = await this.getCompanyUoms(companyId, { limit: 500 });
    return all.find((entry) => entry.code.toUpperCase() === normalizedCode) || null;
  }
}
