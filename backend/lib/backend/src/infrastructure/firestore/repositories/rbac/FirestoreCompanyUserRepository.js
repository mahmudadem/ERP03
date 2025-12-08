"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanyUserRepository = void 0;
const admin = __importStar(require("firebase-admin"));
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
        const snapshot = await this.db.collectionGroup('users').where('userId', '==', userId).get();
        return snapshot.docs.map((doc) => {
            var _a;
            const data = doc.data();
            const companyId = ((_a = doc.ref.parent.parent) === null || _a === void 0 ? void 0 : _a.id) || '';
            return Object.assign(Object.assign({}, data), { companyId });
        });
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
        await this.getCollection(companyId).doc(userId).update({ roleId: admin.firestore.FieldValue.delete() });
    }
}
exports.FirestoreCompanyUserRepository = FirestoreCompanyUserRepository;
//# sourceMappingURL=FirestoreCompanyUserRepository.js.map