

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { IModuleRegistryRepository } from '../../../../repository/interfaces/super-admin/IModuleRegistryRepository';
import { ModuleDefinition } from '../../../../domain/super-admin/ModuleDefinition';

export class FirestoreModuleRegistryRepository implements IModuleRegistryRepository {
  private collection = 'system_metadata';
  private subcollection = 'modules';

  constructor(private db: admin.firestore.Firestore) {}

  async getAll(): Promise<ModuleDefinition[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').get();
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    } as ModuleDefinition));
  }

  async getById(id: string): Promise<ModuleDefinition | null> {
    const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
    if (!doc.exists) return null;
    return {
      ...doc.data(),
      createdAt: doc.data()!.createdAt?.toDate(),
      updatedAt: doc.data()!.updatedAt?.toDate(),
    } as ModuleDefinition;
  }

  async create(module: ModuleDefinition): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(module.id).set({
      id: module.id,
      name: module.name,
      description: module.description,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async update(id: string, module: Partial<ModuleDefinition>): Promise<void> {
    const updateData: any = { ...module };
    updateData.updatedAt = FieldValue.serverTimestamp();
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update(updateData);
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).delete();
  }
}
