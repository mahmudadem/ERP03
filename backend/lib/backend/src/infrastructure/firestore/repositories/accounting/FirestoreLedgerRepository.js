"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirestoreLedgerRepository = void 0;
const firestore_1 = require("firebase-admin/firestore");
const InfrastructureError_1 = require("../../../errors/InfrastructureError");
// serverTimestamp and toTimestamp moved to usage points for clarity or kept as helpers
const serverTimestamp = () => firestore_1.FieldValue.serverTimestamp();
const toTimestamp = (val) => {
    if (!val)
        return serverTimestamp();
    const date = val instanceof Date ? val : new Date(val);
    return firestore_1.Timestamp.fromDate(date);
};
class FirestoreLedgerRepository {
    constructor(db) {
        this.db = db;
    }
    col(companyId) {
        // MODULAR PATTERN: companies/{id}/accounting (coll) -> Data (doc) -> ledger (coll)
        return this.db.collection('companies').doc(companyId).collection('accounting').doc('Data').collection('ledger');
    }
    async recordForVoucher(voucher, transaction) {
        try {
            const batch = !transaction ? this.db.batch() : null;
            voucher.lines.forEach((line) => {
                const id = `${voucher.id}_${line.id}`;
                const debit = line.debitAmount;
                const credit = line.creditAmount;
                const docRef = this.col(voucher.companyId).doc(id);
                const data = {
                    id,
                    companyId: voucher.companyId,
                    accountId: line.accountId,
                    voucherId: voucher.id,
                    voucherLineId: line.id,
                    date: toTimestamp(voucher.date),
                    debit,
                    credit,
                    currency: line.currency,
                    amount: line.amount,
                    baseCurrency: line.baseCurrency,
                    baseAmount: line.baseAmount,
                    exchangeRate: line.exchangeRate,
                    side: line.side,
                    notes: line.notes || null,
                    costCenterId: line.costCenterId || null,
                    metadata: line.metadata || {},
                    isPosted: true,
                    createdAt: serverTimestamp(),
                };
                if (transaction) {
                    transaction.set(docRef, data);
                }
                else {
                    batch.set(docRef, data);
                }
            });
            if (batch) {
                await batch.commit();
            }
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to record ledger for voucher', error);
        }
    }
    async deleteForVoucher(companyId, voucherId, transaction) {
        try {
            let snap;
            if (transaction) {
                snap = await transaction.get(this.col(companyId).where('voucherId', '==', voucherId));
            }
            else {
                snap = await this.col(companyId).where('voucherId', '==', voucherId).get();
            }
            const batch = !transaction ? this.db.batch() : null;
            snap.docs.forEach((doc) => {
                if (transaction)
                    transaction.delete(doc.ref);
                else
                    batch.delete(doc.ref);
            });
            if (batch) {
                await batch.commit();
            }
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
            const snap = await this.executeQuery(this.col(companyId), filters);
            return snap.docs.map((d) => d.data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get general ledger', error);
        }
    }
    async executeQuery(collection, filters) {
        let ref = collection;
        if (filters.accountId)
            ref = ref.where('accountId', '==', filters.accountId);
        if (filters.voucherId) {
            ref = ref.where('voucherId', '==', filters.voucherId);
            ref = ref.where('isPosted', '==', true);
        }
        if (filters.fromDate) {
            ref = ref.where('date', '>=', toTimestamp(filters.fromDate));
        }
        if (filters.toDate) {
            const end = new Date(filters.toDate);
            end.setHours(23, 59, 59, 999);
            ref = ref.where('date', '<=', firestore_1.Timestamp.fromDate(end));
        }
        return ref.orderBy('date', 'asc').get();
    }
}
exports.FirestoreLedgerRepository = FirestoreLedgerRepository;
//# sourceMappingURL=FirestoreLedgerRepository.js.map