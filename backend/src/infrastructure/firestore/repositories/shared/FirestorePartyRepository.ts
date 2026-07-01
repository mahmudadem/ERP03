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

  private applyInMemoryListOptions(parties: Party[], opts?: PartyListOptions): Party[] {
    const sorted = [...parties].sort((a, b) => {
      const displayNameCompare = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: 'base' });
      if (displayNameCompare !== 0) return displayNameCompare;
      return a.code.localeCompare(b.code, undefined, { sensitivity: 'base' });
    });

    const offset = opts?.offset && Number.isFinite(opts.offset) && opts.offset > 0 ? opts.offset : 0;
    const limit = opts?.limit && Number.isFinite(opts.limit) && opts.limit > 0 ? opts.limit : undefined;
    return limit ? sorted.slice(offset, offset + limit) : sorted.slice(offset);
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

    // Avoid Firestore composite-index requirements for role/active/displayName combinations.
    // For party master lists, one indexed server-side filter plus in-memory final shaping is acceptable.
    const filterActiveInMemory = !!opts?.role && opts.active !== undefined;
    if (opts?.role) {
      query = query.where('roles', 'array-contains', opts.role);
    } else if (opts?.active !== undefined) {
      query = query.where('active', '==', opts.active);
    }

    const snap = await query.get();
    const parties = snap.docs
      .map((doc) => PartyMapper.toDomain(doc.data()))
      .filter((party) => !filterActiveInMemory || party.active === opts?.active);

    return this.applyInMemoryListOptions(parties, opts);
  }

  async delete(companyId: string, id: string): Promise<void> {
    const ref = await this.resolveRefById(companyId, id);
    if (!ref) return;
    await ref.delete();
  }
}
