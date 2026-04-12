"use strict";
/**
 * FirestoreVoucherFormRepository.ts
 *
 * Firestore implementation of IVoucherFormRepository
 *
 * Modular Path: companies/{companyId}/{module}/Settings/voucherForms/{formId}
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreVoucherFormRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreVoucherFormRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection(companyId, moduleName) {
        const baseModule = (moduleName || 'ACCOUNTING').toLowerCase();
        // Standard modular pattern: companies/{id}/{module}/Settings/voucherForms
        return this.db
            .collection('companies')
            .doc(companyId)
            .collection(baseModule)
            .doc('Settings')
            .collection('voucherForms');
    }
    toDomain(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return {
            id: data.id,
            companyId: data.companyId,
            module: data.module || 'ACCOUNTING',
            typeId: data.typeId,
            name: data.name,
            code: data.code,
            description: data.description || null,
            prefix: data.prefix || null,
            numberFormat: data.numberFormat || null,
            isDefault: (_a = data.isDefault) !== null && _a !== void 0 ? _a : false,
            isSystemGenerated: (_b = data.isSystemGenerated) !== null && _b !== void 0 ? _b : false,
            isLocked: (_c = data.isLocked) !== null && _c !== void 0 ? _c : false,
            enabled: (_d = data.enabled) !== null && _d !== void 0 ? _d : true,
            headerFields: data.headerFields || [],
            tableColumns: data.tableColumns || [],
            layout: data.layout || {},
            uiModeOverrides: data.uiModeOverrides || null,
            rules: data.rules || [],
            actions: data.actions || [],
            isMultiLine: (_e = data.isMultiLine) !== null && _e !== void 0 ? _e : true,
            tableStyle: data.tableStyle || 'web',
            defaultCurrency: data.defaultCurrency || null,
            baseType: data.baseType || null,
            sidebarGroup: data.sidebarGroup || null,
            createdAt: ((_g = (_f = data.createdAt) === null || _f === void 0 ? void 0 : _f.toDate) === null || _g === void 0 ? void 0 : _g.call(_f)) || data.createdAt || new Date(),
            updatedAt: ((_j = (_h = data.updatedAt) === null || _h === void 0 ? void 0 : _h.toDate) === null || _j === void 0 ? void 0 : _j.call(_h)) || data.updatedAt || new Date(),
            createdBy: data.createdBy || null
        };
    }
    toPersistence(form) {
        var _a;
        return {
            id: form.id,
            companyId: form.companyId,
            module: form.module || 'ACCOUNTING',
            typeId: form.typeId,
            name: form.name,
            code: form.code,
            description: form.description || null,
            prefix: form.prefix || null,
            numberFormat: form.numberFormat || null,
            isDefault: form.isDefault,
            isSystemGenerated: form.isSystemGenerated,
            isLocked: form.isLocked,
            enabled: form.enabled,
            headerFields: form.headerFields,
            tableColumns: form.tableColumns,
            layout: form.layout || {},
            uiModeOverrides: form.uiModeOverrides || null,
            rules: form.rules || [],
            actions: form.actions || [],
            isMultiLine: (_a = form.isMultiLine) !== null && _a !== void 0 ? _a : true,
            tableStyle: form.tableStyle || 'web',
            defaultCurrency: form.defaultCurrency || null,
            baseType: form.baseType || null,
            sidebarGroup: form.sidebarGroup || null,
            createdAt: form.createdAt || firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            createdBy: form.createdBy || null
        };
    }
    getSystemCollection() {
        return this.db.collection(FirestoreVoucherFormRepository.SYSTEM_METADATA_COLLECTION)
            .doc(FirestoreVoucherFormRepository.SYSTEM_COLLECTION_NAME)
            .collection('items');
    }
    toSystemDomain(data) {
        return this.toDomain(Object.assign(Object.assign({}, data), { typeId: data.code || data.id, isSystemGenerated: true }));
    }
    mergeMissingSystemForms(companyForms, systemForms) {
        const normalize = (value) => String(value || '').trim().toLowerCase();
        const seenKeys = new Set();
        companyForms.forEach((form) => {
            [form.id, form.code, form.typeId].forEach((value) => {
                const key = normalize(value);
                if (key)
                    seenKeys.add(key);
            });
        });
        const merged = [...companyForms];
        for (const form of systemForms) {
            const candidateKeys = [form.id, form.code, form.typeId]
                .map((value) => normalize(value))
                .filter(Boolean);
            if (candidateKeys.some((key) => seenKeys.has(key))) {
                continue;
            }
            merged.push(form);
            candidateKeys.forEach((key) => seenKeys.add(key));
        }
        return merged;
    }
    async create(form) {
        try {
            const data = this.toPersistence(form);
            await this.getCollection(form.companyId, form.module).doc(form.id).set(data);
            return form;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error creating voucher form', error);
        }
    }
    async getById(companyId, formId) {
        try {
            for (const mod of FirestoreVoucherFormRepository.MODULES) {
                let doc = await this.getCollection(companyId, mod).doc(formId).get();
                if (doc.exists) {
                    return this.toDomain(Object.assign(Object.assign({}, doc.data()), { id: doc.id }));
                }
            }
            // Fallback to SYSTEM templates if not found in company collection
            const systemDoc = await this.getSystemCollection().doc(formId).get();
            if (systemDoc.exists) {
                return this.toSystemDomain(Object.assign(Object.assign({}, systemDoc.data()), { id: systemDoc.id }));
            }
            return null;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting voucher form by ID', error);
        }
    }
    async getByTypeId(companyId, typeId) {
        try {
            const allForms = [];
            for (const mod of FirestoreVoucherFormRepository.MODULES) {
                const snapshot = await this.getCollection(companyId, mod)
                    .where('typeId', '==', typeId)
                    .get();
                snapshot.docs.forEach(doc => {
                    allForms.push(this.toDomain(Object.assign(Object.assign({}, doc.data()), { id: doc.id })));
                });
            }
            // If no company forms found for this type, check system
            if (allForms.length === 0) {
                const systemSnapshot = await this.getSystemCollection()
                    .where('code', '==', typeId)
                    .get();
                systemSnapshot.docs.forEach(doc => {
                    allForms.push(this.toSystemDomain(Object.assign(Object.assign({}, doc.data()), { id: doc.id })));
                });
            }
            return allForms;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting voucher forms by type', error);
        }
    }
    async getDefaultForType(companyId, typeId) {
        try {
            for (const mod of FirestoreVoucherFormRepository.MODULES) {
                const snapshot = await this.getCollection(companyId, mod)
                    .where('typeId', '==', typeId)
                    .where('isDefault', '==', true)
                    .limit(1)
                    .get();
                if (!snapshot.empty)
                    return this.toDomain(Object.assign(Object.assign({}, snapshot.docs[0].data()), { id: snapshot.docs[0].id }));
            }
            // Fallback to system default
            const systemSnapshot = await this.getSystemCollection()
                .where('code', '==', typeId)
                .limit(1)
                .get();
            if (!systemSnapshot.empty) {
                return this.toDomain(Object.assign(Object.assign({}, systemSnapshot.docs[0].data()), { id: systemSnapshot.docs[0].id, typeId: systemSnapshot.docs[0].data().code || systemSnapshot.docs[0].id, isDefault: true, isSystemGenerated: true }));
            }
            return null;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting default voucher form', error);
        }
    }
    async getAllByCompany(companyId) {
        try {
            const companyForms = [];
            for (const mod of FirestoreVoucherFormRepository.MODULES) {
                const snapshot = await this.getCollection(companyId, mod).get();
                snapshot.docs.forEach(doc => {
                    companyForms.push(this.toDomain(Object.assign(Object.assign({}, doc.data()), { id: doc.id })));
                });
            }
            const systemSnapshot = await this.getSystemCollection().get();
            const systemForms = systemSnapshot.docs.map(doc => this.toSystemDomain(Object.assign(Object.assign({}, doc.data()), { id: doc.id })));
            return this.mergeMissingSystemForms(companyForms, systemForms);
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting all voucher forms', error);
        }
    }
    async update(companyId, formId, updates) {
        try {
            // Find where it is first
            let targetRef = null;
            for (const mod of FirestoreVoucherFormRepository.MODULES) {
                const ref = this.getCollection(companyId, mod).doc(formId);
                const doc = await ref.get();
                if (doc.exists) {
                    targetRef = ref;
                    break;
                }
            }
            if (!targetRef) {
                // If it doesn't exist, we fallback to default module or module specified in updates
                targetRef = this.getCollection(companyId, updates.module).doc(formId);
            }
            const cleanUpdates = Object.assign({}, updates);
            delete cleanUpdates.id;
            delete cleanUpdates.companyId;
            cleanUpdates.updatedAt = firestore_1.FieldValue.serverTimestamp();
            Object.keys(cleanUpdates).forEach(key => {
                if (cleanUpdates[key] === undefined) {
                    delete cleanUpdates[key];
                }
            });
            await targetRef.set(cleanUpdates, { merge: true });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error updating voucher form', error);
        }
    }
    async delete(companyId, formId) {
        try {
            for (const mod of FirestoreVoucherFormRepository.MODULES) {
                const ref = this.getCollection(companyId, mod).doc(formId);
                const doc = await ref.get();
                if (doc.exists) {
                    await ref.delete();
                    return;
                }
            }
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error deleting voucher form', error);
        }
    }
}
exports.FirestoreVoucherFormRepository = FirestoreVoucherFormRepository;
FirestoreVoucherFormRepository.MODULES = ['accounting', 'sales', 'purchase', 'purchases', 'inventory', 'sales_module'];
FirestoreVoucherFormRepository.SYSTEM_COMPANY_ID = 'SYSTEM';
FirestoreVoucherFormRepository.SYSTEM_COLLECTION_NAME = 'voucher_types';
FirestoreVoucherFormRepository.SYSTEM_METADATA_COLLECTION = 'system_metadata';
//# sourceMappingURL=FirestoreVoucherFormRepository.js.map