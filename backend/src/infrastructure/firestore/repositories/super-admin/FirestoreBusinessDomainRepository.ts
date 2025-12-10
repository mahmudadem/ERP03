

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { IBusinessDomainRepository } from '../../../../repository/interfaces/super-admin/IBusinessDomainRepository';
import { BusinessDomainDefinition } from '../../../../domain/super-admin/BusinessDomainDefinition';

export class FirestoreBusinessDomainRepository implements IBusinessDomainRepository {
  private collection = 'system_metadata';
  private subcollection = 'business_domains';

  constructor(private db: admin.firestore.Firestore) {}

  async getAll(): Promise<BusinessDomainDefinition[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').get();
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    } as BusinessDomainDefinition));
  }

  async getById(id: string): Promise<BusinessDomainDefinition | null> {
    const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
    if (!doc.exists) return null;
    return {
      ...doc.data(),
      createdAt: doc.data()!.createdAt?.toDate(),
      updatedAt: doc.data()!.updatedAt?.toDate(),
    } as BusinessDomainDefinition;
  }

  async create(domain: BusinessDomainDefinition): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(domain.id).set({
      id: domain.id,
      name: domain.name,
      description: domain.description,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async update(id: string, domain: Partial<BusinessDomainDefinition>): Promise<void> {
    const updateData: any = { ...domain };
    updateData.updatedAt = FieldValue.serverTimestamp();
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update(updateData);
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).delete();
  }
}
