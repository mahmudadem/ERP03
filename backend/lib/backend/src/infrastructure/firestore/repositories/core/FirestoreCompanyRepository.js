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
/**
 * FirestoreCompanyRepository.ts
 *
 * Layer: Infrastructure
 * Purpose: Implementation of ICompanyRepository using Firestore.
 */
const admin = __importStar(require("firebase-admin"));
const BaseFirestoreRepository_1 = require("../BaseFirestoreRepository");
const CoreMappers_1 = require("../../mappers/CoreMappers");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreCompanyRepository extends BaseFirestoreRepository_1.BaseFirestoreRepository {
    constructor() {
        super(...arguments);
        this.collectionName = 'companies';
    }
    toDomain(data) {
        return CoreMappers_1.CompanyMapper.toDomain(data);
    }
    toPersistence(entity) {
        return CoreMappers_1.CompanyMapper.toPersistence(entity);
    }
    async findByTaxId(taxId) {
        try {
            const snapshot = await this.db.collection(this.collectionName)
                .where('taxId', '==', taxId)
                .limit(1)
                .get();
            if (snapshot.empty)
                return null;
            return this.toDomain(snapshot.docs[0].data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error finding company by TaxID', error);
        }
    }
    async getUserCompanies(userId) {
        try {
            // In a real scenario, this might query a join collection 'company_users' first.
            // For MVP, assuming ownerId check or simple permission check logic.
            const snapshot = await this.db.collection(this.collectionName)
                .where('ownerId', '==', userId)
                .get();
            return snapshot.docs.map(doc => this.toDomain(doc.data()));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting user companies', error);
        }
    }
    async enableModule(companyId, moduleName) {
        try {
            await this.db.collection(this.collectionName).doc(companyId).update({
                modules: admin.firestore.FieldValue.arrayUnion(moduleName)
            });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error enabling module', error);
        }
    }
}
exports.FirestoreCompanyRepository = FirestoreCompanyRepository;
//# sourceMappingURL=FirestoreCompanyRepository.js.map