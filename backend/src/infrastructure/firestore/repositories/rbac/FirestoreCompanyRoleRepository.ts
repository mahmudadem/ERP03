
import * as admin from 'firebase-admin';
import { ICompanyRoleRepository } from '../../../../repository/interfaces/rbac/ICompanyRoleRepository';
import { CompanyRole } from '../../../../domain/rbac/CompanyRole';

export class FirestoreCompanyRoleRepository implements ICompanyRoleRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private getCollection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('roles');
  }

  async getAll(companyId: string): Promise<CompanyRole[]> {
    const snapshot = await this.getCollection(companyId).get();
    return snapshot.docs.map(doc => doc.data() as CompanyRole);
  }

  async getById(companyId: string, roleId: string): Promise<CompanyRole | null> {
    const doc = await this.getCollection(companyId).doc(roleId).get();
    if (!doc.exists) return null;
    return doc.data() as CompanyRole;
  }

  async create(role: CompanyRole): Promise<void> {
    await this.getCollection(role.companyId).doc(role.id).set(role);
  }

  async update(companyId: string, roleId: string, role: Partial<CompanyRole>): Promise<void> {
    await this.getCollection(companyId).doc(roleId).update(role);
  }

  async delete(companyId: string, roleId: string): Promise<void> {
    await this.getCollection(companyId).doc(roleId).delete();
  }
}
