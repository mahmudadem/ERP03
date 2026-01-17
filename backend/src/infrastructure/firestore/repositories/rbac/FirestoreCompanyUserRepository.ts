
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

  async getMembershipsByUser(userId: string): Promise<Array<CompanyUser & { companyId: string }>> {
    console.log(`[RBAC Repo] getMembershipsByUser: Querying collectionGroup('users') for userId=${userId}`);
    try {
      const snapshot = await this.db.collectionGroup('users').where('userId', '==', userId).get();
      console.log(`[RBAC Repo] Found ${snapshot.size} memberships for user ${userId}.`);
      
      return snapshot.docs.map((doc) => {
        const data = doc.data() as CompanyUser;
        const companyId = doc.ref.parent.parent?.id || '';
        // console.log(`[RBAC Repo] Found membership in company: ${companyId} (Role: ${data.roleId})`);
        return { ...data, companyId };
      });
    } catch (err: any) {
      console.error(`[RBAC Repo] Error querying collectionGroup('users'):`, err);
      // Fallback or rethrow?
      // Check if error is 'Requires an index'
      if (err.message && err.message.includes('requires an index')) {
         console.error(`[RBAC Repo] MISSING INDEX on collectionGroup 'users' for field 'userId'. Please create it in Firebase Console.`);
      }
      return [];
    }
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

  async delete(companyId: string, userId: string): Promise<void> {
    await this.getCollection(companyId).doc(userId).delete();
  }
}
