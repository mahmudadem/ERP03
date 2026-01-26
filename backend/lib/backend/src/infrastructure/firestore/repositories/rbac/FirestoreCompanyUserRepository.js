"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanyUserRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
class FirestoreCompanyUserRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection(companyId) {
        return this.db.collection('companies').doc(companyId).collection('users');
    }
    async getByUserAndCompany(userId, companyId) {
        const doc = await this.getCollection(companyId).doc(userId).get();
        if (!doc.exists)
            return null;
        return doc.data();
    }
    async get(companyId, userId) {
        const doc = await this.getCollection(companyId).doc(userId).get();
        if (!doc.exists)
            return null;
        return doc.data();
    }
    async getByCompany(companyId) {
        const snapshot = await this.getCollection(companyId).get();
        return snapshot.docs.map(doc => doc.data());
    }
    async getByRole(companyId, roleId) {
        const snapshot = await this.getCollection(companyId).where('roleId', '==', roleId).get();
        return snapshot.docs.map(doc => doc.data());
    }
    async getMembershipsByUser(userId) {
        console.log(`[RBAC Repo] getMembershipsByUser: Querying collectionGroup('users') for userId=${userId}`);
        try {
            const snapshot = await this.db.collectionGroup('users').where('userId', '==', userId).get();
            console.log(`[RBAC Repo] Found ${snapshot.size} memberships for user ${userId}.`);
            return snapshot.docs.map((doc) => {
                var _a;
                const data = doc.data();
                const companyId = ((_a = doc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id) || '';
                // console.log(`[RBAC Repo] Found membership in company: ${companyId} (Role: ${data.roleId})`);
                return Object.assign(Object.assign({}, data), { companyId });
            });
        }
        catch (err) {
            console.error(`[RBAC Repo] Error querying collectionGroup('users'):`, err);
            // Fallback or rethrow?
            // Check if error is 'Requires an index'
            if (err.message && err.message.includes('requires an index')) {
                console.error(`[RBAC Repo] MISSING INDEX on collectionGroup 'users' for field 'userId'. Please create it in Firebase Console.`);
            }
            return [];
        }
    }
    async assignRole(companyUser) {
        await this.getCollection(companyUser.companyId).doc(companyUser.userId).set(companyUser, { merge: true });
    }
    async create(companyUser) {
        await this.getCollection(companyUser.companyId).doc(companyUser.userId).set(companyUser);
    }
    async update(userId, companyId, updates) {
        await this.getCollection(companyId).doc(userId).update(updates);
    }
    async removeRole(userId, companyId) {
        await this.getCollection(companyId).doc(userId).update({ roleId: firestore_1.FieldValue.delete() });
    }
    async delete(companyId, userId) {
        await this.getCollection(companyId).doc(userId).delete();
    }
}
exports.FirestoreCompanyUserRepository = FirestoreCompanyUserRepository;
//# sourceMappingURL=FirestoreCompanyUserRepository.js.map