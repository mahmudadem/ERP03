
import * as admin from 'firebase-admin';
import { IPermissionRepository } from '../../../../repository/interfaces/rbac/IPermissionRepository';
import { Permission } from '../../../../domain/rbac/Permission';

export class FirestorePermissionRepository implements IPermissionRepository {
  constructor(private db: admin.firestore.Firestore) {}

  private getCollection() {
    return this.db.collection('system_metadata').doc('permissions').collection('items');
  }

  async getAll(): Promise<Permission[]> {
    const snapshot = await this.getCollection().get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Permission));
  }

  async getById(id: string): Promise<Permission | null> {
    const doc = await this.getCollection().doc(id).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as Permission;
  }

  async create(permission: Permission): Promise<void> {
    await this.getCollection().doc(permission.id).set(permission);
  }

  async update(id: string, permission: Partial<Permission>): Promise<void> {
    await this.getCollection().doc(id).update(permission);
  }

  async delete(id: string): Promise<void> {
    await this.getCollection().doc(id).delete();
  }
}
