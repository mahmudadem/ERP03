"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCompanyModuleRepository = void 0;
/**
 * Firestore implementation of CompanyModule repository
 * Collection path: companies/{companyId}/modules/{moduleCode}
 */
class FirestoreCompanyModuleRepository {
    constructor(db) {
        this.db = db;
    }
    async get(companyId, moduleCode) {
        const docRef = this.db
            .collection('companies')
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
            .collection('companies')
            .doc(companyId)
            .collection('modules')
            .get();
        return snapshot.docs.map(doc => this.mapFromFirestore(doc.data()));
    }
    async create(module) {
        const docRef = this.db
            .collection('companies')
            .doc(module.companyId)
            .collection('modules')
            .doc(module.moduleCode);
        await docRef.set(this.mapToFirestore(module));
    }
    async update(companyId, moduleCode, updates) {
        var _a;
        const docRef = this.db
            .collection('companies')
            .doc(companyId)
            .collection('modules')
            .doc(moduleCode);
        const snapshot = await docRef.get();
        const updatedAt = updates.updatedAt || new Date();
        const firestoreUpdates = {};
        if (updates.isEnabled !== undefined)
            firestoreUpdates.isEnabled = updates.isEnabled;
        if (updates.initialized !== undefined)
            firestoreUpdates.initialized = updates.initialized;
        if (updates.initializationStatus !== undefined)
            firestoreUpdates.initializationStatus = updates.initializationStatus;
        if (updates.config !== undefined)
            firestoreUpdates.config = updates.config;
        firestoreUpdates.updatedAt = updatedAt;
        if (!snapshot.exists) {
            firestoreUpdates.companyId = companyId;
            firestoreUpdates.moduleCode = moduleCode;
            firestoreUpdates.installedAt = updates.installedAt || new Date();
            firestoreUpdates.isEnabled = (_a = updates.isEnabled) !== null && _a !== void 0 ? _a : true;
            if (firestoreUpdates.initialized === undefined)
                firestoreUpdates.initialized = false;
            if (firestoreUpdates.initializationStatus === undefined)
                firestoreUpdates.initializationStatus = 'pending';
            if (firestoreUpdates.config === undefined)
                firestoreUpdates.config = {};
        }
        await docRef.set(firestoreUpdates, { merge: true });
    }
    async delete(companyId, moduleCode) {
        const docRef = this.db
            .collection('companies')
            .doc(companyId)
            .collection('modules')
            .doc(moduleCode);
        await docRef.delete();
    }
    async batchCreate(modules) {
        const batch = this.db.batch();
        for (const module of modules) {
            const docRef = this.db
                .collection('companies')
                .doc(module.companyId)
                .collection('modules')
                .doc(module.moduleCode);
            batch.set(docRef, this.mapToFirestore(module));
        }
        await batch.commit();
    }
    mapToFirestore(module) {
        var _a;
        return {
            companyId: module.companyId,
            moduleCode: module.moduleCode,
            isEnabled: (_a = module.isEnabled) !== null && _a !== void 0 ? _a : true,
            installedAt: module.installedAt,
            initialized: module.initialized,
            initializationStatus: module.initializationStatus,
            config: module.config || {},
            updatedAt: module.updatedAt || null
        };
    }
    mapFromFirestore(data) {
        var _a, _b, _c;
        return {
            companyId: data.companyId,
            moduleCode: data.moduleCode,
            isEnabled: (_a = data.isEnabled) !== null && _a !== void 0 ? _a : true,
            installedAt: ((_b = data.installedAt) === null || _b === void 0 ? void 0 : _b.toDate()) || new Date(),
            initialized: data.initialized || false,
            initializationStatus: data.initializationStatus || 'pending',
            config: data.config || {},
            updatedAt: (_c = data.updatedAt) === null || _c === void 0 ? void 0 : _c.toDate()
        };
    }
}
exports.FirestoreCompanyModuleRepository = FirestoreCompanyModuleRepository;
//# sourceMappingURL=FirestoreCompanyModuleRepository.js.map