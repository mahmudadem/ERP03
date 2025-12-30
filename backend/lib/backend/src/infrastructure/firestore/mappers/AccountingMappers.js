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
exports.VoucherMapper = exports.AccountMapper = void 0;
/**
 * AccountingMappers.ts
 *
 * Purpose:
 * Transforms Accounting Domain Entities to/from Firestore structure.
 *
 * V2 ONLY - Legacy Voucher/VoucherLine classes have been removed.
 * VoucherEntity now uses built-in toJSON()/fromJSON() for persistence.
 */
const admin = __importStar(require("firebase-admin"));
const Account_1 = require("../../../domain/accounting/entities/Account");
/**
 * Safely convert any date value to Firestore-compatible format.
 * Handles: Date objects, ISO strings, timestamps, or null/undefined.
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
 * Account Mapper
 * Used for converting Account entities to/from Firestore
 */
class AccountMapper {
    static toDomain(data) {
        var _a, _b, _c, _d;
        return new Account_1.Account(data.companyId, data.id, data.code, data.name, data.type, data.currency, data.isProtected, data.active, data.parentId, ((_b = (_a = data.createdAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || data.createdAt, ((_d = (_c = data.updatedAt) === null || _c === void 0 ? void 0 : _c.toDate) === null || _d === void 0 ? void 0 : _d.call(_c)) || data.updatedAt);
    }
    static toPersistence(entity) {
        return {
            companyId: entity.companyId,
            id: entity.id,
            code: entity.code,
            name: entity.name,
            type: entity.type,
            currency: entity.currency,
            isProtected: entity.isProtected,
            active: entity.active,
            parentId: entity.parentId || null,
            createdAt: toFirestoreDate(entity.createdAt),
            updatedAt: toFirestoreDate(entity.updatedAt)
        };
    }
}
exports.AccountMapper = AccountMapper;
/**
 * VoucherMapper - DEPRECATED
 *
 * VoucherEntity V2 now uses built-in toJSON() and fromJSON() methods.
 * The FirestoreVoucherRepositoryV2 uses these directly.
 *
 * This class is kept for backwards compatibility with any remaining
 * code that might reference it, but should not be used for new code.
 */
class VoucherMapper {
    /**
     * @deprecated Use VoucherEntity.fromJSON() directly
     */
    static toDomain(data) {
        // Import dynamically to avoid circular deps in case of removal
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
        // Fallback for any edge cases
        return entity;
    }
}
exports.VoucherMapper = VoucherMapper;
//# sourceMappingURL=AccountingMappers.js.map