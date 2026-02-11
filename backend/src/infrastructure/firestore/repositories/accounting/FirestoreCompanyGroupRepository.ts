import * as admin from 'firebase-admin';
import { CompanyGroup } from '../../../../domain/accounting/entities/CompanyGroup';
import { ICompanyGroupRepository } from '../../../../repository/interfaces/accounting/ICompanyGroupRepository';
import { InfrastructureError } from '../../../errors/InfrastructureError';

const toTimestamp = (d: Date) => admin.firestore.Timestamp.fromDate(d);

export class FirestoreCompanyGroupRepository implements ICompanyGroupRepository {
  constructor(private readonly db: admin.firestore.Firestore) {}

  private col() {
    return this.db.collection('companyGroups');
  }

  async create(group: CompanyGroup): Promise<CompanyGroup> {
    try {
      await this.col().doc(group.id).set(this.toPersistence(group));
      return group;
    } catch (error) {
      throw new InfrastructureError('Failed to create company group', error);
    }
  }

  async update(group: CompanyGroup): Promise<CompanyGroup> {
    try {
      await this.col().doc(group.id).set(this.toPersistence(group), { merge: true });
      return group;
    } catch (error) {
      throw new InfrastructureError('Failed to update company group', error);
    }
  }

  async list(companyId: string): Promise<CompanyGroup[]> {
    try {
      const snap = await this.col().where('memberIds', 'array-contains', companyId).get();
      return snap.docs.map((d) => this.toDomain(d.id, d.data() as any));
    } catch (error) {
      throw new InfrastructureError('Failed to list company groups', error);
    }
  }

  async findById(id: string): Promise<CompanyGroup | null> {
    try {
      const doc = await this.col().doc(id).get();
      if (!doc.exists) return null;
      return this.toDomain(doc.id, doc.data() as any);
    } catch (error) {
      throw new InfrastructureError('Failed to find company group', error);
    }
  }

  private toPersistence(g: CompanyGroup) {
    return {
      name: g.name,
      reportingCurrency: g.reportingCurrency,
      members: g.members,
      memberIds: g.members.map((m) => m.companyId),
      createdAt: toTimestamp(g.createdAt),
      createdBy: g.createdBy
    };
  }

  private toDomain(id: string, data: any): CompanyGroup {
    return new CompanyGroup(
      id,
      data.name,
      data.reportingCurrency,
      data.members || [],
      data.createdAt?.toDate?.() || new Date(),
      data.createdBy || ''
    );
  }
}
