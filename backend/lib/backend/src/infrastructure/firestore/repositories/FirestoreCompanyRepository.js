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
        const fiscalStart = company.fiscalYearStart instanceof Date ? company.fiscalYearStart : new Date(company.fiscalYearStart);
        const fiscalEnd = company.fiscalYearEnd instanceof Date ? company.fiscalYearEnd : new Date(company.fiscalYearEnd);
        await this.db.collection(this.collectionName).doc(company.id).set({
            id: company.id,
            name: company.name,
            ownerId: company.ownerId,
            taxId: company.taxId,
            address: company.address || null,
            baseCurrency: company.baseCurrency,
            fiscalYearStart: admin.firestore.Timestamp.fromDate(fiscalStart),
            fiscalYearEnd: admin.firestore.Timestamp.fromDate(fiscalEnd),
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
    async findByNameAndOwner(name, ownerId) {
        const snapshot = await this.db
            .collection(this.collectionName)
            .where('ownerId', '==', ownerId)
            .where('name', '==', name)
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
    async disableModule(companyId, moduleName) {
        await this.db.collection(this.collectionName).doc(companyId).update({
            modules: admin.firestore.FieldValue.arrayRemove(moduleName)
        });
    }
    async update(companyId, updates) {
        await this.db.collection(this.collectionName).doc(companyId).set(updates, { merge: true });
        const updated = await this.findById(companyId);
        if (!updated)
            throw new Error('Company not found after update');
        return updated;
    }
    async updateBundle(companyId, bundleId) {
        await this.db.collection(this.collectionName).doc(companyId).set({ subscriptionPlan: bundleId }, { merge: true });
        const updated = await this.findById(companyId);
        if (!updated)
            throw new Error('Company not found after bundle update');
        return updated;
    }
    async updateFeatures(companyId, features) {
        await this.db.collection(this.collectionName).doc(companyId).set({ features }, { merge: true });
    }
    mapToEntity(data) {
        return new Company_1.Company(data.id, data.name, data.ownerId || 'legacy_owner', data.createdAt.toDate(), data.updatedAt.toDate(), data.baseCurrency || 'USD', data.fiscalYearStart ? data.fiscalYearStart.toDate() : new Date(new Date().getFullYear(), 0, 1), data.fiscalYearEnd ? data.fiscalYearEnd.toDate() : new Date(new Date().getFullYear(), 11, 31), data.modules || ['CORE'], data.features || [], data.taxId || '', data.subscriptionPlan, data.address, data.country, data.logoUrl, data.contactInfo);
    }
    async listAll() {
        const snapshot = await this.db.collection(this.collectionName).get();
        return snapshot.docs.map(doc => this.mapToEntity(doc.data()));
    }
    async delete(companyId) {
        // Delete company document and all subcollections
        console.log(`[FirestoreCompanyRepository] Deleting company ${companyId}...`);
        await this.db.collection(this.collectionName).doc(companyId).delete();
        // Delete subcollections
        try {
            const modulesSnap = await this.db.collection('companyModules').doc(companyId).collection('modules').get();
            const batch = this.db.batch();
            modulesSnap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            await this.db.collection('companyModules').doc(companyId).delete();
        }
        catch (e) { }
        try {
            const rolesSnap = await this.db.collection('companyRoles').where('companyId', '==', companyId).get();
            const batch = this.db.batch();
            rolesSnap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        catch (e) { }
        try {
            const usersSnap = await this.db.collection('companyUsers').where('companyId', '==', companyId).get();
            const batch = this.db.batch();
            usersSnap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
        catch (e) { }
        console.log(`[FirestoreCompanyRepository] Company ${companyId} deleted`);
    }
}
exports.FirestoreCompanyRepository = FirestoreCompanyRepository;
//# sourceMappingURL=FirestoreCompanyRepository.js.map