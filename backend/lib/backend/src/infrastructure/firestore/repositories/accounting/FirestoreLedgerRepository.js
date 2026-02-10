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
const toTimestampBoundary = (val, endOfDay = false) => {
    const date = val instanceof Date ? val : new Date(val);
    if (endOfDay) {
        date.setHours(23, 59, 59, 999);
    }
    return firestore_1.Timestamp.fromDate(date);
};
const dateToIso = (val) => {
    if (!val)
        return '';
    if (val instanceof Date) {
        const y = val.getFullYear();
        const m = String(val.getMonth() + 1).padStart(2, '0');
        const d = String(val.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }
    if (typeof val === 'string') {
        return val.includes('T') ? val.split('T')[0] : val;
    }
    if (typeof val === 'object' && 'seconds' in val) {
        const d = new Date(val.seconds * 1000);
        return dateToIso(d);
    }
    return String(val);
};
const getBaseAmounts = (entry) => {
    const debit = entry.debit || 0;
    const credit = entry.credit || 0;
    const baseAmount = entry.baseAmount;
    const rate = entry.exchangeRate || 1;
    if (typeof baseAmount === 'number') {
        if (debit > 0)
            return { baseDebit: Math.abs(baseAmount), baseCredit: 0 };
        if (credit > 0)
            return { baseDebit: 0, baseCredit: Math.abs(baseAmount) };
    }
    return {
        baseDebit: Math.abs(debit * rate),
        baseCredit: Math.abs(credit * rate)
    };
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
    async getAccountStatement(companyId, accountId, fromDate, toDate) {
        var _a;
        try {
            const startDate = fromDate || '1900-01-01';
            const endDate = toDate || new Date().toISOString().split('T')[0];
            const startTs = toTimestampBoundary(startDate);
            const endTs = toTimestampBoundary(endDate, true);
            const accountRef = this.db
                .collection('companies')
                .doc(companyId)
                .collection('accounting')
                .doc('Data')
                .collection('accounts')
                .doc(accountId);
            const [accountDoc, companyDoc, openingSnap, rangeSnap] = await Promise.all([
                accountRef.get(),
                this.db.collection('companies').doc(companyId).get(),
                this.col(companyId)
                    .where('accountId', '==', accountId)
                    .where('date', '<', startTs)
                    .get(),
                this.col(companyId)
                    .where('accountId', '==', accountId)
                    .where('date', '>=', startTs)
                    .where('date', '<=', endTs)
                    .orderBy('date', 'asc')
                    .get()
            ]);
            const accountData = accountDoc.exists ? accountDoc.data() : null;
            const accountCode = (accountData === null || accountData === void 0 ? void 0 : accountData.userCode) || (accountData === null || accountData === void 0 ? void 0 : accountData.code) || '';
            const accountName = (accountData === null || accountData === void 0 ? void 0 : accountData.name) || 'Unknown Account';
            const accountCurrency = (accountData === null || accountData === void 0 ? void 0 : accountData.fixedCurrencyCode) || (accountData === null || accountData === void 0 ? void 0 : accountData.currency) || '';
            const baseCurrency = (companyDoc.exists ? (_a = companyDoc.data()) === null || _a === void 0 ? void 0 : _a.baseCurrency : '') || '';
            let openingBalance = 0;
            let openingBalanceBase = 0;
            openingSnap.docs.forEach((doc) => {
                const e = doc.data();
                openingBalance += (e.debit || 0) - (e.credit || 0);
                const { baseDebit, baseCredit } = getBaseAmounts(e);
                openingBalanceBase += baseDebit - baseCredit;
            });
            let running = openingBalance;
            let runningBase = openingBalanceBase;
            let totalDebit = 0;
            let totalCredit = 0;
            let totalBaseDebit = 0;
            let totalBaseCredit = 0;
            const entries = [];
            rangeSnap.docs.forEach((doc) => {
                const e = doc.data();
                const debit = e.debit || 0;
                const credit = e.credit || 0;
                running += debit - credit;
                totalDebit += debit;
                totalCredit += credit;
                const { baseDebit, baseCredit } = getBaseAmounts(e);
                runningBase += baseDebit - baseCredit;
                totalBaseDebit += baseDebit;
                totalBaseCredit += baseCredit;
                entries.push({
                    id: e.id || doc.id,
                    date: dateToIso(e.date),
                    voucherId: e.voucherId,
                    voucherNo: e.voucherNo || e.voucherId || '',
                    description: e.notes || e.description || '',
                    debit,
                    credit,
                    balance: running,
                    baseDebit,
                    baseCredit,
                    baseBalance: runningBase,
                    currency: e.currency,
                    fxAmount: e.amount,
                    exchangeRate: e.exchangeRate
                });
            });
            return {
                accountId,
                accountCode,
                accountName,
                accountCurrency,
                baseCurrency,
                fromDate: dateToIso(startDate),
                toDate: dateToIso(endDate),
                openingBalance,
                openingBalanceBase,
                entries,
                closingBalance: running,
                closingBalanceBase: runningBase,
                totalDebit,
                totalCredit,
                totalBaseDebit,
                totalBaseCredit
            };
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get account statement', error);
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