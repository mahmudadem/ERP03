"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanyRoleRepository = void 0;
class FirestoreCompanyRoleRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection(companyId) {
        return this.db.collection('companies').doc(companyId).collection('roles');
    }
    async getAll(companyId) {
        const snapshot = await this.getCollection(companyId).get();
        return snapshot.docs.map(doc => doc.data());
    }
    async getById(companyId, roleId) {
        const doc = await this.getCollection(companyId).doc(roleId).get();
        if (!doc.exists)
            return null;
        return doc.data();
    }
    async create(role) {
        await this.getCollection(role.companyId).doc(role.id).set(role);
    }
    async update(companyId, roleId, role) {
        await this.getCollection(companyId).doc(roleId).update(role);
    }
    async delete(companyId, roleId) {
        await this.getCollection(companyId).doc(roleId).delete();
    }
}
exports.FirestoreCompanyRoleRepository = FirestoreCompanyRoleRepository;
//# sourceMappingURL=FirestoreCompanyRoleRepository.js.map