"use strict";
/**
 * PrismaBankStatementRepository
 *
 * SQL implementation of IBankStatementRepository using Prisma.
 * Handles bank statement storage, retrieval, and line match status updates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaBankStatementRepository = void 0;
const BankStatement_1 = require("../../../../domain/accounting/entities/BankStatement");
class PrismaBankStatementRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // =========================================================================
    // MAPPING HELPERS
    // =========================================================================
    toDomain(record) {
        var _a, _b, _c;
        const lines = (_a = record.lines) !== null && _a !== void 0 ? _a : [];
        return new BankStatement_1.BankStatement(record.id, record.companyId, record.accountNo, (_b = record.accountName) !== null && _b !== void 0 ? _b : '', record.statementDate instanceof Date
            ? record.statementDate.toISOString().split('T')[0]
            : String(record.statementDate).split('T')[0], record.createdAt instanceof Date ? record.createdAt : new Date(record.createdAt), (_c = record.importedBy) !== null && _c !== void 0 ? _c : 'SYSTEM', lines);
    }
    toPrismaLines(lines) {
        return lines.map((line) => {
            var _a, _b, _c;
            return ({
                id: line.id,
                date: line.date,
                description: line.description,
                reference: (_a = line.reference) !== null && _a !== void 0 ? _a : null,
                amount: line.amount,
                balance: (_b = line.balance) !== null && _b !== void 0 ? _b : null,
                matchedLedgerEntryId: (_c = line.matchedLedgerEntryId) !== null && _c !== void 0 ? _c : null,
                matchStatus: line.matchStatus,
            });
        });
    }
    // =========================================================================
    // IMPLEMENTATION
    // =========================================================================
    async save(statement) {
        var _a, _b;
        const existing = await this.prisma.bankStatement.findUnique({
            where: { id: statement.id },
        });
        if (existing) {
            const record = await this.prisma.bankStatement.update({
                where: { id: statement.id },
                data: {
                    accountNo: statement.accountId,
                    accountName: statement.bankName,
                    statementDate: new Date(statement.statementDate),
                    lines: this.toPrismaLines(statement.lines),
                    closingBalance: statement.lines.length > 0
                        ? (_a = statement.lines[statement.lines.length - 1].balance) !== null && _a !== void 0 ? _a : 0
                        : 0,
                },
            });
            return this.toDomain(record);
        }
        const record = await this.prisma.bankStatement.create({
            data: {
                id: statement.id,
                company: { connect: { id: statement.companyId } },
                accountNo: statement.accountId,
                accountName: statement.bankName,
                statementDate: new Date(statement.statementDate),
                openingBalance: 0,
                closingBalance: statement.lines.length > 0
                    ? (_b = statement.lines[statement.lines.length - 1].balance) !== null && _b !== void 0 ? _b : 0
                    : 0,
                currency: 'USD',
                lines: this.toPrismaLines(statement.lines),
                status: 'IMPORTED',
            },
        });
        return this.toDomain(record);
    }
    async findById(companyId, id) {
        const record = await this.prisma.bankStatement.findFirst({
            where: { id, companyId },
        });
        return record ? this.toDomain(record) : null;
    }
    async list(companyId, accountId) {
        const where = { companyId };
        if (accountId) {
            where.accountNo = accountId;
        }
        const records = await this.prisma.bankStatement.findMany({
            where,
            orderBy: { statementDate: 'desc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async updateLineMatch(companyId, statementId, lineId, matchStatus, ledgerEntryId) {
        var _a;
        const statement = await this.prisma.bankStatement.findFirst({
            where: { id: statementId, companyId },
        });
        if (!statement) {
            throw new Error(`BankStatement not found: ${statementId}`);
        }
        const lines = (_a = statement.lines) !== null && _a !== void 0 ? _a : [];
        const lineIndex = lines.findIndex((l) => l.id === lineId);
        if (lineIndex === -1) {
            throw new Error(`BankStatementLine not found: ${lineId}`);
        }
        lines[lineIndex] = Object.assign(Object.assign({}, lines[lineIndex]), { matchStatus, matchedLedgerEntryId: ledgerEntryId !== null && ledgerEntryId !== void 0 ? ledgerEntryId : null });
        await this.prisma.bankStatement.update({
            where: { id: statementId },
            data: { lines: lines },
        });
    }
}
exports.PrismaBankStatementRepository = PrismaBankStatementRepository;
//# sourceMappingURL=PrismaBankStatementRepository.js.map