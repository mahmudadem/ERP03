"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreRoleTemplateRegistryRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
class FirestoreRoleTemplateRegistryRepository {
    constructor(db) {
        this.db = db;
        this.collection = 'system_metadata';
        this.subcollection = 'role_templates';
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
    async create(roleTemplate) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(roleTemplate.id).set({
            id: roleTemplate.id,
            name: roleTemplate.name,
            description: roleTemplate.description,
            permissions: roleTemplate.permissions || [],
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
    }
    async update(id, roleTemplate) {
        const updateData = Object.assign({}, roleTemplate);
        updateData.updatedAt = firestore_1.FieldValue.serverTimestamp();
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update(updateData);
    }
    async delete(id) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).delete();
    }
}
exports.FirestoreRoleTemplateRegistryRepository = FirestoreRoleTemplateRegistryRepository;
//# sourceMappingURL=FirestoreRoleTemplateRegistryRepository.js.map