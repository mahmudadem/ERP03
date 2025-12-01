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
exports.FirestoreLedgerRepository = void 0;
const admin = __importStar(require("firebase-admin"));
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
const serverTimestamp = () => {
    var _a;
    const fv = (_a = admin.firestore) === null || _a === void 0 ? void 0 : _a.FieldValue;
    return (fv === null || fv === void 0 ? void 0 : fv.serverTimestamp) ? fv.serverTimestamp() : new Date();
};
const toTimestamp = (val) => {
    var _a;
    if (!val)
        return serverTimestamp();
    const date = val instanceof Date ? val : new Date(val);
    const tsCtor = (_a = admin.firestore) === null || _a === void 0 ? void 0 : _a.Timestamp;
    return (tsCtor === null || tsCtor === void 0 ? void 0 : tsCtor.fromDate) ? tsCtor.fromDate(date) : date;
};
class FirestoreLedgerRepository {
    constructor(db) {
        this.db = db;
    }
    col(companyId) {
        return this.db.collection('companies').doc(companyId).collection('ledger');
    }
    async recordForVoucher(voucher) {
        try {
            const batch = this.db.batch();
            voucher.lines.forEach((line) => {
                const id = `${voucher.id}_${line.id}`;
                const debit = line.debitBase || 0;
                const credit = line.creditBase || 0;
                const docRef = this.col(voucher.companyId).doc(id);
                batch.set(docRef, {
                    id,
                    companyId: voucher.companyId,
                    accountId: line.accountId,
                    voucherId: voucher.id,
                    voucherLineId: line.id,
                    date: toTimestamp(voucher.date),
                    debit,
                    credit,
                    createdAt: serverTimestamp(),
                });
            });
            await batch.commit();
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to record ledger for voucher', error);
        }
    }
    async deleteForVoucher(companyId, voucherId) {
        try {
            const snap = await this.col(companyId).where('voucherId', '==', voucherId).get();
            const batch = this.db.batch();
            snap.docs.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to delete ledger for voucher', error);
        }
    }
    async getAccountLedger(companyId, accountId, fromDate, toDate) {
        try {
            const snap = await this.col(companyId)
                .where('accountId', '==', accountId)
                .where('date', '>=', fromDate)
                .where('date', '<=', toDate)
                .orderBy('date', 'asc')
                .get();
            return snap.docs.map((d) => d.data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get account ledger', error);
        }
    }
    async getTrialBalance(companyId, asOfDate) {
        try {
            const end = toTimestamp(asOfDate);
            const snap = await this.col(companyId)
                .where('date', '<=', end)
                .get();
            const map = {};
            snap.docs.forEach((d) => {
                const entry = d.data();
                if (!map[entry.accountId]) {
                    map[entry.accountId] = {
                        accountId: entry.accountId,
                        accountCode: '',
                        accountName: '',
                        debit: 0,
                        credit: 0,
                        balance: 0,
                    };
                }
                map[entry.accountId].debit += entry.debit || 0;
                map[entry.accountId].credit += entry.credit || 0;
            });
            return Object.values(map).map((row) => (Object.assign(Object.assign({}, row), { balance: (row.debit || 0) - (row.credit || 0) })));
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get trial balance', error);
        }
    }
    async getGeneralLedger(companyId, filters) {
        try {
            let ref = this.col(companyId);
            if (filters.accountId)
                ref = ref.where('accountId', '==', filters.accountId);
            if (filters.fromDate)
                ref = ref.where('date', '>=', filters.fromDate);
            if (filters.toDate)
                ref = ref.where('date', '<=', filters.toDate);
            const snap = await ref.orderBy('date', 'asc').get();
            return snap.docs.map((d) => d.data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get general ledger', error);
        }
    }
}
exports.FirestoreLedgerRepository = FirestoreLedgerRepository;
//# sourceMappingURL=FirestoreLedgerRepository.js.map