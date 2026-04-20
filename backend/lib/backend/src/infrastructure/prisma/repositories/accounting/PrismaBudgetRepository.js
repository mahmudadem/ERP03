"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaBudgetRepository = void 0;
const Budget_1 = require("../../../../domain/accounting/entities/Budget");
class PrismaBudgetRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(budget) {
        var _a;
        const record = await this.prisma.budget.create({
            data: {
                id: budget.id,
                companyId: budget.companyId,
                fiscalYearId: budget.fiscalYearId,
                name: budget.name,
                version: budget.version,
                lines: budget.lines,
                status: budget.status,
                createdBy: budget.createdBy,
                createdAt: budget.createdAt,
                updatedAt: (_a = budget.updatedAt) !== null && _a !== void 0 ? _a : new Date(),
            },
        });
        return this.toDomain(record);
    }
    async update(budget) {
        var _a;
        const record = await this.prisma.budget.update({
            where: { id: budget.id },
            data: {
                name: budget.name,
                version: budget.version,
                lines: budget.lines,
                status: budget.status,
                updatedBy: budget.updatedBy,
                updatedAt: (_a = budget.updatedAt) !== null && _a !== void 0 ? _a : new Date(),
            },
        });
        return this.toDomain(record);
    }
    async findById(companyId, id) {
        const record = await this.prisma.budget.findFirst({
            where: { id, companyId },
        });
        return record ? this.toDomain(record) : null;
    }
    async list(companyId, fiscalYearId) {
        const where = { companyId };
        if (fiscalYearId) {
            where.fiscalYearId = fiscalYearId;
        }
        const records = await this.prisma.budget.findMany({
            where,
            orderBy: { createdAt: 'desc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async setStatus(companyId, id, status) {
        await this.prisma.budget.update({
            where: { id, companyId },
            data: { status },
        });
    }
    toDomain(record) {
        var _a, _b, _c, _d, _e, _f, _g;
        const lines = (_a = record.lines) !== null && _a !== void 0 ? _a : [];
        return new Budget_1.Budget(record.id, record.companyId, record.fiscalYearId, (_b = record.name) !== null && _b !== void 0 ? _b : '', (_c = record.version) !== null && _c !== void 0 ? _c : 1, (_d = record.status) !== null && _d !== void 0 ? _d : 'DRAFT', lines, record.createdAt, (_e = record.createdBy) !== null && _e !== void 0 ? _e : '', (_f = record.updatedAt) !== null && _f !== void 0 ? _f : undefined, (_g = record.updatedBy) !== null && _g !== void 0 ? _g : undefined);
    }
}
exports.PrismaBudgetRepository = PrismaBudgetRepository;
//# sourceMappingURL=PrismaBudgetRepository.js.map