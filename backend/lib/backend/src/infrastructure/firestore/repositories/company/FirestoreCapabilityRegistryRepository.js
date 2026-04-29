"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreCapabilityRegistryRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
class FirestoreCapabilityRegistryRepository {
    constructor(db) {
        this.db = db;
        this.collection = 'system_metadata';
        this.subcollection = 'capabilities';
    }
    async getAll() {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items').get();
        return snapshot.docs.map(doc => this.mapToDomain(doc));
    }
    async getById(id) {
        const doc = await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).get();
        if (!doc.exists)
            return null;
        return this.mapToDomain(doc);
    }
    async getByCode(code) {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
            .where('code', '==', code).limit(1).get();
        if (snapshot.empty)
            return null;
        return this.mapToDomain(snapshot.docs[0]);
    }
    async getByModuleId(moduleId) {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
            .where('moduleId', '==', moduleId).get();
        return snapshot.docs.map(doc => this.mapToDomain(doc));
    }
    async getReady(moduleId) {
        const snapshot = await this.db.collection(this.collection).doc(this.subcollection).collection('items')
            .where('lifecycleStatus', '==', 'ready').get();
        const results = snapshot.docs.map(doc => this.mapToDomain(doc));
        if (moduleId) {
            return results.filter(c => c.moduleId === moduleId);
        }
        return results;
    }
    async create(capability) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(capability.id).set({
            id: capability.id,
            code: capability.code,
            moduleId: capability.moduleId,
            name: capability.name,
            description: capability.description,
            lifecycleStatus: capability.lifecycleStatus,
            runtimeStatus: capability.runtimeStatus,
            implementationStatus: capability.implementationStatus,
            implementationError: capability.implementationError,
            implementationCheckedAt: capability.implementationCheckedAt,
            enablementPolicy: capability.enablementPolicy,
            requiresMigration: capability.requiresMigration,
            createdAt: capability.createdAt,
            updatedAt: capability.updatedAt,
        });
    }
    async update(id, updates) {
        const updateData = { updatedAt: firestore_1.FieldValue.serverTimestamp() };
        if (updates.name !== undefined)
            updateData.name = updates.name;
        if (updates.description !== undefined)
            updateData.description = updates.description;
        if (updates.lifecycleStatus !== undefined)
            updateData.lifecycleStatus = updates.lifecycleStatus;
        if (updates.runtimeStatus !== undefined)
            updateData.runtimeStatus = updates.runtimeStatus;
        if (updates.implementationStatus !== undefined)
            updateData.implementationStatus = updates.implementationStatus;
        if (updates.implementationError !== undefined)
            updateData.implementationError = updates.implementationError;
        if (updates.enablementPolicy !== undefined)
            updateData.enablementPolicy = updates.enablementPolicy;
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).update(updateData);
    }
    async delete(id) {
        await this.db.collection(this.collection).doc(this.subcollection).collection('items').doc(id).delete();
    }
    async getByCompanyId(companyId) {
        const snapshot = await this.db.collection('companies').doc(companyId)
            .collection('capabilities').get();
        return snapshot.docs.map(doc => this.mapCompanyToDomain(doc.data(), companyId));
    }
    async getByCompanyAndCapability(companyId, capabilityId) {
        const doc = await this.db.collection('companies').doc(companyId)
            .collection('capabilities').doc(capabilityId).get();
        if (!doc.exists)
            return null;
        return this.mapCompanyToDomain(doc.data(), companyId);
    }
    async setEnabled(companyId, capabilityId, isEnabled) {
        const docRef = this.db.collection('companies').doc(companyId).collection('capabilities').doc(capabilityId);
        const existing = await docRef.get();
        if (existing.exists) {
            await docRef.update({
                isEnabled,
                enabledAt: isEnabled ? firestore_1.FieldValue.serverTimestamp() : firestore_1.FieldValue.delete(),
                disabledAt: !isEnabled ? firestore_1.FieldValue.serverTimestamp() : firestore_1.FieldValue.delete(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        else if (isEnabled) {
            await docRef.set({
                companyId,
                capabilityId,
                isEnabled: true,
                enabledAt: firestore_1.FieldValue.serverTimestamp(),
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
    }
    async setConfig(companyId, capabilityId, config) {
        const docRef = this.db.collection('companies').doc(companyId).collection('capabilities').doc(capabilityId);
        const existing = await docRef.get();
        if (existing.exists) {
            await docRef.update({
                config,
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
        else {
            await docRef.set({
                companyId,
                capabilityId,
                isEnabled: false,
                config,
                createdAt: firestore_1.FieldValue.serverTimestamp(),
                updatedAt: firestore_1.FieldValue.serverTimestamp(),
            });
        }
    }
    mapToDomain(doc) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const data = doc.data();
        return {
            id: data.id,
            code: data.code,
            moduleId: data.moduleId,
            name: data.name,
            description: (_a = data.description) !== null && _a !== void 0 ? _a : undefined,
            lifecycleStatus: data.lifecycleStatus,
            runtimeStatus: data.runtimeStatus,
            implementationStatus: data.implementationStatus,
            implementationError: (_b = data.implementationError) !== null && _b !== void 0 ? _b : undefined,
            implementationCheckedAt: (_d = (_c = data.implementationCheckedAt) === null || _c === void 0 ? void 0 : _c.toDate()) !== null && _d !== void 0 ? _d : undefined,
            enablementPolicy: data.enablementPolicy,
            requiresMigration: (_e = data.requiresMigration) !== null && _e !== void 0 ? _e : false,
            createdAt: (_g = (_f = data.createdAt) === null || _f === void 0 ? void 0 : _f.toDate()) !== null && _g !== void 0 ? _g : new Date(),
            updatedAt: (_j = (_h = data.updatedAt) === null || _h === void 0 ? void 0 : _h.toDate()) !== null && _j !== void 0 ? _j : new Date(),
        };
    }
    mapCompanyToDomain(data, companyId) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return {
            companyId,
            capabilityId: data.capabilityId,
            isEnabled: (_a = data.isEnabled) !== null && _a !== void 0 ? _a : false,
            config: data.config || {},
            enabledAt: (_c = (_b = data.enabledAt) === null || _b === void 0 ? void 0 : _b.toDate()) !== null && _c !== void 0 ? _c : undefined,
            disabledAt: (_e = (_d = data.disabledAt) === null || _d === void 0 ? void 0 : _d.toDate()) !== null && _e !== void 0 ? _e : undefined,
            createdAt: (_g = (_f = data.createdAt) === null || _f === void 0 ? void 0 : _f.toDate()) !== null && _g !== void 0 ? _g : new Date(),
            updatedAt: (_j = (_h = data.updatedAt) === null || _h === void 0 ? void 0 : _h.toDate()) !== null && _j !== void 0 ? _j : undefined,
        };
    }
}
exports.FirestoreCapabilityRegistryRepository = FirestoreCapabilityRegistryRepository;
//# sourceMappingURL=FirestoreCapabilityRegistryRepository.js.map