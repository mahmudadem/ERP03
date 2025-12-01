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
    async getByCompany(companyId) {
        const snapshot = await this.getCollection(companyId).get();
        return snapshot.docs.map(doc => doc.data());
    }
    async assignRole(companyUser) {
        await this.getCollection(companyUser.companyId).doc(companyUser.userId).set(companyUser, { merge: true });
    }
    async removeRole(userId, companyId) {
        // Removing role might mean setting roleId to null or deleting the record?
        // The interface says removeRole. But CompanyUser usually implies membership.
        // If we remove role, maybe we set it to a default or empty?
        // For now, let's assume we update it.
        // But wait, CompanyUser structure has roleId as string.
        // If we remove it, maybe we delete the user from company? Or just clear role?
        // The prompt says "Assign users to roles".
        // I'll assume removeRole means unassigning, maybe setting to empty string or null if type allowed.
        // But type is string.
        // I'll implement it as update with empty role or similar, or maybe I won't implement it if not strictly required by use cases.
        // Use cases: AssignRoleToCompanyUserUseCase. No RemoveRoleUseCase.
        // But interface has it.
        // I'll just update it to empty string for now.
        await this.getCollection(companyId).doc(userId).update({ roleId: admin.firestore.FieldValue.delete() });
    }
}
exports.FirestoreCompanyUserRepository = FirestoreCompanyUserRepository;
//# sourceMappingURL=FirestoreCompanyUserRepository.js.map