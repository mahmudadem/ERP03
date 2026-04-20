"use strict";
/**
 * PrismaReconciliationRepository
 *
 * SQL implementation of IReconciliationRepository using Prisma.
 * Handles bank reconciliation storage, retrieval, and updates.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaReconciliationRepository = void 0;
const Reconciliation_1 = require("../../../../domain/accounting/entities/Reconciliation");
class PrismaReconciliationRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    // =========================================================================
    // MAPPING HELPERS
    // =========================================================================
    toDomain(record) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const matchedEntries = (_a = record.matchedEntries) !== null && _a !== void 0 ? _a : {};
        const adjustments = (_b = matchedEntries.adjustments) !== null && _b !== void 0 ? _b : [];
        const bankStatementId = (_c = matchedEntries.bankStatementId) !== null && _c !== void 0 ? _c : '';
        const periodEnd = (_d = matchedEntries.periodEnd) !== null && _d !== void 0 ? _d : record.period;
        const bookBalance = (_e = matchedEntries.bookBalance) !== null && _e !== void 0 ? _e : 0;
        const bankBalance = (_f = matchedEntries.bankBalance) !== null && _f !== void 0 ? _f : 0;
        return new Reconciliation_1.Reconciliation(record.id, record.companyId, record.accountId, bankStatementId, periodEnd, bookBalance, bankBalance, adjustments, (_g = record.status) !== null && _g !== void 0 ? _g : 'IN_PROGRESS', record.completedAt ? (record.completedAt instanceof Date ? record.completedAt : new Date(record.completedAt)) : undefined, (_h = record.completedBy) !== null && _h !== void 0 ? _h : undefined);
    }
    buildMatchedEntries(reconciliation) {
        return {
            bankStatementId: reconciliation.bankStatementId,
            periodEnd: reconciliation.periodEnd,
            bookBalance: reconciliation.bookBalance,
            bankBalance: reconciliation.bankBalance,
            adjustments: reconciliation.adjustments,
        };
    }
    // =========================================================================
    // IMPLEMENTATION
    // =========================================================================
    async save(reconciliation) {
        var _a, _b;
        const record = await this.prisma.reconciliation.create({
            data: {
                id: reconciliation.id,
                company: { connect: { id: reconciliation.companyId } },
                accountId: reconciliation.accountId,
                period: reconciliation.periodEnd,
                status: reconciliation.status,
                matchedEntries: this.buildMatchedEntries(reconciliation),
                discrepancy: reconciliation.bookBalance - reconciliation.bankBalance,
                notes: null,
                completedAt: (_a = reconciliation.completedAt) !== null && _a !== void 0 ? _a : null,
                completedBy: (_b = reconciliation.completedBy) !== null && _b !== void 0 ? _b : null,
            },
        });
        return this.toDomain(record);
    }
    async findLatestForAccount(companyId, accountId) {
        const record = await this.prisma.reconciliation.findFirst({
            where: { companyId, accountId },
            orderBy: { period: 'desc' },
        });
        return record ? this.toDomain(record) : null;
    }
    async list(companyId, accountId) {
        const where = { companyId };
        if (accountId) {
            where.accountId = accountId;
        }
        const records = await this.prisma.reconciliation.findMany({
            where,
            orderBy: { period: 'desc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async update(reconciliation) {
        var _a, _b;
        await this.prisma.reconciliation.update({
            where: { id: reconciliation.id },
            data: {
                status: reconciliation.status,
                matchedEntries: this.buildMatchedEntries(reconciliation),
                discrepancy: reconciliation.bookBalance - reconciliation.bankBalance,
                completedAt: (_a = reconciliation.completedAt) !== null && _a !== void 0 ? _a : null,
                completedBy: (_b = reconciliation.completedBy) !== null && _b !== void 0 ? _b : null,
            },
        });
    }
}
exports.PrismaReconciliationRepository = PrismaReconciliationRepository;
//# sourceMappingURL=PrismaReconciliationRepository.js.map