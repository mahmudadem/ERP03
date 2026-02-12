"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankReconciliationUseCases = void 0;
const uuid_1 = require("uuid");
const BankStatement_1 = require("../../../domain/accounting/entities/BankStatement");
const Reconciliation_1 = require("../../../domain/accounting/entities/Reconciliation");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
class BankReconciliationUseCases {
    constructor(bankStatements, reconciliations, ledgerRepo, voucherRepo, companyRepo, permissionChecker) {
        this.bankStatements = bankStatements;
        this.reconciliations = reconciliations;
        this.ledgerRepo = ledgerRepo;
        this.voucherRepo = voucherRepo;
        this.companyRepo = companyRepo;
        this.permissionChecker = permissionChecker;
    }
    async importStatement(companyId, userId, payload) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        const lines = payload.format === 'ofx'
            ? this.parseOfx(payload.content)
            : this.parseCsv(payload.content, payload.columnMap || {});
        const statement = new BankStatement_1.BankStatement((0, uuid_1.v4)(), companyId, payload.accountId, payload.bankName || 'Bank', payload.statementDate, new Date(), userId, lines);
        // Persist
        await this.bankStatements.save(statement);
        // Auto-match based on ledger entries
        const matchedLines = await this.autoMatch(companyId, statement);
        const updated = statement.withLines(matchedLines);
        await this.bankStatements.save(updated);
        return updated;
    }
    async listStatements(companyId, userId, accountId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        return this.bankStatements.list(companyId, accountId);
    }
    async getReconciliation(companyId, userId, accountId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        const latest = await this.reconciliations.findLatestForAccount(companyId, accountId);
        const statement = latest ? await this.bankStatements.findById(companyId, latest.bankStatementId) : null;
        const ledger = await this.ledgerRepo.getUnreconciledEntries(companyId, accountId);
        return { reconciliation: latest, statement, unreconciledLedger: ledger };
    }
    async manualMatch(companyId, userId, statementId, lineId, ledgerEntryId) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        await this.bankStatements.updateLineMatch(companyId, statementId, lineId, 'MANUAL_MATCHED', ledgerEntryId);
        return { success: true };
    }
    async complete(companyId, userId, accountId, statementId, adjustments = []) {
        await this.permissionChecker.assertOrThrow(userId, companyId, 'accounting.reports.generalLedger.view');
        const statement = await this.bankStatements.findById(companyId, statementId);
        if (!statement)
            throw new Error('Statement not found');
        const periodEnd = statement.statementDate;
        const accountLedger = await this.ledgerRepo.getAccountStatement(companyId, accountId, '1900-01-01', periodEnd);
        const bankBalance = this.computeBankBalance(statement.lines);
        // create adjustments (optional vouchers)
        const reconciliationAdjustments = [];
        for (const adj of adjustments) {
            let voucherId;
            if (adj.debitAccountId && adj.creditAccountId) {
                voucherId = await this.createAdjustmentVoucher(companyId, userId, adj, accountId);
            }
            reconciliationAdjustments.push({
                id: (0, uuid_1.v4)(),
                type: adj.type,
                description: adj.description,
                amount: adj.amount,
                currency: adj.currency,
                voucherId
            });
        }
        const reconciliation = new Reconciliation_1.Reconciliation((0, uuid_1.v4)(), companyId, accountId, statement.id, periodEnd, accountLedger.closingBalance, bankBalance, reconciliationAdjustments, 'COMPLETED', new Date(), userId);
        await this.reconciliations.save(reconciliation);
        // Mark matched ledger entries as reconciled
        const matched = statement.lines.filter((l) => l.matchedLedgerEntryId);
        for (const line of matched) {
            await this.ledgerRepo.markReconciled(companyId, line.matchedLedgerEntryId, reconciliation.id, line.id);
        }
        return reconciliation;
    }
    async autoMatch(companyId, statement) {
        const from = statement.lines.length ? statement.lines[0].date : statement.statementDate;
        const to = statement.lines.length ? statement.lines[statement.lines.length - 1].date : statement.statementDate;
        const ledger = await this.ledgerRepo.getUnreconciledEntries(companyId, statement.accountId, from, to);
        const available = [...ledger];
        const matched = [];
        for (const line of statement.lines) {
            let match = null;
            // exact reference match
            if (line.reference) {
                match = available.find((e) => (e.voucherId && e.voucherId.includes(line.reference)) ||
                    (e.notes && e.notes.includes(line.reference)) ||
                    (e.metadata && Object.values(e.metadata).join(' ').includes(line.reference)));
            }
            if (!match) {
                const amount = Number(line.amount || 0);
                match = available.find((e) => {
                    var _a;
                    const signed = e.side === 'Debit' ? e.amount : -e.amount;
                    const sameAmount = Math.abs(signed - amount) < 0.01;
                    if (!sameAmount)
                        return false;
                    const entryDate = new Date(((_a = e.date) === null || _a === void 0 ? void 0 : _a.toDate) ? e.date.toDate() : e.date);
                    const stmtDate = new Date(line.date);
                    const diff = Math.abs(entryDate.getTime() - stmtDate.getTime()) / (1000 * 3600 * 24);
                    return diff <= 3;
                });
            }
            let status = 'UNMATCHED';
            if (match) {
                status = 'AUTO_MATCHED';
                // remove from available
                const idx = available.findIndex((e) => e.id === match.id);
                if (idx >= 0)
                    available.splice(idx, 1);
            }
            matched.push(Object.assign(Object.assign({}, line), { matchStatus: status, matchedLedgerEntryId: match === null || match === void 0 ? void 0 : match.id }));
        }
        return matched;
    }
    parseCsv(content, columnMap) {
        const map = {
            date: columnMap.date || 'date',
            description: columnMap.description || 'description',
            reference: columnMap.reference || 'reference',
            amount: columnMap.amount || 'amount',
            balance: columnMap.balance || 'balance'
        };
        const lines = content
            .split(/\r?\n/)
            .filter((l) => l.trim().length > 0);
        if (lines.length === 0)
            return [];
        const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
        const get = (row, key) => {
            const idx = headers.indexOf(map[key]);
            return idx >= 0 ? row[idx] : '';
        };
        return lines.slice(1).map((line, idx) => {
            const row = line.split(',').map((c) => c.replace(/^\"|\"$/g, '').trim());
            return {
                id: (0, uuid_1.v4)(),
                date: get(row, 'date'),
                description: get(row, 'description'),
                reference: get(row, 'reference'),
                amount: Number(get(row, 'amount') || 0),
                balance: get(row, 'balance') ? Number(get(row, 'balance')) : undefined,
                matchStatus: 'UNMATCHED'
            };
        });
    }
    parseOfx(content) {
        const lines = [];
        const trnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
        let match;
        while ((match = trnRegex.exec(content))) {
            const block = match[1];
            const getTag = (tag) => {
                const m = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i').exec(block);
                return m ? m[1].trim() : '';
            };
            const date = getTag('DTPOSTED').slice(0, 8); // YYYYMMDD
            const yyyy = date.slice(0, 4);
            const mm = date.slice(4, 6);
            const dd = date.slice(6, 8);
            lines.push({
                id: (0, uuid_1.v4)(),
                date: `${yyyy}-${mm}-${dd}`,
                description: getTag('NAME') || getTag('MEMO'),
                reference: getTag('FITID'),
                amount: Number(getTag('TRNAMT') || 0),
                balance: undefined,
                matchStatus: 'UNMATCHED'
            });
        }
        return lines;
    }
    computeBankBalance(lines) {
        if (!lines.length)
            return 0;
        const lastWithBalance = [...lines].reverse().find((l) => typeof l.balance === 'number');
        if (lastWithBalance && typeof lastWithBalance.balance === 'number') {
            return lastWithBalance.balance;
        }
        return lines.reduce((sum, l) => sum + (Number(l.amount) || 0), 0);
    }
    async createAdjustmentVoucher(companyId, userId, adj, bankAccountId) {
        try {
            const company = await this.companyRepo.findById(companyId);
            const baseCurrency = (company === null || company === void 0 ? void 0 : company.baseCurrency) || adj.currency;
            const amount = Math.abs(adj.amount);
            const debitLine = new VoucherLineEntity_1.VoucherLineEntity(1, adj.debitAccountId || bankAccountId, 'Debit', amount, baseCurrency, amount, adj.currency, 1, adj.description);
            const creditLine = new VoucherLineEntity_1.VoucherLineEntity(2, adj.creditAccountId || bankAccountId, 'Credit', amount, baseCurrency, amount, adj.currency, 1, adj.description);
            const voucher = new VoucherEntity_1.VoucherEntity((0, uuid_1.v4)(), companyId, `RCN-${Date.now()}`, VoucherTypes_1.VoucherType.JOURNAL_ENTRY, new Date().toISOString().slice(0, 10), adj.description, adj.currency, baseCurrency, 1, [debitLine, creditLine], amount, amount, VoucherTypes_1.VoucherStatus.APPROVED, { source: 'bank-reconciliation', adjustmentType: adj.type }, userId, new Date(), userId, new Date(), undefined, undefined, undefined, undefined, undefined, userId, new Date(), undefined, undefined, undefined, undefined);
            await this.voucherRepo.save(voucher);
            await this.ledgerRepo.recordForVoucher(voucher);
            return voucher.id;
        }
        catch (e) {
            console.warn('[BankReconciliation] Failed to create adjustment voucher', e);
            return undefined;
        }
    }
}
exports.BankReconciliationUseCases = BankReconciliationUseCases;
//# sourceMappingURL=BankReconciliationUseCases.js.map