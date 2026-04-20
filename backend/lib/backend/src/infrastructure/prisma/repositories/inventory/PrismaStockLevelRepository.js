"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaStockLevelRepository = void 0;
const StockLevel_1 = require("../../../../domain/inventory/entities/StockLevel");
class PrismaStockLevelRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async getLevel(companyId, itemId, warehouseId) {
        const record = await this.prisma.stockLevel.findUnique({
            where: {
                companyId_itemId_warehouseId: { companyId, itemId, warehouseId },
            },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getLevelsByItem(companyId, itemId, opts) {
        const records = await this.prisma.stockLevel.findMany({
            where: { companyId, itemId },
            orderBy: { updatedAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getLevelsByWarehouse(companyId, warehouseId, opts) {
        const records = await this.prisma.stockLevel.findMany({
            where: { companyId, warehouseId },
            orderBy: { updatedAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getAllLevels(companyId, opts) {
        const records = await this.prisma.stockLevel.findMany({
            where: { companyId },
            orderBy: { updatedAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async upsertLevel(level) {
        await this.prisma.stockLevel.update({
            where: {
                companyId_itemId_warehouseId: {
                    companyId: level.companyId,
                    itemId: level.itemId,
                    warehouseId: level.warehouseId,
                },
                version: level.version - 1,
            },
            data: {
                qtyOnHand: level.qtyOnHand,
                reservedQty: level.reservedQty,
                avgCostBase: level.avgCostBase,
                avgCostCCY: level.avgCostCCY,
                lastCostBase: level.lastCostBase,
                lastCostCCY: level.lastCostCCY,
                postingSeq: level.postingSeq,
                maxBusinessDate: level.maxBusinessDate,
                totalMovements: level.totalMovements,
                lastMovementId: level.lastMovementId || null,
                version: level.version,
            },
        });
    }
    async getLevelInTransaction(transaction, companyId, itemId, warehouseId) {
        const tx = transaction;
        const record = await tx.stockLevel.findUnique({
            where: {
                companyId_itemId_warehouseId: { companyId, itemId, warehouseId },
            },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async upsertLevelInTransaction(transaction, level) {
        const tx = transaction;
        await tx.stockLevel.update({
            where: {
                companyId_itemId_warehouseId: {
                    companyId: level.companyId,
                    itemId: level.itemId,
                    warehouseId: level.warehouseId,
                },
                version: level.version - 1,
            },
            data: {
                qtyOnHand: level.qtyOnHand,
                reservedQty: level.reservedQty,
                avgCostBase: level.avgCostBase,
                avgCostCCY: level.avgCostCCY,
                lastCostBase: level.lastCostBase,
                lastCostCCY: level.lastCostCCY,
                postingSeq: level.postingSeq,
                maxBusinessDate: level.maxBusinessDate,
                totalMovements: level.totalMovements,
                lastMovementId: level.lastMovementId || null,
                version: level.version,
            },
        });
    }
    toDomain(record) {
        return StockLevel_1.StockLevel.fromJSON({
            id: record.id,
            companyId: record.companyId,
            itemId: record.itemId,
            warehouseId: record.warehouseId,
            qtyOnHand: record.qtyOnHand,
            reservedQty: record.reservedQty,
            avgCostBase: record.avgCostBase,
            avgCostCCY: record.avgCostCCY,
            lastCostBase: record.lastCostBase,
            lastCostCCY: record.lastCostCCY,
            postingSeq: record.postingSeq,
            maxBusinessDate: record.maxBusinessDate || '1970-01-01',
            totalMovements: record.totalMovements,
            lastMovementId: record.lastMovementId || '',
            version: record.version,
            updatedAt: record.updatedAt,
        });
    }
}
exports.PrismaStockLevelRepository = PrismaStockLevelRepository;
//# sourceMappingURL=PrismaStockLevelRepository.js.map