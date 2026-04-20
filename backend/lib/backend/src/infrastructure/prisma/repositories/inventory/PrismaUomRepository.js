"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaUomRepository = void 0;
const Uom_1 = require("../../../../domain/inventory/entities/Uom");
class PrismaUomRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createUom(uom) {
        await this.prisma.uom.create({
            data: Object.assign(Object.assign(Object.assign(Object.assign(Object.assign({ id: uom.id, companyId: uom.companyId, code: uom.code, name: uom.name, baseUomId: null, conversionFactor: 1.0, createdAt: uom.createdAt, updatedAt: uom.updatedAt }, uom.dimension !== undefined && { dimension: uom.dimension }), uom.decimalPlaces !== undefined && { decimalPlaces: uom.decimalPlaces }), uom.active !== undefined && { active: uom.active }), uom.isSystem !== undefined && { isSystem: uom.isSystem }), uom.createdBy !== undefined && { createdBy: uom.createdBy }),
        });
    }
    async updateUom(id, data) {
        await this.prisma.uom.update({
            where: { id },
            data: data,
        });
    }
    async getUom(id) {
        const record = await this.prisma.uom.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getCompanyUoms(companyId, opts) {
        const where = { companyId };
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            where.active = opts.active;
        }
        const records = await this.prisma.uom.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getUomByCode(companyId, code) {
        const record = await this.prisma.uom.findFirst({
            where: { companyId, code },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    toDomain(record) {
        var _a, _b, _c, _d, _e;
        return new Uom_1.Uom({
            id: record.id,
            companyId: record.companyId,
            code: record.code,
            name: record.name,
            dimension: (_a = record.dimension) !== null && _a !== void 0 ? _a : 'OTHER',
            decimalPlaces: (_b = record.decimalPlaces) !== null && _b !== void 0 ? _b : 0,
            active: (_c = record.active) !== null && _c !== void 0 ? _c : true,
            isSystem: (_d = record.isSystem) !== null && _d !== void 0 ? _d : false,
            createdBy: (_e = record.createdBy) !== null && _e !== void 0 ? _e : 'SYSTEM',
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        });
    }
}
exports.PrismaUomRepository = PrismaUomRepository;
//# sourceMappingURL=PrismaUomRepository.js.map