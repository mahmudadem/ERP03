import { DocumentReference, Firestore, Query } from 'firebase-admin/firestore';
import { Party } from '../../../../domain/shared/entities/Party';
import {
  IPartyRepository,
  PartyListOptions,
} from '../../../../repository/interfaces/shared/IPartyRepository';
import { PartyMapper } from '../../mappers/SharedMappers';
import { getSharedCollection } from './SharedFirestorePaths';

export class FirestorePartyRepository implements IPartyRepository {
  constructor(private readonly db: Firestore) {}

  private collection(companyId: string) {
    return getSharedCollection(this.db, companyId, 'parties');
  }

  private async resolveRefById(companyId: string, id: string): Promise<DocumentReference | null> {
    const doc = await this.collection(companyId).doc(id).get();
    if (!doc.exists) return null;
    return doc.ref;
  }

  private applyListOptions(query: Query, opts?: PartyListOptions): Query {
    let ref = query;
    if (opts?.offset) ref = ref.offset(opts.offset);
    if (opts?.limit) ref = ref.limit(opts.limit);
    return ref;
  }

  async create(party: Party): Promise<void> {
    await this.collection(party.companyId).doc(party.id).set(PartyMapper.toPersistence(party));
  }

  async update(party: Party): Promise<void> {
    await this.collection(party.companyId).doc(party.id).set(PartyMapper.toPersistence(party), { merge: true });
  }

  async getById(companyId: string, id: string): Promise<Party | null> {
    const ref = await this.resolveRefById(companyId, id);
    if (!ref) return null;
    const doc = await ref.get();
    if (!doc.exists) return null;
    return PartyMapper.toDomain(doc.data());
  }

  async getByCode(companyId: string, code: string): Promise<Party | null> {
    const snap = await this.collection(companyId).where('code', '==', code).limit(1).get();
    if (snap.empty) return null;
    return PartyMapper.toDomain(snap.docs[0].data());
  }

  async list(companyId: string, opts?: PartyListOptions): Promise<Party[]> {
    let query: Query = this.collection(companyId);

    if (opts?.role) query = query.where('roles', 'array-contains', opts.role);
    if (opts?.active !== undefined) query = query.where('active', '==', opts.active);

    query = query.orderBy('displayName', 'asc');
    query = this.applyListOptions(query, opts);

    const snap = await query.get();
    return snap.docs.map((doc) => PartyMapper.toDomain(doc.data()));
  }

  async delete(companyId: string, id: string): Promise<void> {
    const ref = await this.resolveRefById(companyId, id);
    if (!ref) return;
    await ref.delete();
  }
}
