

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { IPermissionRegistryRepository } from '../../../../repository/interfaces/super-admin/IPermissionRegistryRepository';
import { PermissionDefinition } from '../../../../domain/super-admin/PermissionDefinition';

export class FirestorePermissionRegistryRepository implements IPermissionRegistryRepository {
  private collection = 'system_metadata';
  private subcollection = 'permissions';

  constructor(private db: admin.firestore.Firestore) {}

  async getAll(): Promise<PermissionDefinition[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').get();
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    } as PermissionDefinition));
  }

  async getById(id: string): Promise<PermissionDefinition | null> {
    const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
    if (!doc.exists) return null;
    return {
      ...doc.data(),
      createdAt: doc.data()!.createdAt?.toDate(),
      updatedAt: doc.data()!.updatedAt?.toDate(),
    } as PermissionDefinition;
  }

  async create(permission: PermissionDefinition): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(permission.id).set({
      id: permission.id,
      name: permission.name,
      description: permission.description,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async update(id: string, permission: Partial<PermissionDefinition>): Promise<void> {
    const updateData: any = { ...permission };
    updateData.updatedAt = FieldValue.serverTimestamp();
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update(updateData);
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).delete();
  }
}
