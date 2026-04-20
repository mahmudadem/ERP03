"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaRecurringVoucherTemplateRepository = void 0;
const RecurringVoucherTemplate_1 = require("../../../../domain/accounting/entities/RecurringVoucherTemplate");
class PrismaRecurringVoucherTemplateRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(template) {
        var _a;
        const record = await this.prisma.recurringVoucherTemplate.create({
            data: {
                id: template.id,
                companyId: template.companyId,
                name: template.name,
                schedule: {
                    frequency: template.frequency,
                    dayOfMonth: template.dayOfMonth,
                    startDate: template.startDate,
                    endDate: template.endDate,
                    maxOccurrences: template.maxOccurrences,
                },
                voucherData: {
                    sourceVoucherId: template.sourceVoucherId,
                },
                isActive: template.status === 'ACTIVE',
                nextRunAt: new Date(template.nextGenerationDate),
                createdAt: template.createdAt,
                updatedAt: (_a = template.updatedAt) !== null && _a !== void 0 ? _a : new Date(),
            },
        });
        return this.toDomain(record);
    }
    async update(template) {
        var _a;
        const record = await this.prisma.recurringVoucherTemplate.update({
            where: { id: template.id },
            data: {
                name: template.name,
                schedule: {
                    frequency: template.frequency,
                    dayOfMonth: template.dayOfMonth,
                    startDate: template.startDate,
                    endDate: template.endDate,
                    maxOccurrences: template.maxOccurrences,
                },
                voucherData: {
                    sourceVoucherId: template.sourceVoucherId,
                },
                isActive: template.status === 'ACTIVE',
                nextRunAt: new Date(template.nextGenerationDate),
                updatedAt: (_a = template.updatedAt) !== null && _a !== void 0 ? _a : new Date(),
            },
        });
        return this.toDomain(record);
    }
    async list(companyId) {
        const records = await this.prisma.recurringVoucherTemplate.findMany({
            where: { companyId },
            orderBy: { name: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async findById(companyId, id) {
        const record = await this.prisma.recurringVoucherTemplate.findFirst({
            where: { id, companyId },
        });
        return record ? this.toDomain(record) : null;
    }
    async listDue(companyId, asOfDate) {
        const asOf = new Date(asOfDate);
        const records = await this.prisma.recurringVoucherTemplate.findMany({
            where: {
                companyId,
                isActive: true,
                nextRunAt: { lte: asOf },
            },
            orderBy: { nextRunAt: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    toDomain(record) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
        const schedule = (_a = record.schedule) !== null && _a !== void 0 ? _a : {};
        const voucherData = (_b = record.voucherData) !== null && _b !== void 0 ? _b : {};
        const status = record.isActive ? 'ACTIVE' : 'PAUSED';
        return new RecurringVoucherTemplate_1.RecurringVoucherTemplate(record.id, record.companyId, record.name, (_c = voucherData.sourceVoucherId) !== null && _c !== void 0 ? _c : '', (_d = schedule.frequency) !== null && _d !== void 0 ? _d : 'MONTHLY', (_e = schedule.dayOfMonth) !== null && _e !== void 0 ? _e : 1, (_f = schedule.startDate) !== null && _f !== void 0 ? _f : record.createdAt.toISOString().split('T')[0], (_g = schedule.endDate) !== null && _g !== void 0 ? _g : undefined, (_h = schedule.maxOccurrences) !== null && _h !== void 0 ? _h : undefined, (_j = record.occurrencesGenerated) !== null && _j !== void 0 ? _j : 0, record.nextRunAt
            ? record.nextRunAt.toISOString().split('T')[0]
            : record.createdAt.toISOString().split('T')[0], status, (_k = record.createdBy) !== null && _k !== void 0 ? _k : '', record.createdAt, (_l = record.updatedAt) !== null && _l !== void 0 ? _l : undefined, (_m = record.updatedBy) !== null && _m !== void 0 ? _m : undefined);
    }
}
exports.PrismaRecurringVoucherTemplateRepository = PrismaRecurringVoucherTemplateRepository;
//# sourceMappingURL=PrismaRecurringVoucherTemplateRepository.js.map