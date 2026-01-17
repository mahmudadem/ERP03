
import * as admin from 'firebase-admin';
import { ISystemRoleTemplateRepository } from '../../../../repository/interfaces/rbac/ISystemRoleTemplateRepository';
import { SystemRoleTemplate } from '../../../../domain/rbac/SystemRoleTemplate';

export class FirestoreSystemRoleTemplateRepository implements ISystemRoleTemplateRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private getCollection() {
    return this.db.collection('system_metadata').doc('role_templates').collection('items');
  }

  async getAll(): Promise<SystemRoleTemplate[]> {
    const snapshot = await this.getCollection().get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SystemRoleTemplate));
  }

  async getById(id: string): Promise<SystemRoleTemplate | null> {
    const doc = await this.getCollection().doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as SystemRoleTemplate;
  }

  async create(template: SystemRoleTemplate): Promise<void> {
    await this.getCollection().doc(template.id).set(template);
  }

  async update(id: string, template: Partial<SystemRoleTemplate>): Promise<void> {
    await this.getCollection().doc(id).update(template);
  }

  async delete(id: string): Promise<void> {
    await this.getCollection().doc(id).delete();
  }
}
