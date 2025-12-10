
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { IRoleTemplateRegistryRepository } from '../../../../repository/interfaces/super-admin/IRoleTemplateRegistryRepository';
import { RoleTemplateDefinition } from '../../../../domain/super-admin/RoleTemplateDefinition';

export class FirestoreRoleTemplateRegistryRepository implements IRoleTemplateRegistryRepository {
  private collection = 'system_metadata';
  private subcollection = 'role_templates';

  constructor(private db: admin.firestore.Firestore) {}

  async getAll(): Promise<RoleTemplateDefinition[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').get();
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    } as RoleTemplateDefinition));
  }

  async getById(id: string): Promise<RoleTemplateDefinition | null> {
    const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
    if (!doc.exists) return null;
    return {
      ...doc.data(),
      createdAt: doc.data()!.createdAt?.toDate(),
      updatedAt: doc.data()!.updatedAt?.toDate(),
    } as RoleTemplateDefinition;
  }

  async create(roleTemplate: RoleTemplateDefinition): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(roleTemplate.id).set({
      id: roleTemplate.id,
      name: roleTemplate.name,
      description: roleTemplate.description,
      permissions: roleTemplate.permissions || [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async update(id: string, roleTemplate: Partial<RoleTemplateDefinition>): Promise<void> {
    const updateData: any = { ...roleTemplate };
    updateData.updatedAt = FieldValue.serverTimestamp();
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update(updateData);
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).delete();
  }
}
