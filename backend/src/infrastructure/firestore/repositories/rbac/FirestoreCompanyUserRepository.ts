
import * as admin from 'firebase-admin';
import { ICompanyUserRepository } from '../../../../repository/interfaces/rbac/ICompanyUserRepository';
import { CompanyUser } from '../../../../domain/rbac/CompanyUser';

export class FirestoreCompanyUserRepository implements ICompanyUserRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private getCollection(companyId: string) {
    return this.db.collection('companies').doc(companyId).collection('users');
  }

  async getByUserAndCompany(userId: string, companyId: string): Promise<CompanyUser | null> {
    const doc = await this.getCollection(companyId).doc(userId).get();
    if (!doc.exists) return null;
    return doc.data() as CompanyUser;
  }

  async getByCompany(companyId: string): Promise<CompanyUser[]> {
    const snapshot = await this.getCollection(companyId).get();
    return snapshot.docs.map(doc => doc.data() as CompanyUser);
  }

  async assignRole(companyUser: CompanyUser): Promise<void> {
    await this.getCollection(companyUser.companyId).doc(companyUser.userId).set(companyUser, { merge: true });
  }

  async removeRole(userId: string, companyId: string): Promise<void> {
    // Removing role might mean setting roleId to null or deleting the record?
    // The interface says removeRole. But CompanyUser usually implies membership.
    // If we remove role, maybe we set it to a default or empty?
    // For now, let's assume we update it.
    // But wait, CompanyUser structure has roleId as string.
    // If we remove it, maybe we delete the user from company? Or just clear role?
    // The prompt says "Assign users to roles".
    // I'll assume removeRole means unassigning, maybe setting to empty string or null if type allowed.
    // But type is string.
    // I'll implement it as update with empty role or similar, or maybe I won't implement it if not strictly required by use cases.
    // Use cases: AssignRoleToCompanyUserUseCase. No RemoveRoleUseCase.
    // But interface has it.
    // I'll just update it to empty string for now.
    await this.getCollection(companyId).doc(userId).update({ roleId: admin.firestore.FieldValue.delete() });
  }
}
