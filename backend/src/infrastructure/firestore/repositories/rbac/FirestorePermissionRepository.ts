
import * as admin from 'firebase-admin';
import { IPermissionRepository } from '../../../../repository/interfaces/rbac/IPermissionRepository';
import { Permission } from '../../../../domain/rbac/Permission';

export class FirestorePermissionRepository implements IPermissionRepository {
  private collection = 'permissions';

  constructor(private db: admin.firestore.Firestore) {}

  async getAll(): Promise<Permission[]> {
    const snapshot = await this.db.collection(this.collection).get();
    return snapshot.docs.map(doc => doc.data() as Permission);
  }

  async getById(id: string): Promise<Permission | null> {
    const doc = await this.db.collection(this.collection).doc(id).get();
    if (!doc.exists) return null;
    return doc.data() as Permission;
  }

  async create(permission: Permission): Promise<void> {
    await this.db.collection(this.collection).doc(permission.id).set(permission);
  }

  async update(id: string, permission: Partial<Permission>): Promise<void> {
    await this.db.collection(this.collection).doc(id).update(permission);
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(this.collection).doc(id).delete();
  }
}
