import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { IBundleRegistryRepository } from '../../../../repository/interfaces/super-admin/IBundleRegistryRepository';
import { IBundleItemRepository } from '../../../../repository/interfaces/super-admin/ICompanyEntitlementRepository';
import { BundleItem } from '../../../../domain/super-admin/EntitlementDefinition';
import { BundleLifecycleStatus } from '../../../../domain/super-admin/BundleDefinition';

export class FirestoreBundleRegistryRepository implements IBundleRegistryRepository, IBundleItemRepository {
  private collection = 'system_metadata';
  private subcollection = 'bundles';

  constructor(private db: admin.firestore.Firestore) {}

  async getAll() {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').get();
    return snapshot.docs.map(doc => this.mapToDomain(doc));
  }

  async getById(id: string) {
    const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
    if (!doc.exists) return null;
    return this.mapToDomain(doc);
  }

  async getByCode(code: string) {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
      .where('code', '==', code).limit(1).get();
    if (snapshot.empty) return null;
    return this.mapToDomain(snapshot.docs[0]);
  }

  async getReady() {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
      .where('lifecycleStatus', '==', 'ready').get();
    return snapshot.docs.map(doc => this.mapToDomain(doc));
  }

  async create(bundle: any) {
    const bundleRef = this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundle.id);
    await bundleRef.set({
      id: bundle.id,
      code: bundle.code || bundle.id,
      name: bundle.name,
      description: bundle.description,
      businessDomains: bundle.businessDomains || [],
      modulesIncluded: bundle.modulesIncluded || [],
      lifecycleStatus: bundle.lifecycleStatus || 'draft',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const moduleList = bundle.modulesIncluded || [];
    const capabilityList = bundle.capabilities || [];
    const itemsRef = bundleRef.collection('items');
    const batch = this.db.batch();
    for (const mod of moduleList) {
      const docRef = itemsRef.doc(`mod_${mod}`);
      batch.set(docRef, { itemType: 'module', itemKey: mod, createdAt: FieldValue.serverTimestamp() });
    }
    for (const cap of capabilityList) {
      const docRef = itemsRef.doc(`cap_${cap}`);
      batch.set(docRef, { itemType: 'capability', itemKey: cap, createdAt: FieldValue.serverTimestamp() });
    }
    await batch.commit();
  }

  async update(id: string, bundle: any) {
    const updateData: any = {};
    if (bundle.name !== undefined) updateData.name = bundle.name;
    if (bundle.description !== undefined) updateData.description = bundle.description;
    if (bundle.businessDomains !== undefined) updateData.businessDomains = bundle.businessDomains;
    if (bundle.modulesIncluded !== undefined) updateData.modulesIncluded = bundle.modulesIncluded;
    if (bundle.lifecycleStatus !== undefined) updateData.lifecycleStatus = bundle.lifecycleStatus;
    updateData.updatedAt = FieldValue.serverTimestamp();
    
    const bundleRef = this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id);
    
    if (bundle.modulesIncluded !== undefined || bundle.capabilities !== undefined) {
      const oldItems = await bundleRef.collection('items').get();
      const batch = this.db.batch();
      oldItems.docs.forEach(doc => batch.delete(doc.ref));
      await batch.commit();

      const newItems = bundleRef.collection('items');
      const writeBatch = this.db.batch();
      const moduleList = bundle.modulesIncluded || [];
      const capabilityList = bundle.capabilities || [];
      for (const mod of moduleList) {
        const docRef = newItems.doc(`mod_${mod}`);
        writeBatch.set(docRef, { itemType: 'module', itemKey: mod, createdAt: FieldValue.serverTimestamp() });
      }
      for (const cap of capabilityList) {
        const docRef = newItems.doc(`cap_${cap}`);
        writeBatch.set(docRef, { itemType: 'capability', itemKey: cap, createdAt: FieldValue.serverTimestamp() });
      }
      await writeBatch.commit();
    }
    
    await bundleRef.update(updateData);
  }

  async delete(id: string) {
    const bundleRef = this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id);
    const oldItems = await bundleRef.collection('items').get();
    const batch = this.db.batch();
    oldItems.docs.forEach(doc => batch.delete(doc.ref));
    batch.delete(bundleRef);
    await batch.commit();
  }

  async getByBundleId(bundleId: string): Promise<BundleItem[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundleId)
      .collection('items').get();
    return snapshot.docs.map(doc => ({
      id: doc.id,
      bundleId,
      itemType: doc.data().itemType as 'module' | 'capability',
      itemKey: doc.data().itemKey,
      createdAt: doc.data().createdAt?.toDate() || new Date(),
    }));
  }

  async getModuleKeysByBundleId(bundleId: string): Promise<string[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundleId)
      .collection('items').where('itemType', '==', 'module').get();
    return snapshot.docs.map(doc => doc.data().itemKey);
  }

  async getCapabilityKeysByBundleId(bundleId: string): Promise<string[]> {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundleId)
      .collection('items').where('itemType', '==', 'capability').get();
    return snapshot.docs.map(doc => doc.data().itemKey);
  }

  async addItem(bundleId: string, item: any) {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundleId)
      .collection('items').doc(item.itemKey).set({
        itemType: item.itemType,
        itemKey: item.itemKey,
        createdAt: FieldValue.serverTimestamp(),
      });
  }

  async removeItem(bundleId: string, itemKey: string) {
    await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundleId)
      .collection('items').doc(itemKey).delete();
  }

  async clearItems(bundleId: string) {
    const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundleId)
      .collection('items').get();
    const batch = this.db.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  }

  private mapToDomain(doc: any): any {
    const data = doc.data();
    return {
      id: data.id,
      code: data.code,
      name: data.name,
      description: data.description ?? '',
      businessDomains: data.businessDomains ?? [],
      modulesIncluded: data.modulesIncluded ?? [],
      lifecycleStatus: data.lifecycleStatus as BundleLifecycleStatus || 'draft',
      createdAt: data.createdAt?.toDate(),
      updatedAt: data.updatedAt?.toDate(),
    };
  }
}