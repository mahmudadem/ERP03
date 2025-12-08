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
    async update(companyId, updates) {
        try {
            // Convert updates to persistence format if needed
            const updateData = {};
            if (updates.name !== undefined)
                updateData.name = updates.name;
            if (updates.baseCurrency !== undefined)
                updateData.baseCurrency = updates.baseCurrency;
            if (updates.fiscalYearStart !== undefined)
                updateData.fiscalYearStart = updates.fiscalYearStart;
            if (updates.fiscalYearEnd !== undefined)
                updateData.fiscalYearEnd = updates.fiscalYearEnd;
            if (updates.taxId !== undefined)
                updateData.taxId = updates.taxId;
            if (updates.address !== undefined)
                updateData.address = updates.address;
            if (updates.subscriptionPlan !== undefined)
                updateData.subscriptionPlan = updates.subscriptionPlan;
            if (updates.modules !== undefined)
                updateData.modules = updates.modules;
            if (updates.features !== undefined)
                updateData.features = updates.features;
            updateData.updatedAt = new Date();
            await this.db.collection(this.collectionName).doc(companyId).update(updateData);
            // Fetch and return updated company
            const updated = await this.findById(companyId);
            if (!updated) {
                throw new Error('Company not found after update');
            }
            return updated;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error updating company', error);
        }
    }
    async disableModule(companyId, moduleName) {
        try {
            await this.db.collection(this.collectionName).doc(companyId).update({
                modules: admin.firestore.FieldValue.arrayRemove(moduleName)
            });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error disabling module', error);
        }
    }
    async updateBundle(companyId, bundleId) {
        try {
            await this.db.collection(this.collectionName).doc(companyId).update({
                subscriptionPlan: bundleId,
                updatedAt: new Date()
            });
            const updated = await this.findById(companyId);
            if (!updated) {
                throw new Error('Company not found after bundle update');
            }
            return updated;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error updating company bundle', error);
        }
    }
    async updateFeatures(companyId, features) {
        try {
            await this.db.collection(this.collectionName).doc(companyId).update({
                features: features,
                updatedAt: new Date()
            });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error updating company features', error);
        }
    }
}
exports.FirestoreCompanyRepository = FirestoreCompanyRepository;
//# sourceMappingURL=FirestoreCompanyRepository.js.map