"use strict";
/**
 * FirestoreVoucherFormRepository.ts
 *
 * Firestore implementation of IVoucherFormRepository
 *
 * Storage: companies/{companyId}/voucherForms/{formId}
 */
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
exports.FirestoreVoucherFormRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
class FirestoreVoucherFormRepository {
    constructor(db) {
        this.db = db;
    }
    getCollection(companyId) {
        return this.db.collection('companies').doc(companyId).collection('voucherForms');
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
            defaultCurrency: form.defaultCurrency || null,
            baseType: form.baseType || null,
            createdAt: form.createdAt || admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: form.createdBy || null
        };
    }
    async create(form) {
        try {
            const ref = this.getCollection(form.companyId).doc(form.id);
            const data = this.toPersistence(form);
            await ref.set(data);
            return form;
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error creating voucher form', error);
        }
    }
    async getById(companyId, formId) {
        try {
            const doc = await this.getCollection(companyId).doc(formId).get();
            if (!doc.exists)
                return null;
            return this.toDomain(doc.data());
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
            return snapshot.docs.map(doc => this.toDomain(doc.data()));
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
            if (snapshot.empty)
                return null;
            return this.toDomain(snapshot.docs[0].data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Error getting default voucher form', error);
        }
    }
    async getAllByCompany(companyId) {
        try {
            const snapshot = await this.getCollection(companyId).get();
            return snapshot.docs.map(doc => this.toDomain(doc.data()));
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
            cleanUpdates.updatedAt = new Date();
            // Remove undefined values
            Object.keys(cleanUpdates).forEach(key => {
                if (cleanUpdates[key] === undefined) {
                    delete cleanUpdates[key];
                }
            });
            // Use set with merge to create if doesn't exist, update if it does
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
//# sourceMappingURL=FirestoreVoucherFormRepository.js.map