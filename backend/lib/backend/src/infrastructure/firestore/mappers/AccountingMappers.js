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
 */
const admin = __importStar(require("firebase-admin"));
const Account_1 = require("../../../domain/accounting/entities/Account");
const Voucher_1 = require("../../../domain/accounting/entities/Voucher");
const VoucherLine_1 = require("../../../domain/accounting/entities/VoucherLine");
const toTimestamp = (val) => {
    var _a, _b;
    if (!val)
        return admin.firestore.FieldValue.serverTimestamp();
    const date = val instanceof Date ? val : new Date(val);
    // In emulators Timestamp can be undefined; fall back to raw Date
    return ((_b = (_a = admin.firestore) === null || _a === void 0 ? void 0 : _a.Timestamp) === null || _b === void 0 ? void 0 : _b.fromDate)
        ? admin.firestore.Timestamp.fromDate(date)
        : date;
};
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
            createdAt: toTimestamp(entity.createdAt),
            updatedAt: toTimestamp(entity.updatedAt)
        };
    }
}
exports.AccountMapper = AccountMapper;
class VoucherMapper {
    static toDomain(data) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
        const lines = (data.lines || []).map((l) => {
            var _a, _b, _c, _d, _e, _f;
            const line = new VoucherLine_1.VoucherLine(l.id, l.voucherId, l.accountId, (_a = l.description) !== null && _a !== void 0 ? _a : null, (_b = l.fxAmount) !== null && _b !== void 0 ? _b : 0, (_c = l.baseAmount) !== null && _c !== void 0 ? _c : 0, (_d = l.rateAccToBase) !== null && _d !== void 0 ? _d : 1, l.costCenterId);
            line.debitFx = l.debitFx;
            line.creditFx = l.creditFx;
            line.debitBase = (_e = l.debitBase) !== null && _e !== void 0 ? _e : l.baseAmount;
            line.creditBase = l.creditBase;
            line.lineCurrency = l.lineCurrency;
            line.exchangeRate = (_f = l.exchangeRate) !== null && _f !== void 0 ? _f : l.rateAccToBase;
            line.metadata = l.metadata || {};
            return line;
        });
        const voucher = new Voucher_1.Voucher(data.id, data.companyId, data.type, ((_b = (_a = data.date) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || data.date, data.currency, data.exchangeRate, data.status, (_d = (_c = data.totalDebit) !== null && _c !== void 0 ? _c : data.totalDebitBase) !== null && _d !== void 0 ? _d : 0, (_f = (_e = data.totalCredit) !== null && _e !== void 0 ? _e : data.totalCreditBase) !== null && _f !== void 0 ? _f : 0, data.createdBy, data.reference, lines);
        voucher.voucherNo = data.voucherNo;
        voucher.baseCurrency = data.baseCurrency || data.currency;
        voucher.totalDebitBase = (_g = data.totalDebitBase) !== null && _g !== void 0 ? _g : data.totalDebit;
        voucher.totalCreditBase = (_h = data.totalCreditBase) !== null && _h !== void 0 ? _h : data.totalCredit;
        voucher.createdAt = ((_k = (_j = data.createdAt) === null || _j === void 0 ? void 0 : _j.toDate) === null || _k === void 0 ? void 0 : _k.call(_j)) || data.createdAt;
        voucher.updatedAt = ((_m = (_l = data.updatedAt) === null || _l === void 0 ? void 0 : _l.toDate) === null || _m === void 0 ? void 0 : _m.call(_l)) || data.updatedAt;
        voucher.approvedBy = data.approvedBy;
        voucher.lockedBy = data.lockedBy;
        voucher.description = (_o = data.description) !== null && _o !== void 0 ? _o : null;
        voucher.metadata = data.metadata || {};
        // Form metadata
        voucher.formId = data.formId || null;
        voucher.prefix = data.prefix || null;
        return voucher;
    }
    static toPersistence(entity) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const lines = entity.lines.map(l => {
            var _a, _b, _c, _d, _e, _f;
            return ({
                id: l.id,
                voucherId: l.voucherId,
                accountId: l.accountId,
                description: (_a = l.description) !== null && _a !== void 0 ? _a : null,
                fxAmount: l.fxAmount,
                baseAmount: (_d = (_c = (_b = l.baseAmount) !== null && _b !== void 0 ? _b : l.debitBase) !== null && _c !== void 0 ? _c : l.creditBase) !== null && _d !== void 0 ? _d : 0,
                debitBase: l.debitBase,
                creditBase: l.creditBase,
                rateAccToBase: (_f = (_e = l.rateAccToBase) !== null && _e !== void 0 ? _e : l.exchangeRate) !== null && _f !== void 0 ? _f : 1,
                costCenterId: l.costCenterId || null,
                debitFx: l.debitFx,
                creditFx: l.creditFx,
                lineCurrency: l.lineCurrency,
                exchangeRate: l.exchangeRate,
                metadata: l.metadata || {}
            });
        });
        return {
            id: entity.id,
            companyId: entity.companyId,
            type: entity.type,
            date: toTimestamp(entity.date),
            currency: entity.currency,
            exchangeRate: entity.exchangeRate,
            status: entity.status,
            totalDebit: (_b = (_a = entity.totalDebit) !== null && _a !== void 0 ? _a : entity.totalDebitBase) !== null && _b !== void 0 ? _b : 0,
            totalCredit: (_d = (_c = entity.totalCredit) !== null && _c !== void 0 ? _c : entity.totalCreditBase) !== null && _d !== void 0 ? _d : 0,
            totalDebitBase: (_f = (_e = entity.totalDebitBase) !== null && _e !== void 0 ? _e : entity.totalDebit) !== null && _f !== void 0 ? _f : 0,
            totalCreditBase: (_h = (_g = entity.totalCreditBase) !== null && _g !== void 0 ? _g : entity.totalCredit) !== null && _h !== void 0 ? _h : 0,
            voucherNo: entity.voucherNo,
            baseCurrency: entity.baseCurrency,
            createdBy: entity.createdBy,
            approvedBy: entity.approvedBy || null,
            lockedBy: entity.lockedBy || null,
            reference: entity.reference || null,
            description: (_j = entity.description) !== null && _j !== void 0 ? _j : null,
            metadata: entity.metadata || {},
            // Form metadata
            formId: entity.formId || null,
            prefix: entity.prefix || null,
            createdAt: toTimestamp(entity.createdAt),
            updatedAt: toTimestamp(entity.updatedAt),
            lines: lines
        };
    }
}
exports.VoucherMapper = VoucherMapper;
//# sourceMappingURL=AccountingMappers.js.map