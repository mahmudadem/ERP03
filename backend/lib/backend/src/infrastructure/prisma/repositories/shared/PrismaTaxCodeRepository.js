"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaTaxCodeRepository = void 0;
const TaxCode_1 = require("../../../../domain/shared/entities/TaxCode");
class PrismaTaxCodeRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(taxCode) {
        await this.prisma.taxCode.create({
            data: {
                id: taxCode.id,
                companyId: taxCode.companyId,
                code: taxCode.code,
                name: taxCode.name,
                rate: taxCode.rate,
                type: taxCode.taxType,
                isActive: taxCode.active,
                createdAt: taxCode.createdAt,
                updatedAt: taxCode.updatedAt,
            },
        });
    }
    async update(taxCode) {
        await this.prisma.taxCode.update({
            where: { id: taxCode.id },
            data: {
                code: taxCode.code,
                name: taxCode.name,
                rate: taxCode.rate,
                type: taxCode.taxType,
                isActive: taxCode.active,
                updatedAt: taxCode.updatedAt,
            },
        });
    }
    async getById(companyId, id) {
        const record = await this.prisma.taxCode.findFirst({
            where: { id, companyId },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getByCode(companyId, code) {
        const record = await this.prisma.taxCode.findFirst({
            where: { companyId, code },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async list(companyId, opts) {
        const where = { companyId };
        if (opts === null || opts === void 0 ? void 0 : opts.scope) {
            where.type = opts.scope;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            where.isActive = opts.active;
        }
        const records = await this.prisma.taxCode.findMany({
            where,
            orderBy: { code: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    toDomain(record) {
        return new TaxCode_1.TaxCode({
            id: record.id,
            companyId: record.companyId,
            code: record.code,
            name: record.name,
            rate: record.rate,
            taxType: record.type,
            scope: 'BOTH',
            active: record.isActive,
            createdBy: 'SYSTEM',
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        });
    }
}
exports.PrismaTaxCodeRepository = PrismaTaxCodeRepository;
//# sourceMappingURL=PrismaTaxCodeRepository.js.map