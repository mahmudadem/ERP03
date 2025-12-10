

import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { IPlanRegistryRepository } from '../../../../repository/interfaces/super-admin/IPlanRegistryRepository';
import { PlanDefinition } from '../../../../domain/super-admin/PlanDefinition';

export class FirestorePlanRegistryRepository implements IPlanRegistryRepository {
  private collection = 'system_metadata';
  private subcollection = 'plans';

  constructor(private db: admin.firestore.Firestore) {}

  async getAll(): Promise<PlanDefinition[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').get();
    return snapshot.docs.map(doc => ({
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate(),
    } as PlanDefinition));
  }

  async getById(id: string): Promise<PlanDefinition | null> {
    const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
    if (!doc.exists) return null;
    return {
      ...doc.data(),
      createdAt: doc.data()!.createdAt?.toDate(),
      updatedAt: doc.data()!.updatedAt?.toDate(),
    } as PlanDefinition;
  }

  async create(plan: PlanDefinition): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(plan.id).set({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      price: plan.price,
      status: plan.status,
      limits: plan.limits,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async update(id: string, plan: Partial<PlanDefinition>): Promise<void> {
    const updateData: any = { ...plan };
    updateData.updatedAt = FieldValue.serverTimestamp();
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update(updateData);
  }

  async delete(id: string): Promise<void> {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).delete();
  }
}
