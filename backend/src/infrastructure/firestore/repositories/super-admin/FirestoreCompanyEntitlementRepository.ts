/**
 * Firestore Company Entitlement Repository
 */
import * as admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { ICompanyEntitlementRepository, IBundleItemRepository } from '../../../../repository/interfaces/super-admin/ICompanyEntitlementRepository';
import { CompanyEntitlement, CompanyEntitlementItem, BundleDefinition, BundleItem } from '../../../../domain/super-admin/EntitlementDefinition';

const ENTITLEMENTS_COLLECTION = 'company_entitlements';
const ENTITLEMENT_ITEMS_COLLECTION = 'company_entitlement_items';
const BUNDLES_COLLECTION = 'bundle_registries';
const BUNDLE_ITEMS_COLLECTION = 'bundle_items';

export class FirestoreCompanyEntitlementRepository implements ICompanyEntitlementRepository {
  constructor(private db: admin.firestore.Firestore) {}

  async getByCompanyId(companyId: string): Promise<CompanyEntitlement[]> {
    const snapshot = await this.db.collection(ENTITLEMENTS_COLLECTION)
      .where('companyId', '==', companyId)
      .get();
    const entitlements: CompanyEntitlement[] = [];
    for (const doc of snapshot.docs) {
      const entitlement = await this.loadEntitlementWithItems(doc);
      if (entitlement) entitlements.push(entitlement);
    }
    return entitlements;
  }

  async getActiveByCompanyId(companyId: string): Promise<CompanyEntitlement[]> {
    const now = new Date();
    const snapshot = await this.db.collection(ENTITLEMENTS_COLLECTION)
      .where('companyId', '==', companyId)
      .where('isActive', '==', true)
      .get();
    const entitlements: CompanyEntitlement[] = [];
    for (const doc of snapshot.docs) {
      const data = doc.data();
      if (!data.validUntil || data.validUntil.toDate() >= now) {
        const entitlement = await this.loadEntitlementWithItems(doc);
        if (entitlement) entitlements.push(entitlement);
      }
    }
    return entitlements;
  }

  async getEntitlementById(id: string): Promise<CompanyEntitlement | null> {
    const doc = await this.db.collection(ENTITLEMENTS_COLLECTION).doc(id).get();
    if (!doc.exists) return null;
    return this.loadEntitlementWithItems(doc);
  }

  async createEntitlement(entitlement: CompanyEntitlement): Promise<void> {
    const batch = this.db.batch();
    const entRef = this.db.collection(ENTITLEMENTS_COLLECTION).doc(entitlement.id);
    batch.set(entRef, this.withoutUndefined({
      id: entitlement.id,
      companyId: entitlement.companyId,
      sourceType: entitlement.sourceType,
      sourceId: entitlement.sourceId,
      validFrom: entitlement.validFrom,
      validUntil: entitlement.validUntil,
      isActive: entitlement.isActive,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }));
    for (const item of entitlement.items) {
      const itemRef = this.db.collection(ENTITLEMENT_ITEMS_COLLECTION).doc(item.id);
      batch.set(itemRef, this.withoutUndefined({
        id: item.id,
        entitlementId: entitlement.id,
        itemType: item.itemType,
        itemKey: item.itemKey,
        createdAt: FieldValue.serverTimestamp(),
      }));
    }
    await batch.commit();
  }

  async updateEntitlement(id: string, updates: Partial<CompanyEntitlement>): Promise<void> {
    const updateData: any = { updatedAt: FieldValue.serverTimestamp() };
    if (updates.sourceType) updateData.sourceType = updates.sourceType;
    if (updates.sourceId) updateData.sourceId = updates.sourceId;
    if (updates.validFrom) updateData.validFrom = updates.validFrom;
    if (updates.validUntil !== undefined) updateData.validUntil = updates.validUntil;
    if (updates.isActive !== undefined) updateData.isActive = updates.isActive;
    await this.db.collection(ENTITLEMENTS_COLLECTION).doc(id).update(updateData);
  }

