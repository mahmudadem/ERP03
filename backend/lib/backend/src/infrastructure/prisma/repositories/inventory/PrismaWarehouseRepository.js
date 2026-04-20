"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaWarehouseRepository = void 0;
const Warehouse_1 = require("../../../../domain/inventory/entities/Warehouse");
class PrismaWarehouseRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createWarehouse(warehouse) {
        await this.prisma.warehouse.create({
            data: {
                id: warehouse.id,
                code: warehouse.code,
                name: warehouse.name,
                companyId: warehouse.companyId,
                parentId: warehouse.parentId || null,
                address: warehouse.address || null,
                active: warehouse.active,
                isDefault: warehouse.isDefault,
                createdAt: warehouse.createdAt,
                updatedAt: warehouse.updatedAt,
            },
        });
    }
    async updateWarehouse(id, data) {
        await this.prisma.warehouse.update({
            where: { id },
            data: data,
        });
    }
    async getWarehouse(id) {
        const record = await this.prisma.warehouse.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getCompanyWarehouses(companyId, opts) {
        const where = { companyId };
        if ((opts === null || opts === void 0 ? void 0 : opts.active) !== undefined) {
            where.active = opts.active;
        }
        const records = await this.prisma.warehouse.findMany({
            where,
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getWarehouseByCode(companyId, code) {
        const record = await this.prisma.warehouse.findFirst({
            where: { companyId, code },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    toDomain(record) {
        var _a, _b;
        return new Warehouse_1.Warehouse({
            id: record.id,
            companyId: record.companyId,
            name: record.name,
            code: record.code,
            parentId: (_a = record.parentId) !== null && _a !== void 0 ? _a : null,
            address: (_b = record.address) !== null && _b !== void 0 ? _b : undefined,
            active: record.active,
            isDefault: record.isDefault,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        });
    }
}
exports.PrismaWarehouseRepository = PrismaWarehouseRepository;
//# sourceMappingURL=PrismaWarehouseRepository.js.map