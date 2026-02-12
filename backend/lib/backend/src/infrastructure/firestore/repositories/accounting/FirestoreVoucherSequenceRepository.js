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
exports.FirestoreVoucherSequenceRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const formatNumber = (prefix, next, year, format) => {
    const counter = String(next).padStart(4, '0');
    const y = year ? String(year) : '';
    if (format) {
        return format
            .replace('{PREFIX}', prefix)
            .replace('{YYYY}', y)
            .replace('{COUNTER:4}', counter)
            .replace('{COUNTER}', counter);
    }
    return year ? `${prefix}-${year}-${counter}` : `${prefix}-${counter}`;
};
class FirestoreVoucherSequenceRepository {
    constructor(db) {
        this.db = db;
    }
    col(companyId) {
        return this.db
            .collection('companies')
            .doc(companyId)
            .collection('accounting')
            .doc('Data')
            .collection('voucherSequences');
    }
    async getNextNumber(companyId, prefix, year, format) {
        const id = year ? `${prefix}-${year}` : prefix;
        const docRef = this.col(companyId).doc(id);
        return this.db.runTransaction(async (txn) => {
            const snap = await txn.get(docRef);
            const data = snap.exists ? snap.data() : null;
            const lastNumber = (data === null || data === void 0 ? void 0 : data.lastNumber) || 0;
            const next = lastNumber + 1;
            const seq = {
                id,
                companyId,
                prefix,
                year,
                lastNumber: next,
                format: format || (data === null || data === void 0 ? void 0 : data.format) || '',
                updatedAt: new Date()
            };
            txn.set(docRef, {
                prefix,
                year: year || null,
                lastNumber: next,
                format: seq.format || null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return formatNumber(prefix, next, year, seq.format);
        });
    }
    async getCurrentSequence(companyId, prefix, year) {
        var _a, _b;
        const id = year ? `${prefix}-${year}` : prefix;
        const snap = await this.col(companyId).doc(id).get();
        if (!snap.exists)
            return null;
        const d = snap.data();
        return {
            id,
            companyId,
            prefix: d.prefix,
            year: d.year || undefined,
            lastNumber: d.lastNumber || 0,
            format: d.format || '',
            updatedAt: ((_b = (_a = d.updatedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date()
        };
    }
    async setNextNumber(companyId, prefix, nextNumber, year, format) {
        const id = year ? `${prefix}-${year}` : prefix;
        await this.col(companyId).doc(id).set({
            prefix,
            year: year || null,
            lastNumber: Math.max(0, nextNumber - 1),
            format: format || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
    async listSequences(companyId) {
        const snap = await this.col(companyId).orderBy('prefix').get();
        return snap.docs.map((d) => {
            var _a, _b;
            const data = d.data();
            return {
                id: d.id,
                companyId,
                prefix: data.prefix,
                year: data.year || undefined,
                lastNumber: data.lastNumber || 0,
                format: data.format || '',
                updatedAt: ((_b = (_a = data.updatedAt) === null || _a === void 0 ? void 0 : _a.toDate) === null || _b === void 0 ? void 0 : _b.call(_a)) || new Date()
            };
        });
    }
}
exports.FirestoreVoucherSequenceRepository = FirestoreVoucherSequenceRepository;
//# sourceMappingURL=FirestoreVoucherSequenceRepository.js.map