  async deactivateEntitlement(id: string): Promise<void> {
    await this.db.collection(ENTITLEMENTS_COLLECTION).doc(id).update({
      isActive: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  async addItem(entitlementId: string, item: CompanyEntitlementItem): Promise<void> {
    await this.db.collection(ENTITLEMENT_ITEMS_COLLECTION).doc(item.id).set(this.withoutUndefined({
      id: item.id,
      entitlementId,
      itemType: item.itemType,
      itemKey: item.itemKey,
      createdAt: FieldValue.serverTimestamp(),
    }));
  }

  async removeItem(entitlementId: string, itemKey: string): Promise<void> {
    const snapshot = await this.db.collection(ENTITLEMENT_ITEMS_COLLECTION)
      .where('entitlementId', '==', entitlementId)
      .where('itemKey', '==', itemKey)
      .get();
    const batch = this.db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  async getItemsByEntitlementId(entitlementId: string): Promise<CompanyEntitlementItem[]> {
    const snapshot = await this.db.collection(ENTITLEMENT_ITEMS_COLLECTION)
      .where('entitlementId', '==', entitlementId)
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id,
        entitlementId: data.entitlementId,
        itemType: data.itemType,
        itemKey: data.itemKey,
        createdAt: data.createdAt?.toDate() || new Date(),
      };
    });
  }

  async getEffectiveModules(companyId: string): Promise<string[]> {
    const entitlements = await this.getActiveByCompanyId(companyId);
    const modules = new Set<string>();
    for (const entitlement of entitlements) {
      for (const item of entitlement.items) {
        if (item.itemType === 'module') {
          modules.add(item.itemKey);
        }
      }
    }
    return Array.from(modules);
  }

  async getEffectiveCapabilities(companyId: string): Promise<string[]> {
    const entitlements = await this.getActiveByCompanyId(companyId);
    const capabilities = new Set<string>();
    for (const entitlement of entitlements) {
      for (const item of entitlement.items) {
        if (item.itemType === 'capability') {
          capabilities.add(item.itemKey);
        }
      }
    }
    return Array.from(capabilities);
  }

  async hasModule(companyId: string, moduleId: string): Promise<boolean> {
    const modules = await this.getEffectiveModules(companyId);
    return modules.includes(moduleId.toLowerCase());
  }

  async hasCapability(companyId: string, capabilityId: string): Promise<boolean> {
    const capabilities = await this.getEffectiveCapabilities(companyId);
    return capabilities.includes(capabilityId.toLowerCase());
  }

  private async loadEntitlementWithItems(doc: admin.firestore.DocumentSnapshot): Promise<CompanyEntitlement | null> {
    const data = doc.data()!;
    const itemsSnapshot = await this.db.collection(ENTITLEMENT_ITEMS_COLLECTION)
      .where('entitlementId', '==', doc.id)
      .get();
    const items: CompanyEntitlementItem[] = itemsSnapshot.docs.map((itemDoc) => {
      const itemData = itemDoc.data();
      return {
        id: itemData.id,
        entitlementId: itemData.entitlementId,
        itemType: itemData.itemType,
        itemKey: itemData.itemKey,
        createdAt: itemData.createdAt?.toDate() || new Date(),
      };
    });
    return {
      id: data.id,
      companyId: data.companyId,
      sourceType: data.sourceType,
      sourceId: data.sourceId,
      validFrom: data.validFrom?.toDate() || new Date(),
      validUntil: data.validUntil?.toDate() || undefined,
      isActive: data.isActive,
      items,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    };
  }

  private withoutUndefined<T extends Record<string, unknown>>(data: T): T {
    return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as T;
  }
}

export class FirestoreBundleItemRepository implements IBundleItemRepository {
  constructor(private db: admin.firestore.Firestore) {}

  async getByBundleId(bundleId: string): Promise<BundleItem[]> {
    const snapshot = await this.db.collection(BUNDLE_ITEMS_COLLECTION)
      .where('bundleId', '==', bundleId)
      .get();
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: data.id,
        bundleId: data.bundleId,
        itemType: data.itemType,
        itemKey: data.itemKey,
        createdAt: data.createdAt?.toDate() || new Date(),
      };
    });
  }

  async getModuleKeysByBundleId(bundleId: string): Promise<string[]> {
    const snapshot = await this.db.collection(BUNDLE_ITEMS_COLLECTION)
      .where('bundleId', '==', bundleId)
      .where('itemType', '==', 'module')
      .get();
    return snapshot.docs.map((doc) => doc.data().itemKey);
  }

  async getCapabilityKeysByBundleId(bundleId: string): Promise<string[]> {
    const snapshot = await this.db.collection(BUNDLE_ITEMS_COLLECTION)
      .where('bundleId', '==', bundleId)
      .where('itemType', '==', 'capability')
      .get();
    return snapshot.docs.map((doc) => doc.data().itemKey);
  }

  async addItem(bundleId: string, item: Omit<BundleItem, 'id' | 'bundleId' | 'createdAt'>): Promise<void> {
    await this.db.collection(BUNDLE_ITEMS_COLLECTION).add({
      bundleId,
      itemType: item.itemType,
      itemKey: item.itemKey,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  async removeItem(bundleId: string, itemKey: string): Promise<void> {
    const snapshot = await this.db.collection(BUNDLE_ITEMS_COLLECTION)
      .where('bundleId', '==', bundleId)
      .where('itemKey', '==', itemKey)
      .get();
    const batch = this.db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  async clearItems(bundleId: string): Promise<void> {
    const snapshot = await this.db.collection(BUNDLE_ITEMS_COLLECTION)
      .where('bundleId', '==', bundleId)
      .get();
    const batch = this.db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }
}
