
import * as admin from 'firebase-admin';
import { ICompanyUserRepository } from '../../../../repository/interfaces/rbac/ICompanyUserRepository';
import { CompanyUser } from '../../../../domain/rbac/CompanyUser';

export class FirestoreCompanyUserRepository implements ICompanyUserRepository {
  constructor(private db: admin.firestore.Firestore) { }

  private getCollection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('users');
  }

  async getByUserAndCompany(userId: string, companyId: string): Promise<CompanyUser | null> {
    const doc = await this.getCollection(companyId).doc(userId).get();
    if (!doc.exists) return null;
    return doc.data() as CompanyUser;
  }

  async get(companyId: string, userId: string): Promise<CompanyUser | null> {
    const doc = await this.getCollection(companyId).doc(userId).get();
    if (!doc.exists) return null;
    return doc.data() as CompanyUser;
  }

  async getByCompany(companyId: string): Promise<CompanyUser[]> {
    const snapshot = await this.getCollection(companyId).get();
    return snapshot.docs.map(doc => doc.data() as CompanyUser);
  }

  async getByRole(companyId: string, roleId: string): Promise<CompanyUser[]> {
    const snapshot = await this.getCollection(companyId).where('roleId', '==', roleId).get();
    return snapshot.docs.map(doc => doc.data() as CompanyUser);
  }

  async assignRole(companyUser: CompanyUser): Promise<void> {
    await this.getCollection(companyUser.companyId).doc(companyUser.userId).set(companyUser, { merge: true });
  }

  async create(companyUser: CompanyUser): Promise<void> {
    await this.getCollection(companyUser.companyId).doc(companyUser.userId).set(companyUser);
  }

  async update(userId: string, companyId: string, updates: Partial<CompanyUser>): Promise<void> {
    await this.getCollection(companyId).doc(userId).update(updates as any);
  }

  async removeRole(userId: string, companyId: string): Promise<void> {
    await this.getCollection(companyId).doc(userId).update({ roleId: admin.firestore.FieldValue.delete() });
  }
}
