"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreSystemRoleTemplateRepository = void 0;
class FirestoreSystemRoleTemplateRepository {
    constructor(db) {
        this.db = db;
        this.collection = 'system_role_templates';
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
    async create(template) {
        await this.db.collection(this.collection).doc(template.id).set(template);
    }
    async update(id, template) {
        await this.db.collection(this.collection).doc(id).update(template);
    }
    async delete(id) {
        await this.db.collection(this.collection).doc(id).delete();
    }
}
exports.FirestoreSystemRoleTemplateRepository = FirestoreSystemRoleTemplateRepository;
//# sourceMappingURL=FirestoreSystemRoleTemplateRepository.js.map