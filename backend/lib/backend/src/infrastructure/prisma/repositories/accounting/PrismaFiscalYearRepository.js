"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaFiscalYearRepository = void 0;
const FiscalYear_1 = require("../../../../domain/accounting/entities/FiscalYear");
class PrismaFiscalYearRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByCompany(companyId) {
        const records = await this.prisma.fiscalYear.findMany({
            where: { companyId },
            orderBy: { startDate: 'desc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async findById(companyId, id) {
        const record = await this.prisma.fiscalYear.findFirst({
            where: { id, companyId },
        });
        return record ? this.toDomain(record) : null;
    }
    async findActiveForDate(companyId, date) {
        const targetDate = new Date(date);
        const records = await this.prisma.fiscalYear.findMany({
            where: {
                companyId,
                status: 'OPEN',
                startDate: { lte: targetDate },
                endDate: { gte: targetDate },
            },
        });
        if (records.length === 0)
            return null;
        return this.toDomain(records[0]);
    }
    async save(fiscalYear) {
        var _a;
        await this.prisma.fiscalYear.create({
            data: {
                id: fiscalYear.id,
                companyId: fiscalYear.companyId,
                name: fiscalYear.name,
                startDate: new Date(fiscalYear.startDate),
                endDate: new Date(fiscalYear.endDate),
                status: fiscalYear.status,
                isLocked: fiscalYear.status === FiscalYear_1.FiscalYearStatus.LOCKED,
                createdAt: (_a = fiscalYear.createdAt) !== null && _a !== void 0 ? _a : new Date(),
                updatedAt: new Date(),
            },
        });
    }
    async update(fiscalYear) {
        await this.prisma.fiscalYear.update({
            where: { id: fiscalYear.id },
            data: {
                name: fiscalYear.name,
                startDate: new Date(fiscalYear.startDate),
                endDate: new Date(fiscalYear.endDate),
                status: fiscalYear.status,
                isLocked: fiscalYear.status === FiscalYear_1.FiscalYearStatus.LOCKED,
                updatedAt: new Date(),
            },
        });
    }
    async delete(companyId, id) {
        await this.prisma.fiscalYear.delete({
            where: { id, companyId },
        });
    }
    toDomain(record) {
        var _a, _b, _c, _d, _e, _f;
        const periods = (_a = record.periods) !== null && _a !== void 0 ? _a : [];
        return new FiscalYear_1.FiscalYear(record.id, record.companyId, record.name, this.formatDate(record.startDate), this.formatDate(record.endDate), (_b = record.status) !== null && _b !== void 0 ? _b : FiscalYear_1.FiscalYearStatus.OPEN, periods, (_c = record.closingVoucherId) !== null && _c !== void 0 ? _c : undefined, record.createdAt, (_d = record.createdBy) !== null && _d !== void 0 ? _d : '', (_e = record.periodScheme) !== null && _e !== void 0 ? _e : FiscalYear_1.PeriodScheme.MONTHLY, (_f = record.specialPeriodsCount) !== null && _f !== void 0 ? _f : 0);
    }
    formatDate(date) {
        if (typeof date === 'string')
            return date;
        return date.toISOString().split('T')[0];
    }
}
exports.PrismaFiscalYearRepository = PrismaFiscalYearRepository;
//# sourceMappingURL=PrismaFiscalYearRepository.js.map