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
const VoucherFormDeduper_1 = require("../../../../domain/designer/services/VoucherFormDeduper");
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
            headerFields: this.stripUndefinedDeep(form.headerFields || []),
            tableColumns: this.stripUndefinedDeep(form.tableColumns || []),
            layout: this.stripUndefinedDeep(form.layout || {}),
            uiModeOverrides: this.stripUndefinedDeep(form.uiModeOverrides || null),
            rules: this.stripUndefinedDeep(form.rules || []),
            actions: this.stripUndefinedDeep(form.actions || []),
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
    stripUndefinedDeep(value) {
        if (Array.isArray(value)) {
            const cleaned = value
                .map((item) => this.stripUndefinedDeep(item))
                .filter((item) => item !== undefined);
            return cleaned;
        }
        if (value && typeof value === 'object') {
            const proto = Object.getPrototypeOf(value);
            if (proto === Object.prototype || proto === null) {
                const cleaned = {};
                for (const [key, raw] of Object.entries(value)) {
                    if (raw === undefined)
                        continue;
                    cleaned[key] = this.stripUndefinedDeep(raw);
                }
                return cleaned;
            }
        }
        return value;
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
            return (0, VoucherFormDeduper_1.dedupeVoucherForms)(companyForms);
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
                else {
                    cleanUpdates[key] = this.stripUndefinedDeep(cleanUpdates[key]);
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
//# sourceMappingURL=FirestoreVoucherFormRepository.js.map