"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanyModuleRepository = void 0;
/**
 * Firestore implementation of CompanyModule repository
 * Collection path: companyModules/{companyId}/modules/{moduleCode}
 */
class FirestoreCompanyModuleRepository {
    constructor(db) {
        this.db = db;
    }
    async get(companyId, moduleCode) {
        const docRef = this.db
            .collection('companyModules')
            .doc(companyId)
            .collection('modules')
            .doc(moduleCode);
        const snapshot = await docRef.get();
        if (!snapshot.exists)
            return null;
        return this.mapFromFirestore(snapshot.data());
    }
    async listByCompany(companyId) {
        const snapshot = await this.db
            .collection('companyModules')
            .doc(companyId)
            .collection('modules')
            .get();
        return snapshot.docs.map(doc => this.mapFromFirestore(doc.data()));
    }
    async create(module) {
        const docRef = this.db
            .collection('companyModules')
            .doc(module.companyId)
            .collection('modules')
            .doc(module.moduleCode);
        await docRef.set(this.mapToFirestore(module));
    }
    async update(companyId, moduleCode, updates) {
        const docRef = this.db
            .collection('companyModules')
            .doc(companyId)
            .collection('modules')
            .doc(moduleCode);
        const firestoreUpdates = {};
        if (updates.initialized !== undefined)
            firestoreUpdates.initialized = updates.initialized;
        if (updates.initializationStatus)
            firestoreUpdates.initializationStatus = updates.initializationStatus;
        if (updates.config)
            firestoreUpdates.config = updates.config;
        firestoreUpdates.updatedAt = new Date();
        await docRef.update(firestoreUpdates);
    }
    async delete(companyId, moduleCode) {
        const docRef = this.db
            .collection('companyModules')
            .doc(companyId)
            .collection('modules')
            .doc(moduleCode);
        await docRef.delete();
    }
    async batchCreate(modules) {
        const batch = this.db.batch();
        for (const module of modules) {
            const docRef = this.db
                .collection('companyModules')
                .doc(module.companyId)
                .collection('modules')
                .doc(module.moduleCode);
            batch.set(docRef, this.mapToFirestore(module));
        }
        await batch.commit();
    }
    mapToFirestore(module) {
        return {
            companyId: module.companyId,
            moduleCode: module.moduleCode,
            // Store as Date - Firestore auto-converts to Timestamp
            installedAt: module.installedAt,
            initialized: module.initialized,
            initializationStatus: module.initializationStatus,
            config: module.config || {},
            updatedAt: module.updatedAt || null
        };
    }
    mapFromFirestore(data) {
        var _a, _b;
        return {
            companyId: data.companyId,
            moduleCode: data.moduleCode,
            installedAt: ((_a = data.installedAt) === null || _a === void 0 ? void 0 : _a.toDate()) || new Date(),
            initialized: data.initialized || false,
            initializationStatus: data.initializationStatus || 'pending',
            config: data.config || {},
            updatedAt: (_b = data.updatedAt) === null || _b === void 0 ? void 0 : _b.toDate()
        };
    }
}
exports.FirestoreCompanyModuleRepository = FirestoreCompanyModuleRepository;
//# sourceMappingURL=FirestoreCompanyModuleRepository.js.map