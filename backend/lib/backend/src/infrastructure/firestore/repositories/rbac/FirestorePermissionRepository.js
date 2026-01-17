"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestorePermissionRepository = void 0;
class FirestorePermissionRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection() {
        return this.db.collection('system_metadata').doc('permissions').collection('items');
    }
    async getAll() {
        const snapshot = await this.getCollection().get();
        return snapshot.docs.map(doc => (Object.assign({ id: doc.id }, doc.data())));
    }
    async getById(id) {
        const doc = await this.getCollection().doc(id).get();
        if (!doc.exists)
            return null;
        return Object.assign({ id: doc.id }, doc.data());
    }
    async create(permission) {
        await this.getCollection().doc(permission.id).set(permission);
    }
    async update(id, permission) {
        await this.getCollection().doc(id).update(permission);
    }
    async delete(id) {
        await this.getCollection().doc(id).delete();
    }
}
exports.FirestorePermissionRepository = FirestorePermissionRepository;
//# sourceMappingURL=FirestorePermissionRepository.js.map