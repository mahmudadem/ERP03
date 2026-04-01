import { DocumentReference, Firestore, Query } from 'firebase-admin/firestore';
import { TaxCode } from '../../../../domain/shared/entities/TaxCode';
import {
  ITaxCodeRepository,
  TaxCodeListOptions,
} from '../../../../repository/interfaces/shared/ITaxCodeRepository';
import { TaxCodeMapper } from '../../mappers/SharedMappers';
import { getSharedCollection } from './SharedFirestorePaths';

export class FirestoreTaxCodeRepository implements ITaxCodeRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSharedCollection(this.db, companyId, 'tax_codes');
  }

  private async resolveRefById(companyId: string, id: string): Promise<DocumentReference | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return doc.ref;
  }

  private applyListOptions(query: Query, opts?: TaxCodeListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  async create(taxCode: TaxCode): Promise<void> {
    await this.collection(taxCode.companyId).doc(taxCode.id).set(TaxCodeMapper.toPersistence(taxCode));
  }

  async update(taxCode: TaxCode): Promise<void> {
    await this.collection(taxCode.companyId).doc(taxCode.id).set(TaxCodeMapper.toPersistence(taxCode), { merge: true });
  }

  async getById(companyId: string, id: string): Promise<TaxCode | null> {
    const ref = await this.resolveRefById(companyId, id);
    if (!ref) return null;
    const doc = await ref.get();
    if (!doc.exists) return null;
    return TaxCodeMapper.toDomain(doc.data());
  }

  async getByCode(companyId: string, code: string): Promise<TaxCode | null> {
    const snap = await this.collection(companyId).where('code', '==', code).limit(1).get();
    if (snap.empty) return null;
    return TaxCodeMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts?: TaxCodeListOptions): Promise<TaxCode[]> {
    let query: Query = this.collection(companyId);

    if (opts?.scope) query = query.where('scope', '==', opts.scope);
    if (opts?.active !== undefined) query = query.where('active', '==', opts.active);

    query = query.orderBy('code', 'asc');
    query = this.applyListOptions(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => TaxCodeMapper.toDomain(doc.data()));
  }
}
