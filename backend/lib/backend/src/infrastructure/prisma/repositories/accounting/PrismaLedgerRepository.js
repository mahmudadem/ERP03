"use strict";
/**
 * PrismaLedgerRepository
 *
 * SQL implementation of ILedgerRepository using Prisma.
 * Handles ledger entry recording, trial balance, general ledger queries,
 * account statements, and reconciliation-related operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaLedgerRepository = void 0;
class PrismaLedgerRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // =========================================================================
    // MAPPING HELPERS
    // =========================================================================
    toDomain(record) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        return {
            id: record.id,
            companyId: record.companyId,
            accountId: record.accountId,
            voucherId: record.voucherId || '',
            voucherLineId: record.voucherLineId || 0,
            date: record.date instanceof Date ? record.date.toISOString() : record.date,
            debit: (_a = record.debit) !== null && _a !== void 0 ? _a : 0,
            credit: (_b = record.credit) !== null && _b !== void 0 ? _b : 0,
            currency: record.currency,
            amount: (_c = record.amount) !== null && _c !== void 0 ? _c : 0,
            baseCurrency: record.baseCurrency,
            baseAmount: (_d = record.baseAmount) !== null && _d !== void 0 ? _d : 0,
            exchangeRate: (_e = record.exchangeRate) !== null && _e !== void 0 ? _e : 1.0,
            side: record.side,
            notes: record.notes || record.description || undefined,
            costCenterId: record.costCenterId || undefined,
            metadata: record.metadata || undefined,
            isPosted: (_f = record.isPosted) !== null && _f !== void 0 ? _f : true,
            reconciliationId: record.reconciliationId || undefined,
            bankStatementLineId: record.bankStatementLineId || undefined,
            createdAt: record.createdAt instanceof Date ? record.createdAt : new Date(record.createdAt),
            postingPeriodNo: (_g = record.postingPeriodNo) !== null && _g !== void 0 ? _g : null,
            isSpecial: (_h = record.isSpecial) !== null && _h !== void 0 ? _h : false,
        };
    }
    // =========================================================================
    // MUTATION METHODS
    // =========================================================================
    async recordForVoucher(voucher, transaction) {
        const tx = transaction || this.prisma;
        const dateValue = typeof voucher.date === 'string' ? new Date(voucher.date) : voucher.date;
        const entries = voucher.lines.map((line, index) => ({
            id: `${voucher.id}-ledger-${index + 1}`,
            company: { connect: { id: voucher.companyId } },
            account: { connect: { id: line.accountId } },
            voucherId: voucher.id,
            date: dateValue,
            description: line.notes || voucher.description || null,
            debit: line.side === 'Debit' ? line.baseAmount : 0,
            credit: line.side === 'Credit' ? line.baseAmount : 0,
            balance: 0,
            currency: line.currency,
            baseCurrency: line.baseCurrency,
            exchangeRate: line.exchangeRate,
            postingSeq: index + 1,
        }));
        await tx.ledgerEntry.createMany({
            data: entries,
        });
    }
    async deleteForVoucher(companyId, voucherId, transaction) {
        const tx = transaction || this.prisma;
        await tx.ledgerEntry.deleteMany({
            where: { companyId, voucherId },
        });
    }
    // =========================================================================
    // QUERY METHODS
    // =========================================================================
    async getAccountLedger(companyId, accountId, fromDate, toDate) {
        const records = await this.prisma.ledgerEntry.findMany({
            where: {
                companyId,
                accountId,
                date: {
                    gte: new Date(fromDate),
                    lte: new Date(toDate),
                },
            },
            orderBy: [{ date: 'asc' }, { postingSeq: 'asc' }],
        });
        let runningBalance = 0;
        return records.map((r) => {
            const entry = this.toDomain(r);
            runningBalance += entry.debit - entry.credit;
            return entry;
        });
    }
    async getTrialBalance(companyId, asOfDate, excludeSpecialPeriods) {
        var _a, _b;
        const date = new Date(asOfDate);
        const ledgerEntries = await this.prisma.ledgerEntry.findMany({
            where: {
                companyId,
                date: { lte: date },
            },
            include: { account: true },
            orderBy: [{ accountId: 'asc' }],
        });
        const accountMap = new Map();
        for (const entry of ledgerEntries) {
            if (!entry.account)
                continue;
            const key = entry.accountId;
            if (!accountMap.has(key)) {
                accountMap.set(key, {
                    accountId: entry.accountId,
                    accountCode: entry.account.userCode,
                    accountName: entry.account.name,
                    debit: 0,
                    credit: 0,
                });
            }
            const row = accountMap.get(key);
            row.debit += (_a = entry.debit) !== null && _a !== void 0 ? _a : 0;
            row.credit += (_b = entry.credit) !== null && _b !== void 0 ? _b : 0;
        }
        return Array.from(accountMap.values()).map((row) => ({
            accountId: row.accountId,
            accountCode: row.accountCode,
            accountName: row.accountName,
            debit: row.debit,
            credit: row.credit,
            balance: row.debit - row.credit,
        }));
    }
    async getGeneralLedger(companyId, filters) {
        const where = { companyId };
        if (filters.accountId) {
            where.accountId = filters.accountId;
        }
        if (filters.voucherId) {
            where.voucherId = filters.voucherId;
        }
        if (filters.fromDate) {
            where.date = Object.assign(Object.assign({}, (where.date || {})), { gte: new Date(filters.fromDate) });
        }
        if (filters.toDate) {
            where.date = Object.assign(Object.assign({}, (where.date || {})), { lte: new Date(filters.toDate) });
        }
        if (filters.voucherType) {
            where.voucher = { type: filters.voucherType };
        }
        if (filters.costCenterId) {
            where.costCenterId = filters.costCenterId;
        }
        const records = await this.prisma.ledgerEntry.findMany({
            where,
            orderBy: [{ date: 'asc' }, { postingSeq: 'asc' }],
            take: filters.limit || 1000,
            skip: filters.offset || 0,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getAccountStatement(companyId, accountId, fromDate, toDate, options) {
        var _a, _b;
        const where = { companyId, accountId };
        if (options === null || options === void 0 ? void 0 : options.costCenterId) {
            where.costCenterId = options.costCenterId;
        }
        if (options === null || options === void 0 ? void 0 : options.currency) {
            where.currency = options.currency;
        }
        const dateFrom = new Date(fromDate);
        const dateTo = new Date(toDate);
        // Get entries within the period
        const entries = await this.prisma.ledgerEntry.findMany({
            where: Object.assign(Object.assign({}, where), { date: { gte: dateFrom, lte: dateTo } }),
            orderBy: [{ date: 'asc' }, { postingSeq: 'asc' }],
        });
        // Calculate opening balance (all entries before the period)
        const openingEntries = await this.prisma.ledgerEntry.findMany({
            where: Object.assign(Object.assign({}, where), { date: { lt: dateFrom } }),
        });
        let openingBalance = 0;
        for (const e of openingEntries) {
            openingBalance += ((_a = e.debit) !== null && _a !== void 0 ? _a : 0) - ((_b = e.credit) !== null && _b !== void 0 ? _b : 0);
        }
        // Get account info
        const account = await this.prisma.account.findFirst({
            where: { id: accountId, companyId },
        });
        const company = await this.prisma.company.findFirst({
            where: { id: companyId },
        });
        // Build statement entries with running balance
        let runningBalance = openingBalance;
        let runningBaseBalance = openingBalance;
        let totalDebit = 0;
        let totalCredit = 0;
        let totalBaseDebit = 0;
        let totalBaseCredit = 0;
        const statementEntries = entries.map((r) => {
            var _a, _b, _c;
            const debit = (_a = r.debit) !== null && _a !== void 0 ? _a : 0;
            const credit = (_b = r.credit) !== null && _b !== void 0 ? _b : 0;
            runningBalance += debit - credit;
            totalDebit += debit;
            totalCredit += credit;
            const baseDebit = r.baseAmount && debit > 0 ? r.baseAmount : 0;
            const baseCredit = r.baseAmount && credit > 0 ? r.baseAmount : 0;
            runningBaseBalance += baseDebit - baseCredit;
            totalBaseDebit += baseDebit;
            totalBaseCredit += baseCredit;
            return {
                id: r.id,
                date: r.date instanceof Date ? r.date.toISOString().split('T')[0] : String(r.date).split('T')[0],
                voucherId: r.voucherId || '',
                voucherNo: '',
                description: r.description || '',
                debit,
                credit,
                balance: runningBalance,
                baseDebit: baseDebit || undefined,
                baseCredit: baseCredit || undefined,
                baseBalance: runningBaseBalance || undefined,
                currency: r.currency,
                fxAmount: debit || credit,
                exchangeRate: (_c = r.exchangeRate) !== null && _c !== void 0 ? _c : 1.0,
            };
        });
        const closingBalance = openingBalance + totalDebit - totalCredit;
        const closingBalanceBase = openingBalance + totalBaseDebit - totalBaseCredit;
        return {
            accountId,
            accountCode: (account === null || account === void 0 ? void 0 : account.userCode) || '',
            accountName: (account === null || account === void 0 ? void 0 : account.name) || '',
            accountCurrency: (account === null || account === void 0 ? void 0 : account.fixedCurrencyCode) || (company === null || company === void 0 ? void 0 : company.baseCurrency) || 'USD',
            baseCurrency: (company === null || company === void 0 ? void 0 : company.baseCurrency) || 'USD',
            fromDate,
            toDate,
            openingBalance,
            openingBalanceBase: openingBalance,
            entries: statementEntries,
            closingBalance,
            closingBalanceBase,
            totalDebit,
            totalCredit,
            totalBaseDebit,
            totalBaseCredit,
        };
    }
    async getUnreconciledEntries(companyId, accountId, fromDate, toDate) {
        const where = {
            companyId,
            accountId,
            reconciliationId: null,
        };
        if (fromDate) {
            where.date = Object.assign(Object.assign({}, (where.date || {})), { gte: new Date(fromDate) });
        }
        if (toDate) {
            where.date = Object.assign(Object.assign({}, (where.date || {})), { lte: new Date(toDate) });
        }
        const records = await this.prisma.ledgerEntry.findMany({
            where,
            orderBy: [{ date: 'asc' }, { postingSeq: 'asc' }],
        });
        return records.map((r) => this.toDomain(r));
    }
    async markReconciled(companyId, ledgerEntryId, reconciliationId, bankStatementLineId) {
        await this.prisma.ledgerEntry.update({
            where: { id: ledgerEntryId },
            data: {
                reconciliationId,
                bankStatementLineId,
            },
        });
    }
    async getForeignBalances(companyId, asOfDate, accountIds) {
        var _a, _b;
        const where = {
            companyId,
            date: { lte: asOfDate },
        };
        if (accountIds && accountIds.length > 0) {
            where.accountId = { in: accountIds };
        }
        const entries = await this.prisma.ledgerEntry.findMany({
            where,
        });
        const balanceMap = new Map();
        for (const entry of entries) {
            const key = `${entry.accountId}-${entry.currency}`;
            if (!balanceMap.has(key)) {
                balanceMap.set(key, {
                    accountId: entry.accountId,
                    currency: entry.currency,
                    foreignBalance: 0,
                    baseBalance: 0,
                });
            }
            const row = balanceMap.get(key);
            const amount = (_a = entry.amount) !== null && _a !== void 0 ? _a : 0;
            const baseAmount = (_b = entry.baseAmount) !== null && _b !== void 0 ? _b : 0;
            if (entry.debit > 0) {
                row.foreignBalance += amount;
                row.baseBalance += baseAmount;
            }
            else if (entry.credit > 0) {
                row.foreignBalance -= amount;
                row.baseBalance -= baseAmount;
            }
        }
        return Array.from(balanceMap.values()).map((row) => ({
            accountId: row.accountId,
            currency: row.currency,
            foreignBalance: row.foreignBalance,
            baseBalance: row.baseBalance,
        }));
    }
}
exports.PrismaLedgerRepository = PrismaLedgerRepository;
//# sourceMappingURL=PrismaLedgerRepository.js.map