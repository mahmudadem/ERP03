"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreBundleItemRepository = exports.FirestoreCompanyEntitlementRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
const ENTITLEMENTS_COLLECTION = 'company_entitlements';
const ENTITLEMENT_ITEMS_COLLECTION = 'company_entitlement_items';
const BUNDLES_COLLECTION = 'bundle_registries';
const BUNDLE_ITEMS_COLLECTION = 'bundle_items';
class FirestoreCompanyEntitlementRepository {
    constructor(db) {
        this.db = db;
    }
    async getByCompanyId(companyId) {
        const snapshot = await this.db.collection(ENTITLEMENTS_COLLECTION)
            .where('companyId', '==', companyId)
            .get();
        const entitlements = [];
        for (const doc of snapshot.docs) {
            const entitlement = await this.loadEntitlementWithItems(doc);
            if (entitlement)
                entitlements.push(entitlement);
        }
        return entitlements;
    }
    async getActiveByCompanyId(companyId) {
        const now = new Date();
        const snapshot = await this.db.collection(ENTITLEMENTS_COLLECTION)
            .where('companyId', '==', companyId)
            .where('isActive', '==', true)
            .get();
        const entitlements = [];
        for (const doc of snapshot.docs) {
            const data = doc.data();
            if (!data.validUntil || data.validUntil.toDate() >= now) {
                const entitlement = await this.loadEntitlementWithItems(doc);
                if (entitlement)
                    entitlements.push(entitlement);
            }
        }
        return entitlements;
    }
    async getEntitlementById(id) {
        const doc = await this.db.collection(ENTITLEMENTS_COLLECTION).doc(id).get();
        if (!doc.exists)
            return null;
        return this.loadEntitlementWithItems(doc);
    }
    async createEntitlement(entitlement) {
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
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        }));
        for (const item of entitlement.items) {
            const itemRef = this.db.collection(ENTITLEMENT_ITEMS_COLLECTION).doc(item.id);
            batch.set(itemRef, this.withoutUndefined({
                id: item.id,
                entitlementId: entitlement.id,
                itemType: item.itemType,
                itemKey: item.itemKey,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
            }));
        }
        await batch.commit();
    }
    async updateEntitlement(id, updates) {
        const updateData = { updatedAt: firestore_1.FieldValue.serverTimestamp() };
        if (updates.sourceType)
            updateData.sourceType = updates.sourceType;
        if (updates.sourceId)
            updateData.sourceId = updates.sourceId;
        if (updates.validFrom)
            updateData.validFrom = updates.validFrom;
        if (updates.validUntil !== undefined)
            updateData.validUntil = updates.validUntil;
        if (updates.isActive !== undefined)
            updateData.isActive = updates.isActive;
        await this.db.collection(ENTITLEMENTS_COLLECTION).doc(id).update(updateData);
    }
    async deactivateEntitlement(id) {
        await this.db.collection(ENTITLEMENTS_COLLECTION).doc(id).update({
            isActive: false,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    async addItem(entitlementId, item) {
        await this.db.collection(ENTITLEMENT_ITEMS_COLLECTION).doc(item.id).set(this.withoutUndefined({
            id: item.id,
            entitlementId,
            itemType: item.itemType,
            itemKey: item.itemKey,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        }));
    }
    async removeItem(entitlementId, itemKey) {
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
    async getItemsByEntitlementId(entitlementId) {
        const snapshot = await this.db.collection(ENTITLEMENT_ITEMS_COLLECTION)
            .where('entitlementId', '==', entitlementId)
            .get();
        return snapshot.docs.map((doc) => {
            var _a;
            const data = doc.data();
            return {
                id: data.id,
                entitlementId: data.entitlementId,
                itemType: data.itemType,
                itemKey: data.itemKey,
                createdAt: ((_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(),
            };
        });
    }
    async getEffectiveModules(companyId) {
        const entitlements = await this.getActiveByCompanyId(companyId);
        const modules = new Set();
        for (const entitlement of entitlements) {
            for (const item of entitlement.items) {
                if (item.itemType === 'module') {
                    modules.add(item.itemKey);
                }
            }
        }
        return Array.from(modules);
    }
    async getEffectiveCapabilities(companyId) {
        const entitlements = await this.getActiveByCompanyId(companyId);
        const capabilities = new Set();
        for (const entitlement of entitlements) {
            for (const item of entitlement.items) {
                if (item.itemType === 'capability') {
                    capabilities.add(item.itemKey);
                }
            }
        }
        return Array.from(capabilities);
    }
    async hasModule(companyId, moduleId) {
        const modules = await this.getEffectiveModules(companyId);
        return modules.includes(moduleId.toLowerCase());
    }
    async hasCapability(companyId, capabilityId) {
        const capabilities = await this.getEffectiveCapabilities(companyId);
        return capabilities.includes(capabilityId.toLowerCase());
    }
    async loadEntitlementWithItems(doc) {
        var _a, _b, _c, _d;
        const data = doc.data();
        const itemsSnapshot = await this.db.collection(ENTITLEMENT_ITEMS_COLLECTION)
            .where('entitlementId', '==', doc.id)
            .get();
        const items = itemsSnapshot.docs.map((itemDoc) => {
            var _a;
            const itemData = itemDoc.data();
            return {
                id: itemData.id,
                entitlementId: itemData.entitlementId,
                itemType: itemData.itemType,
                itemKey: itemData.itemKey,
                createdAt: ((_a = itemData.createdAt) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(),
            };
        });
        return {
            id: data.id,
            companyId: data.companyId,
            sourceType: data.sourceType,
            sourceId: data.sourceId,
            validFrom: ((_a = data.validFrom) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(),
            validUntil: ((_b = data.validUntil) === null || _b === void 0 ? void 0 : _b.toDate()) || undefined,
            isActive: data.isActive,
            items,
            createdAt: ((_c = data.createdAt) === null || _c === void 0 ? void 0 : _c.toDate()) || new Date(),
            updatedAt: ((_d = data.updatedAt) === null || _d === void 0 ? void 0 : _d.toDate()) || new Date(),
        };
    }
    withoutUndefined(data) {
        return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));
    }
}
exports.FirestoreCompanyEntitlementRepository = FirestoreCompanyEntitlementRepository;
class FirestoreBundleItemRepository {
    constructor(db) {
        this.db = db;
    }
    async getByBundleId(bundleId) {
        const snapshot = await this.db.collection(BUNDLE_ITEMS_COLLECTION)
            .where('bundleId', '==', bundleId)
            .get();
        return snapshot.docs.map((doc) => {
            var _a;
            const data = doc.data();
            return {
                id: data.id,
                bundleId: data.bundleId,
                itemType: data.itemType,
                itemKey: data.itemKey,
                createdAt: ((_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(),
            };
        });
    }
    async getModuleKeysByBundleId(bundleId) {
        const snapshot = await this.db.collection(BUNDLE_ITEMS_COLLECTION)
            .where('bundleId', '==', bundleId)
            .where('itemType', '==', 'module')
            .get();
        return snapshot.docs.map((doc) => doc.data().itemKey);
    }
    async getCapabilityKeysByBundleId(bundleId) {
        const snapshot = await this.db.collection(BUNDLE_ITEMS_COLLECTION)
            .where('bundleId', '==', bundleId)
            .where('itemType', '==', 'capability')
            .get();
        return snapshot.docs.map((doc) => doc.data().itemKey);
    }
    async addItem(bundleId, item) {
        await this.db.collection(BUNDLE_ITEMS_COLLECTION).add({
            bundleId,
            itemType: item.itemType,
            itemKey: item.itemKey,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    async removeItem(bundleId, itemKey) {
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
    async clearItems(bundleId) {
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
exports.FirestoreBundleItemRepository = FirestoreBundleItemRepository;
//# sourceMappingURL=FirestoreCompanyEntitlementRepository.js.map