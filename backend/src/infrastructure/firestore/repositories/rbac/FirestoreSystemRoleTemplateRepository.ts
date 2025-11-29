
import * as admin from 'firebase-admin';
import { ISystemRoleTemplateRepository } from '../../../../repository/interfaces/rbac/ISystemRoleTemplateRepository';
import { SystemRoleTemplate } from '../../../../domain/rbac/SystemRoleTemplate';

export class FirestoreSystemRoleTemplateRepository implements ISystemRoleTemplateRepository {
  private collection = 'system_role_templates';

  constructor(private db: admin.firestore.Firestore) {}

  async getAll(): Promise<SystemRoleTemplate[]> {
    const snapshot = await this.db.collection(this.collection).get();
    return snapshot.docs.map(doc => doc.data() as SystemRoleTemplate);
  }

  async getById(id: string): Promise<SystemRoleTemplate | null> {
    const doc = await this.db.collection(this.collection).doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as SystemRoleTemplate;
  }

  async create(template: SystemRoleTemplate): Promise<void> {
    await this.db.collection(this.collection).doc(template.id).set(template);
  }

  async update(id: string, template: Partial<SystemRoleTemplate>): Promise<void> {
    await this.db.collection(this.collection).doc(id).update(template);
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(this.collection).doc(id).delete();
  }
}
