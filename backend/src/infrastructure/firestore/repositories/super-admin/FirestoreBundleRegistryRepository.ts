

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { IBundleRegistryRepository } from '../../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { BundleDefinition } from '../../../../domain/super-admin/BundleDefinition';

export class FirestoreBundleRegistryRepository implements IBundleRegistryRepository {
  private collection = 'system_metadata';
  private subcollection = 'bundles';

  constructor(private db: admin.firestore.Firestore) {}

  async getAll(): Promise<BundleDefinition[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').get();
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    } as BundleDefinition));
  }

  async getById(id: string): Promise<BundleDefinition | null> {
    const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
    if (!doc.exists) return null;
    return {
      ...doc.data(),
      createdAt: doc.data()!.createdAt?.toDate(),
      updatedAt: doc.data()!.updatedAt?.toDate(),
    } as BundleDefinition;
  }

  async create(bundle: BundleDefinition): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundle.id).set({
      id: bundle.id,
      name: bundle.name,
      description: bundle.description,
      businessDomains: bundle.businessDomains || [],
      modulesIncluded: bundle.modulesIncluded || [],
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async update(id: string, bundle: Partial<BundleDefinition>): Promise<void> {
    const updateData: any = { ...bundle };
    updateData.updatedAt = FieldValue.serverTimestamp();
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update(updateData);
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).delete();
  }
}
