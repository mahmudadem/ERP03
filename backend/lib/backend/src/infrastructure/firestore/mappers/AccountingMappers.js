"use strict";
/**
 * AccountingMappers.ts
 *
 * Transforms Accounting Domain Entities to/from Firestore structure.
 * Handles legacy field mapping (type->classification, code->userCode, etc.)
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
exports.VoucherMapper = exports.AccountMapper = void 0;
const admin = __importStar(require("firebase-admin"));
const Account_1 = require("../../../domain/accounting/entities/Account");
/**
 * Safely convert any date value to Firestore-compatible format.
 */
const toFirestoreDate = (val) => {
    var _a;
    if (val === null || val === undefined) {
        return admin.firestore.FieldValue.serverTimestamp();
    }
    const TimestampClass = (_a = admin.firestore) === null || _a === void 0 ? void 0 : _a.Timestamp;
    if (TimestampClass && val instanceof TimestampClass) {
        return val;
    }
    if (val instanceof Date) {
        try {
            if (TimestampClass === null || TimestampClass === void 0 ? void 0 : TimestampClass.fromDate) {
                return TimestampClass.fromDate(val);
            }
            return val.toISOString();
        }
        catch (_b) {
            return val.toISOString();
        }
    }
    if (typeof val === 'string') {
        if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
            return val;
        }
        try {
            const date = new Date(val);
            if (!isNaN(date.getTime())) {
                if (TimestampClass === null || TimestampClass === void 0 ? void 0 : TimestampClass.fromDate) {
                    return TimestampClass.fromDate(date);
                }
                return date.toISOString();
            }
        }
        catch (_c) {
            // Ignore
        }
        return val;
    }
    if (typeof val === 'number') {
        try {
            if (TimestampClass === null || TimestampClass === void 0 ? void 0 : TimestampClass.fromMillis) {
                return TimestampClass.fromMillis(val);
            }
            return new Date(val).toISOString();
        }
        catch (_d) {
            return val;
        }
    }
    return val;
};
/**
 * Convert Firestore timestamp to Date
 */
const fromFirestoreDate = (val) => {
    if (!val)
        return new Date();
    if (val instanceof Date)
        return val;
    if (val.toDate && typeof val.toDate === 'function')
        return val.toDate();
    if (typeof val === 'string')
        return new Date(val);
    if (typeof val === 'number')
        return new Date(val);
    return new Date();
};
/**
 * Account Mapper
 * Handles bidirectional mapping between Account entity and Firestore
 */
class AccountMapper {
    /**
     * Convert Firestore data to Account entity
     * Handles legacy field names for backward compatibility
     */
    static toDomain(data) {
        var _a;
        // Handle legacy field mapping
        const classification = (0, Account_1.normalizeClassification)(data.classification || data.type || 'ASSET');
        return Account_1.Account.fromJSON({
            id: data.id,
            systemCode: data.systemCode || data.code || data.id,
            companyId: data.companyId,
            userCode: data.userCode || data.code || data.id,
            name: data.name,
            description: data.description || null,
            // Accounting semantics with defaults
            accountRole: data.accountRole || (data.isParent || data.hasChildren ? 'HEADER' : 'POSTING'),
            classification,
            balanceNature: data.balanceNature || (0, Account_1.getDefaultBalanceNature)(classification),
            balanceEnforcement: data.balanceEnforcement || 'WARN_ABNORMAL',
            // Hierarchy
            parentId: data.parentId || null,
            // Currency
            currencyPolicy: data.currencyPolicy || 'INHERIT',
            fixedCurrencyCode: data.fixedCurrencyCode || data.currency || null,
            allowedCurrencyCodes: data.allowedCurrencyCodes || [],
            // Lifecycle
            status: data.status || (data.active === false ? 'INACTIVE' : 'ACTIVE'),
            isProtected: (_a = data.isProtected) !== null && _a !== void 0 ? _a : false,
            replacedByAccountId: data.replacedByAccountId || null,
            // Audit
            createdAt: fromFirestoreDate(data.createdAt),
            createdBy: data.createdBy || 'SYSTEM',
            updatedAt: fromFirestoreDate(data.updatedAt),
            updatedBy: data.updatedBy || 'SYSTEM',
            // Legacy compat
            requiresApproval: data.requiresApproval || false,
            requiresCustodyConfirmation: data.requiresCustodyConfirmation || false,
            custodianUserId: data.custodianUserId || null
        });
    }
    /**
     * Convert Account entity to Firestore persistence format
     */
    static toPersistence(entity) {
        return {
            id: entity.id,
            systemCode: entity.systemCode,
            companyId: entity.companyId,
            userCode: entity.userCode,
            name: entity.name,
            description: entity.description,
            // Accounting semantics
            accountRole: entity.accountRole,
            classification: entity.classification,
            balanceNature: entity.balanceNature,
            balanceEnforcement: entity.balanceEnforcement,
            // Hierarchy
            parentId: entity.parentId,
            // Currency
            currencyPolicy: entity.currencyPolicy,
            fixedCurrencyCode: entity.fixedCurrencyCode,
            allowedCurrencyCodes: entity.allowedCurrencyCodes,
            // Lifecycle
            status: entity.status,
            isProtected: entity.isProtected,
            replacedByAccountId: entity.replacedByAccountId,
            // Audit
            createdAt: toFirestoreDate(entity.createdAt),
            createdBy: entity.createdBy,
            updatedAt: toFirestoreDate(entity.updatedAt),
            updatedBy: entity.updatedBy,
            // Legacy compat (for any code still reading these)
            code: entity.userCode,
            type: entity.classification,
            currency: entity.fixedCurrencyCode || '',
            active: entity.status === 'ACTIVE',
            // Approval policy
            requiresApproval: entity.requiresApproval,
            requiresCustodyConfirmation: entity.requiresCustodyConfirmation,
            custodianUserId: entity.custodianUserId
        };
    }
}
exports.AccountMapper = AccountMapper;
/**
 * VoucherMapper - DEPRECATED
 *
 * VoucherEntity V2 now uses built-in toJSON() and fromJSON() methods.
 */
class VoucherMapper {
    /**
     * @deprecated Use VoucherEntity.fromJSON() directly
     */
    static toDomain(data) {
        const { VoucherEntity } = require('../../../domain/accounting/entities/VoucherEntity');
        return VoucherEntity.fromJSON(data);
    }
    /**
     * @deprecated Use voucher.toJSON() directly
     */
    static toPersistence(entity) {
        if (typeof entity.toJSON === 'function') {
            return entity.toJSON();
        }
        return entity;
    }
}
exports.VoucherMapper = VoucherMapper;
//# sourceMappingURL=AccountingMappers.js.map