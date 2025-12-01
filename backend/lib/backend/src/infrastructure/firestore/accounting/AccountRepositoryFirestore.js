"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountRepositoryFirestore = void 0;
class AccountRepositoryFirestore {
    constructor(db) {
        this.db = db;
    }
    getCollection(companyId) {
        return this.db.collection(`companies/${companyId}/accounts`);
    }
    async list(companyId) {
        const snapshot = await this.getCollection(companyId).get();
        return snapshot.docs.map((doc) => (Object.assign({ id: doc.id }, doc.data())));
    }
    async getById(companyId, accountId) {
        const doc = await this.getCollection(companyId).doc(accountId).get();
        if (!doc.exists)
            return null;
        return Object.assign({ id: doc.id }, doc.data());
    }
    async getByCode(companyId, code) {
        const snapshot = await this.getCollection(companyId).where('code', '==', code).limit(1).get();
        if (snapshot.empty)
            return null;
        const doc = snapshot.docs[0];
        return Object.assign({ id: doc.id }, doc.data());
    }
    async create(companyId, data) {
        const ref = this.getCollection(companyId).doc();
        const now = new Date();
        const account = Object.assign(Object.assign({ id: ref.id, companyId }, data), { type: data.type, active: true, isActive: true, isProtected: false, currency: data.currency || '', parentId: data.parentId || undefined, createdAt: now, updatedAt: now });
        await ref.set(account);
        return account;
    }
    async update(companyId, accountId, data) {
        const ref = this.getCollection(companyId).doc(accountId);
        const updates = Object.assign(Object.assign({}, data), { updatedAt: new Date() });
        await ref.update(updates);
        const updated = await ref.get();
        return Object.assign({ id: updated.id }, updated.data());
    }
    async deactivate(companyId, accountId) {
        const ref = this.getCollection(companyId).doc(accountId);
        await ref.update({
            isActive: false,
            updatedAt: new Date(),
        });
    }
    async hasChildren(companyId, accountId) {
        const snapshot = await this.getCollection(companyId).where('parentId', '==', accountId).limit(1).get();
        return !snapshot.empty;
    }
    async getAccounts(companyId) {
        return this.list(companyId);
    }
}
exports.AccountRepositoryFirestore = AccountRepositoryFirestore;
//# sourceMappingURL=AccountRepositoryFirestore.js.map