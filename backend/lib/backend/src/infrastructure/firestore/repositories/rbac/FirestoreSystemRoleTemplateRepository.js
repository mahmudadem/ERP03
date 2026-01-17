"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreSystemRoleTemplateRepository = void 0;
class FirestoreSystemRoleTemplateRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection() {
        return this.db.collection('system_metadata').doc('role_templates').collection('items');
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
    async create(template) {
        await this.getCollection().doc(template.id).set(template);
    }
    async update(id, template) {
        await this.getCollection().doc(id).update(template);
    }
    async delete(id) {
        await this.getCollection().doc(id).delete();
    }
}
exports.FirestoreSystemRoleTemplateRepository = FirestoreSystemRoleTemplateRepository;
//# sourceMappingURL=FirestoreSystemRoleTemplateRepository.js.map