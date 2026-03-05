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
const toMillis = (val) => {
    if (!val)
        return 0;
    if (typeof val === 'number')
        return Number.isFinite(val) ? val : 0;
    if (val instanceof Date)
        return val.getTime();
    if (typeof val === 'string') {
        const parsed = Date.parse(val);
        return Number.isNaN(parsed) ? 0 : parsed;
    }
    if (typeof val === 'object' && 'seconds' in val) {
        const seconds = Number(val.seconds || 0);
        const nanos = Number(val.nanoseconds || 0);
        return (seconds * 1000) + Math.floor(nanos / 1000000);
    }
    return 0;
};
const compareVoucherNo = (a, b) => String(a || '').localeCompare(String(b || ''), undefined, { numeric: true, sensitivity: 'base' });
const compareAccountStatementRows = (a, b) => {
    const dateCmp = String(a.date || '').localeCompare(String(b.date || ''));
    if (dateCmp !== 0)
        return dateCmp;
    const timeCmp = a.timeMs - b.timeMs;
    if (timeCmp !== 0)
        return timeCmp;
    const voucherCmp = compareVoucherNo(a.voucherNo, b.voucherNo);
    if (voucherCmp !== 0)
        return voucherCmp;
    return String(a.id || '').localeCompare(String(b.id || ''));
};
const getAmountsBySide = (entry, targetAccountCurrency, baseCurrency) => {
    var _a, _b, _c, _d;
    const side = entry.side || 'Debit';
    const entryCurrency = (entry.currency || '').toUpperCase();
    const baseCur = (baseCurrency || '').toUpperCase();
    const targetCurrency = (targetAccountCurrency || '').toUpperCase();
    // Use stored amounts
    let accountAmount = (_b = (_a = entry.amount) !== null && _a !== void 0 ? _a : entry.fxAmount) !== null && _b !== void 0 ? _b : 0;
    let baseAmount = (_c = entry.baseAmount) !== null && _c !== void 0 ? _c : 0;
    // REVALUATION FIX: If this is a revaluation adjustment (base currency entry hitting non-base account)
    // we must ensure it doesn't affect the account's primary currency balance.
    const isReval = ((_d = entry.metadata) === null || _d === void 0 ? void 0 : _d.isRevaluation) === true ||
        (entryCurrency === baseCur && targetCurrency !== '' && targetCurrency !== baseCur);
    if (isReval) {
        accountAmount = 0;
    }
    else if (targetCurrency && entryCurrency && entryCurrency !== targetCurrency) {
        // If the ledger stored amount in a different currency than the account (e.g., base),
        // convert from baseAmount using exchangeRate when possible.
        if (baseAmount && entry.exchangeRate) {
            accountAmount = baseAmount / entry.exchangeRate;
        }
    }
    // If baseAmount missing but we have amount and exchange rate, derive base
    if (!baseAmount && accountAmount && entry.exchangeRate) {
        baseAmount = accountAmount * entry.exchangeRate;
    }
    const debit = side === 'Debit' ? Math.abs(accountAmount) : 0;
    const credit = side === 'Credit' ? Math.abs(accountAmount) : 0;
    const baseDebit = side === 'Debit' ? Math.abs(baseAmount) : 0;
    const baseCredit = side === 'Credit' ? Math.abs(baseAmount) : 0;
    return { debit, credit, baseDebit, baseCredit, side };
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
                    reconciliationId: null,
                    bankStatementLineId: null,
                    createdAt: serverTimestamp(),
                    postingPeriodNo: voucher.postingPeriodNo || null,
                    isSpecial: (voucher.postingPeriodNo || 0) >= 13
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
    async getTrialBalance(companyId, asOfDate, excludeSpecialPeriods) {
        try {
            const end = toTimestampBoundary(asOfDate, true);
            const snap = await this.col(companyId)
                .where('date', '<=', end)
                .get();
            const map = {};
            snap.docs.forEach((d) => {
                const entry = d.data();
                if (excludeSpecialPeriods && (entry.postingPeriodNo || 0) >= 13)
                    return;
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
    async getAccountStatement(companyId, accountId, fromDate, toDate, options) {
        var _a, _b;
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
            const includeUnposted = (_a = options === null || options === void 0 ? void 0 : options.includeUnposted) !== null && _a !== void 0 ? _a : false;
            const ledgerCol = this.col(companyId);
            const applyPostingFilter = (query) => {
                if (includeUnposted)
                    return query;
                return query.where('isPosted', '==', true);
            };
            const [accountDoc, companyDoc, openingSnap, rangeSnap] = await Promise.all([
                accountRef.get(),
                this.db.collection('companies').doc(companyId).get(),
                applyPostingFilter(ledgerCol)
                    .where('accountId', '==', accountId)
                    .where('date', '<', startTs)
                    .get(),
                applyPostingFilter(ledgerCol)
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
            const baseCurrency = (companyDoc.exists ? (_b = companyDoc.data()) === null || _b === void 0 ? void 0 : _b.baseCurrency : '') || '';
            const selectedCostCenterId = ((options === null || options === void 0 ? void 0 : options.costCenterId) || '').trim();
            const selectedCurrency = String((options === null || options === void 0 ? void 0 : options.currency) || '').trim().toUpperCase();
            const matchesOptionalFilters = (entry) => {
                if (selectedCostCenterId && String((entry === null || entry === void 0 ? void 0 : entry.costCenterId) || '') !== selectedCostCenterId) {
                    return false;
                }
                if (selectedCurrency) {
                    const entryCurrency = String((entry === null || entry === void 0 ? void 0 : entry.currency) || accountCurrency || '').toUpperCase();
                    if (entryCurrency !== selectedCurrency) {
                        return false;
                    }
                }
                return true;
            };
            let openingBalance = 0;
            let openingBalanceBase = 0;
            openingSnap.docs.forEach((doc) => {
                const e = doc.data();
                if (!matchesOptionalFilters(e))
                    return;
                const { debit, credit, baseDebit, baseCredit, side } = getAmountsBySide(e, accountCurrency, baseCurrency);
                const signedAccount = side === 'Debit' ? debit : -credit;
                const signedBase = side === 'Debit' ? baseDebit : -baseCredit;
                openingBalance += signedAccount;
                openingBalanceBase += signedBase;
            });
            let running = openingBalance;
            let runningBase = openingBalanceBase;
            let totalDebit = 0;
            let totalCredit = 0;
            let totalBaseDebit = 0;
            let totalBaseCredit = 0;
            const entries = [];
            const orderedRows = rangeSnap.docs
                .map((doc) => {
                const e = doc.data();
                const date = dateToIso(e.date);
                const timeMs = toMillis(e.createdAt) || toMillis(e.postedAt) || toMillis(e.date);
                return { doc, e, date, timeMs };
            })
                .filter(({ e }) => matchesOptionalFilters(e))
                .sort((a, b) => compareAccountStatementRows({
                date: a.date,
                timeMs: a.timeMs,
                voucherNo: a.e.voucherNo || a.e.voucherId || '',
                id: a.e.id || a.doc.id
            }, {
                date: b.date,
                timeMs: b.timeMs,
                voucherNo: b.e.voucherNo || b.e.voucherId || '',
                id: b.e.id || b.doc.id
            }));
            orderedRows.forEach(({ doc, e, date, timeMs }) => {
                const { debit, credit, baseDebit, baseCredit, side } = getAmountsBySide(e, accountCurrency, baseCurrency);
                running += side === 'Debit' ? debit : -credit;
                runningBase += side === 'Debit' ? baseDebit : -baseCredit;
                totalDebit += debit;
                totalCredit += credit;
                totalBaseDebit += baseDebit;
                totalBaseCredit += baseCredit;
                entries.push({
                    id: e.id || doc.id,
                    date,
                    time: timeMs ? new Date(timeMs).toISOString() : undefined,
                    voucherId: e.voucherId,
                    voucherNo: e.voucherNo || e.voucherId || '',
                    description: e.notes || e.description || '',
                    debit,
                    credit,
                    balance: running,
                    baseDebit,
                    baseCredit,
                    baseBalance: runningBase,
                    currency: accountCurrency || e.currency,
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
        if (filters.costCenterId) {
            ref = ref.where('costCenterId', '==', filters.costCenterId);
        }
        let query = ref.orderBy('date', 'asc');
        if (filters.limit) {
            query = query.limit(filters.limit);
        }
        if (filters.offset) {
            // Note: Firestore doesn't have offset. For real pagination we need startAfter(doc).
            // For simplicity in this V1 skip logic, we use offset if repo doesn't support cursors yet.
            query = query.offset(filters.offset);
        }
        return query.get();
    }
    async getUnreconciledEntries(companyId, accountId, fromDate, toDate) {
        try {
            let query = this.col(companyId).where('accountId', '==', accountId);
            if (fromDate) {
                query = query.where('date', '>=', toTimestampBoundary(fromDate));
            }
            if (toDate) {
                query = query.where('date', '<=', toTimestampBoundary(toDate, true));
            }
            query = query.where('isPosted', '==', true).where('reconciliationId', '==', null);
            const snap = await query.orderBy('date', 'asc').get();
            return snap.docs.map((d) => d.data());
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get unreconciled ledger entries', error);
        }
    }
    async markReconciled(companyId, ledgerEntryId, reconciliationId, bankStatementLineId) {
        try {
            await this.col(companyId).doc(ledgerEntryId).set({
                reconciliationId,
                bankStatementLineId,
                metadata: { reconciliationId, bankStatementLineId }
            }, { merge: true });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to mark ledger entry as reconciled', error);
        }
    }
    async getForeignBalances(companyId, asOfDate, accountIds) {
        var _a;
        try {
            const end = toTimestampBoundary(asOfDate, true);
            const companyDoc = await this.db.collection('companies').doc(companyId).get();
            const baseCurrency = (companyDoc.exists ? (_a = companyDoc.data()) === null || _a === void 0 ? void 0 : _a.baseCurrency : '') || '';
            let query = this.col(companyId)
                .where('date', '<=', end);
            if (accountIds && accountIds.length > 0) {
                query = query.where('accountId', 'in', accountIds);
            }
            const snap = await query.get();
            const aggregates = {};
            snap.docs.forEach((d) => {
                const entry = d.data();
                const entryCurrency = (entry.currency || '').toUpperCase();
                const entryMetadata = entry.metadata || {};
                const isReval = entryMetadata.isRevaluation === true || (entryCurrency === baseCurrency.toUpperCase() && !!entryMetadata.originalCurrency);
                // Skip base currency entries UNLESS they are revaluation adjustments for a foreign account
                if (entryCurrency === baseCurrency.toUpperCase() && !isReval)
                    return;
                // For revaluation lines, the "real" currency we are revaluing is in metadata
                const currencyToBucket = isReval ? (entryMetadata.originalCurrency || '').toUpperCase() : entryCurrency;
                // If we still end up with base currency (e.g. reval offset line on Gain/Loss account), skip it
                if (!currencyToBucket || currencyToBucket === baseCurrency.toUpperCase())
                    return;
                const key = `${entry.accountId}_${currencyToBucket}`;
                const side = entry.side || 'Debit';
                // Revaluation entries have 0 impact on foreign currency balance (they only adjust base equivalent)
                const amount = isReval ? 0 : (entry.amount || 0);
                const baseAmount = entry.baseAmount || 0;
                if (!aggregates[key]) {
                    aggregates[key] = { foreignBalance: 0, baseBalance: 0 };
                }
                const signedAmount = side === 'Debit' ? amount : -amount;
                const signedBase = side === 'Debit' ? baseAmount : -baseAmount;
                aggregates[key].foreignBalance += signedAmount;
                aggregates[key].baseBalance += signedBase;
            });
            return Object.entries(aggregates).map(([key, bal]) => {
                const [accountId, currency] = key.split('_');
                return {
                    accountId,
                    currency,
                    foreignBalance: bal.foreignBalance,
                    baseBalance: bal.baseBalance
                };
            });
        }
        catch (error) {
            throw new InfrastructureError_1.InfrastructureError('Failed to get foreign balances', error);
        }
    }
}
exports.FirestoreLedgerRepository = FirestoreLedgerRepository;
//# sourceMappingURL=FirestoreLedgerRepository.js.map