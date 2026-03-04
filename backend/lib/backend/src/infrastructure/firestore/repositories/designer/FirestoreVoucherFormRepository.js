"use strict";
/**
 * FirestoreVoucherFormRepository.ts
 *
 * Firestore implementation of IVoucherFormRepository
 *
 * Storage: companies/{companyId}/voucherForms/{formId}
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreVoucherFormRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreVoucherFormRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection(companyId) {
        // MODULAR PATTERN: companies/{id}/accounting (coll) -> Settings (doc) -> voucherForms (coll)
        return this.db
            .collection('companies')
            .doc(companyId)
            .collection('accounting')
            .doc('Settings')
            .collection('voucherForms');
    }
    toDomain(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        return {
            id: data.id,
            companyId: data.companyId,
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
    async create(form) {
        try {
            const data = this.toPersistence(form);
            await this.getCollection(form.companyId).doc(form.id).set(data);
            return form;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error creating voucher form', error);
        }
    }
    async getById(companyId, formId) {
        try {
            let doc = await this.getCollection(companyId).doc(formId).get();
            if (doc.exists) {
                return this.toDomain(doc.data());
            }
            // Fallback to SYSTEM templates if not found in company collection
            // Many system templates use their code/id interchangeably (e.g. fx_revaluation)
            const systemDoc = await this.getSystemCollection().doc(formId).get();
            if (systemDoc.exists) {
                const sysData = systemDoc.data();
                // Map VoucherTypeDefinition to VoucherFormDefinition
                return this.toDomain(Object.assign(Object.assign({}, sysData), { typeId: sysData.code || sysData.id, isSystemGenerated: true }));
            }
            return null;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting voucher form by ID', error);
        }
    }
    async getByTypeId(companyId, typeId) {
        try {
            const snapshot = await this.getCollection(companyId)
                .where('typeId', '==', typeId)
                .get();
            const forms = snapshot.docs.map(doc => this.toDomain(doc.data()));
            // If no company forms found for this type, check system
            if (forms.length === 0) {
                const systemSnapshot = await this.getSystemCollection()
                    .where('code', '==', typeId)
                    .get();
                systemSnapshot.docs.forEach(doc => {
                    const sysData = doc.data();
                    forms.push(this.toDomain(Object.assign(Object.assign({}, sysData), { typeId: sysData.code || sysData.id, isSystemGenerated: true })));
                });
            }
            return forms;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting voucher forms by type', error);
        }
    }
    async getDefaultForType(companyId, typeId) {
        try {
            const snapshot = await this.getCollection(companyId)
                .where('typeId', '==', typeId)
                .where('isDefault', '==', true)
                .limit(1)
                .get();
            if (!snapshot.empty)
                return this.toDomain(snapshot.docs[0].data());
            // Fallback to system default
            const systemSnapshot = await this.getSystemCollection()
                .where('code', '==', typeId)
                .limit(1)
                .get();
            if (!systemSnapshot.empty) {
                const sysData = systemSnapshot.docs[0].data();
                return this.toDomain(Object.assign(Object.assign({}, sysData), { typeId: sysData.code || sysData.id, isDefault: true, isSystemGenerated: true }));
            }
            return null;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting default voucher form', error);
        }
    }
    async getAllByCompany(companyId) {
        try {
            const snapshot = await this.getCollection(companyId).get();
            const companyForms = snapshot.docs.map(doc => this.toDomain(doc.data()));
            // If company has explicit forms (created by accounting initialization / designer),
            // return them as-is. This keeps sidebar aligned with selected voucher types.
            if (companyForms.length > 0) {
                return companyForms;
            }
            // Legacy fallback: if no company forms exist, expose system templates.
            const systemSnapshot = await this.getSystemCollection().get();
            return systemSnapshot.docs.map(doc => {
                const sysData = doc.data();
                return this.toDomain(Object.assign(Object.assign({}, sysData), { typeId: sysData.code || sysData.id, isSystemGenerated: true }));
            });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting all voucher forms', error);
        }
    }
    async update(companyId, formId, updates) {
        try {
            const ref = this.getCollection(companyId).doc(formId);
            const cleanUpdates = Object.assign({}, updates);
            delete cleanUpdates.id;
            delete cleanUpdates.companyId;
            cleanUpdates.updatedAt = firestore_1.FieldValue.serverTimestamp();
            Object.keys(cleanUpdates).forEach(key => {
                if (cleanUpdates[key] === undefined) {
                    delete cleanUpdates[key];
                }
            });
            await ref.set(cleanUpdates, { merge: true });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error updating voucher form', error);
        }
    }
    async delete(companyId, formId) {
        try {
            await this.getCollection(companyId).doc(formId).delete();
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error deleting voucher form', error);
        }
    }
}
exports.FirestoreVoucherFormRepository = FirestoreVoucherFormRepository;
FirestoreVoucherFormRepository.SYSTEM_COMPANY_ID = 'SYSTEM';
FirestoreVoucherFormRepository.SYSTEM_COLLECTION_NAME = 'voucher_types';
FirestoreVoucherFormRepository.SYSTEM_METADATA_COLLECTION = 'system_metadata';
//# sourceMappingURL=FirestoreVoucherFormRepository.js.map