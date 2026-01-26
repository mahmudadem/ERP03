"use strict";
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanyModuleSettingsRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreCompanyModuleSettingsRepository {
    constructor(db) {
        this.db = db;
    }
    modularDoc(companyId, moduleId) {
        // MODULAR PATTERN: companies/{id}/{moduleId} (coll) -> Settings (doc)
        return this.db.collection('companies').doc(companyId).collection(moduleId).doc('Settings');
    }
    async getSettings(companyId, moduleId) {
        try {
            // 1. Try modular structure first: accounting/Settings (doc)
            const doc = await this.modularDoc(companyId, moduleId).get();
            if (!doc.exists)
                return null;
            return doc.data() || null;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get company module settings', error);
        }
    }
    async saveSettings(companyId, moduleId, settings, userId) {
        try {
            const data = Object.assign(Object.assign({}, settings), { updatedAt: firestore_1.FieldValue.serverTimestamp(), updatedBy: userId });
            // Save to modular location only
            await this.modularDoc(companyId, moduleId).set(data);
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to save company module settings', error);
        }
    }
    async ensureModuleIsActivated(companyId, moduleId) {
        try {
            const moduleDoc = await this.db.collection('companies').doc(companyId).collection('modules').doc(moduleId).get();
            if (!moduleDoc.exists) {
                throw new Error('Module not activated for this company');
            }
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to verify module activation', error);
        }
    }
    async findByCompanyId(companyId) {
        // This method is now problematic as settings are modularized per subcollection.
        // For now, we return empty or implement a more complex cross-query if needed.
        // Given the architecture, this should probably be refactored at the use-case level.
        return [];
    }
    async create(settings) {
        const { companyId, moduleId } = settings, rest = __rest(settings, ["companyId", "moduleId"]);
        if (!companyId || !moduleId)
            throw new InfrastructureError_1.InfrastructureError('Invalid settings payload');
        const data = Object.assign(Object.assign({}, rest), { updatedAt: firestore_1.FieldValue.serverTimestamp() });
        // Write to modular location only
        await this.modularDoc(companyId, moduleId).set(data, { merge: true });
    }
    async update(companyId, moduleId, settings) {
        const data = Object.assign(Object.assign({}, settings), { updatedAt: firestore_1.FieldValue.serverTimestamp() });
        // Write to modular location only
        await this.modularDoc(companyId, moduleId).set(data, { merge: true });
    }
}
exports.FirestoreCompanyModuleSettingsRepository = FirestoreCompanyModuleSettingsRepository;
//# sourceMappingURL=FirestoreCompanyModuleSettingsRepository.js.map