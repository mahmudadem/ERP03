"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestorePermissionRepository = void 0;
class FirestorePermissionRepository {
    constructor(db) {
        this.db = db;
        this.collection = 'permissions';
    }
    async getAll() {
        const snapshot = await this.db.collection(this.collection).get();
        return snapshot.docs.map(doc => doc.data());
    }
    async getById(id) {
        const doc = await this.db.collection(this.collection).doc(id).get();
        if (!doc.exists)
            return null;
        return doc.data();
    }
    async create(permission) {
        await this.db.collection(this.collection).doc(permission.id).set(permission);
    }
    async update(id, permission) {
        await this.db.collection(this.collection).doc(id).update(permission);
    }
    async delete(id) {
        await this.db.collection(this.collection).doc(id).delete();
    }
}
exports.FirestorePermissionRepository = FirestorePermissionRepository;
//# sourceMappingURL=FirestorePermissionRepository.js.map