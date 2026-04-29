"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreBundleRegistryRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
class FirestoreBundleRegistryRepository {
    constructor(db) {
        this.db = db;
        this.collection = 'system_metadata';
        this.subcollection = 'bundles';
    }
    async getAll() {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').get();
        return snapshot.docs.map(doc => this.mapToDomain(doc));
    }
    async getById(id) {
        const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
        if (!doc.exists)
            return null;
        return this.mapToDomain(doc);
    }
    async getByCode(code) {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
            .where('code', '==', code).limit(1).get();
        if (snapshot.empty)
            return null;
        return this.mapToDomain(snapshot.docs[0]);
    }
    async getReady() {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
            .where('lifecycleStatus', '==', 'ready').get();
        return snapshot.docs.map(doc => this.mapToDomain(doc));
    }
    async create(bundle) {
        const bundleRef = this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundle.id);
        await bundleRef.set({
            id: bundle.id,
            code: bundle.code || bundle.id,
            name: bundle.name,
            description: bundle.description,
            businessDomains: bundle.businessDomains || [],
            modulesIncluded: bundle.modulesIncluded || [],
            lifecycleStatus: bundle.lifecycleStatus || 'draft',
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        const moduleList = bundle.modulesIncluded || [];
        const capabilityList = bundle.capabilities || [];
        const itemsRef = bundleRef.collection('items');
        const batch = this.db.batch();
        for (const mod of moduleList) {
            const docRef = itemsRef.doc(`mod_${mod}`);
            batch.set(docRef, { itemType: 'module', itemKey: mod, createdAt: firestore_1.FieldValue.serverTimestamp() });
        }
        for (const cap of capabilityList) {
            const docRef = itemsRef.doc(`cap_${cap}`);
            batch.set(docRef, { itemType: 'capability', itemKey: cap, createdAt: firestore_1.FieldValue.serverTimestamp() });
        }
        await batch.commit();
    }
    async update(id, bundle) {
        const updateData = {};
        if (bundle.name !== undefined)
            updateData.name = bundle.name;
        if (bundle.description !== undefined)
            updateData.description = bundle.description;
        if (bundle.businessDomains !== undefined)
            updateData.businessDomains = bundle.businessDomains;
        if (bundle.modulesIncluded !== undefined)
            updateData.modulesIncluded = bundle.modulesIncluded;
        if (bundle.lifecycleStatus !== undefined)
            updateData.lifecycleStatus = bundle.lifecycleStatus;
        updateData.updatedAt = firestore_1.FieldValue.serverTimestamp();
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
                writeBatch.set(docRef, { itemType: 'module', itemKey: mod, createdAt: firestore_1.FieldValue.serverTimestamp() });
            }
            for (const cap of capabilityList) {
                const docRef = newItems.doc(`cap_${cap}`);
                writeBatch.set(docRef, { itemType: 'capability', itemKey: cap, createdAt: firestore_1.FieldValue.serverTimestamp() });
            }
            await writeBatch.commit();
        }
        await bundleRef.update(updateData);
    }
    async delete(id) {
        const bundleRef = this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id);
        const oldItems = await bundleRef.collection('items').get();
        const batch = this.db.batch();
        oldItems.docs.forEach(doc => batch.delete(doc.ref));
        batch.delete(bundleRef);
        await batch.commit();
    }
    async getByBundleId(bundleId) {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundleId)
            .collection('items').get();
        return snapshot.docs.map(doc => {
            var _a;
            return ({
                id: doc.id,
                bundleId,
                itemType: doc.data().itemType,
                itemKey: doc.data().itemKey,
                createdAt: ((_a = doc.data().createdAt) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(),
            });
        });
    }
    async getModuleKeysByBundleId(bundleId) {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundleId)
            .collection('items').where('itemType', '==', 'module').get();
        return snapshot.docs.map(doc => doc.data().itemKey);
    }
    async getCapabilityKeysByBundleId(bundleId) {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundleId)
            .collection('items').where('itemType', '==', 'capability').get();
        return snapshot.docs.map(doc => doc.data().itemKey);
    }
    async addItem(bundleId, item) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundleId)
            .collection('items').doc(item.itemKey).set({
            itemType: item.itemType,
            itemKey: item.itemKey,
            createdAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    async removeItem(bundleId, itemKey) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundleId)
            .collection('items').doc(itemKey).delete();
    }
    async clearItems(bundleId) {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundleId)
            .collection('items').get();
        const batch = this.db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
    }
    mapToDomain(doc) {
        var _a, _b, _c, _d, _e;
        const data = doc.data();
        return {
            id: data.id,
            code: data.code,
            name: data.name,
            description: (_a = data.description) !== null && _a !== void 0 ? _a : '',
            businessDomains: (_b = data.businessDomains) !== null && _b !== void 0 ? _b : [],
            modulesIncluded: (_c = data.modulesIncluded) !== null && _c !== void 0 ? _c : [],
            lifecycleStatus: data.lifecycleStatus || 'draft',
            createdAt: (_d = data.createdAt) === null || _d === void 0 ? void 0 : _d.toDate(),
            updatedAt: (_e = data.updatedAt) === null || _e === void 0 ? void 0 : _e.toDate(),
        };
    }
}
exports.FirestoreBundleRegistryRepository = FirestoreBundleRegistryRepository;
//# sourceMappingURL=FirestoreBundleRegistryRepository.js.map