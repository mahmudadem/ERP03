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
exports.FirestoreCompanyRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const Company_1 = require("../../../domain/core/entities/Company");
class FirestoreCompanyRepository {
    constructor(dbInstance) {
        this.collectionName = 'companies';
        this.db = dbInstance;
    }
    async save(company) {
        await this.db.collection(this.collectionName).doc(company.id).set({
            id: company.id,
            name: company.name,
            ownerId: company.ownerId,
            taxId: company.taxId,
            address: company.address || null,
            baseCurrency: company.baseCurrency,
            fiscalYearStart: admin.firestore.Timestamp.fromDate(company.fiscalYearStart),
            fiscalYearEnd: admin.firestore.Timestamp.fromDate(company.fiscalYearEnd),
            modules: company.modules,
            createdAt: admin.firestore.Timestamp.fromDate(company.createdAt),
            updatedAt: admin.firestore.Timestamp.fromDate(company.updatedAt),
        });
    }
    async findById(id) {
        const doc = await this.db.collection(this.collectionName).doc(id).get();
        if (!doc.exists)
            return null;
        const data = doc.data();
        return this.mapToEntity(data);
    }
    async findByTaxId(taxId) {
        const snapshot = await this.db
            .collection(this.collectionName)
            .where('taxId', '==', taxId)
            .limit(1)
            .get();
        if (snapshot.empty)
            return null;
        return this.mapToEntity(snapshot.docs[0].data());
    }
    async getUserCompanies(userId) {
        // Note: In a real app, this would likely query a separate 'company_users' collection
        // For MVP, we assume we might query by ownerId, or this needs to be implemented in a Join table repo
        const snapshot = await this.db
            .collection(this.collectionName)
            .where('ownerId', '==', userId)
            .get();
        return snapshot.docs.map(doc => this.mapToEntity(doc.data()));
    }
    async enableModule(companyId, moduleName) {
        await this.db.collection(this.collectionName).doc(companyId).update({
            modules: admin.firestore.FieldValue.arrayUnion(moduleName)
        });
    }
    mapToEntity(data) {
        return new Company_1.Company(data.id, data.name, data.ownerId || 'legacy_owner', data.createdAt.toDate(), data.updatedAt.toDate(), data.baseCurrency || 'USD', data.fiscalYearStart ? data.fiscalYearStart.toDate() : new Date(new Date().getFullYear(), 0, 1), data.fiscalYearEnd ? data.fiscalYearEnd.toDate() : new Date(new Date().getFullYear(), 11, 31), data.modules || ['CORE'], data.taxId, data.address);
    }
}
exports.FirestoreCompanyRepository = FirestoreCompanyRepository;
//# sourceMappingURL=FirestoreCompanyRepository.js.map