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
        return snapshot.docs.map(doc => {
            var _a, _b;
            return (Object.assign(Object.assign({}, doc.data()), { createdAt: (_a = doc.data().createdAt) === null || _a === void 0 ? void 0 : _a.toDate(), updatedAt: (_b = doc.data().updatedAt) === null || _b === void 0 ? void 0 : _b.toDate() }));
        });
    }
    async getById(id) {
        var _a, _b;
        const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
        if (!doc.exists)
            return null;
        return Object.assign(Object.assign({}, doc.data()), { createdAt: (_a = doc.data().createdAt) === null || _a === void 0 ? void 0 : _a.toDate(), updatedAt: (_b = doc.data().updatedAt) === null || _b === void 0 ? void 0 : _b.toDate() });
    }
    async create(bundle) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(bundle.id).set({
            id: bundle.id,
            name: bundle.name,
            description: bundle.description,
            businessDomains: bundle.businessDomains || [],
            modulesIncluded: bundle.modulesIncluded || [],
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    async update(id, bundle) {
        const updateData = Object.assign({}, bundle);
        updateData.updatedAt = firestore_1.FieldValue.serverTimestamp();
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update(updateData);
    }
    async delete(id) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).delete();
    }
}
exports.FirestoreBundleRegistryRepository = FirestoreBundleRegistryRepository;
//# sourceMappingURL=FirestoreBundleRegistryRepository.js.map