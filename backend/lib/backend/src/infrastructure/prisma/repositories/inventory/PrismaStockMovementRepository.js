"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaStockMovementRepository = void 0;
const StockMovement_1 = require("../../../../domain/inventory/entities/StockMovement");
class PrismaStockMovementRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async recordMovement(movement, transaction) {
        var _a, _b, _c, _d;
        const prisma = transaction || this.prisma;
        await prisma.stockMovement.create({
            data: {
                id: movement.id,
                companyId: movement.companyId,
                date: movement.date,
                postingSeq: movement.postingSeq,
                createdBy: movement.createdBy,
                postedAt: movement.postedAt,
                itemId: movement.itemId,
                warehouseId: movement.warehouseId,
                direction: movement.direction,
                movementType: movement.movementType,
                qty: movement.qty,
                uom: movement.uom,
                referenceType: movement.referenceType,
                referenceId: movement.referenceId || null,
                referenceLineId: movement.referenceLineId || null,
                reversesMovementId: movement.reversesMovementId || null,
                transferPairId: movement.transferPairId || null,
                unitCostBase: movement.unitCostBase,
                totalCostBase: movement.totalCostBase,
                unitCostCCY: movement.unitCostCCY,
                totalCostCCY: movement.totalCostCCY,
                movementCurrency: movement.movementCurrency,
                fxRateMovToBase: movement.fxRateMovToBase,
                fxRateCCYToBase: movement.fxRateCCYToBase,
                fxRateKind: movement.fxRateKind,
                avgCostBaseAfter: movement.avgCostBaseAfter,
                avgCostCCYAfter: movement.avgCostCCYAfter,
                qtyBefore: movement.qtyBefore,
                qtyAfter: movement.qtyAfter,
                settledQty: (_a = movement.settledQty) !== null && _a !== void 0 ? _a : null,
                unsettledQty: (_b = movement.unsettledQty) !== null && _b !== void 0 ? _b : null,
                unsettledCostBasis: movement.unsettledCostBasis || null,
                settlesNegativeQty: (_c = movement.settlesNegativeQty) !== null && _c !== void 0 ? _c : null,
                newPositiveQty: (_d = movement.newPositiveQty) !== null && _d !== void 0 ? _d : null,
                negativeQtyAtPosting: movement.negativeQtyAtPosting,
                costSettled: movement.costSettled,
                isBackdated: movement.isBackdated,
                costSource: movement.costSource,
                notes: movement.notes || null,
                metadata: movement.metadata || null,
            },
        });
    }
    async getItemMovements(companyId, itemId, opts) {
        const where = { companyId, itemId };
        if ((opts === null || opts === void 0 ? void 0 : opts.movementType) !== undefined) {
            where.movementType = opts.movementType;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.direction) !== undefined) {
            where.direction = opts.direction;
        }
        const records = await this.prisma.stockMovement.findMany({
            where,
            orderBy: { postingSeq: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getWarehouseMovements(companyId, warehouseId, opts) {
        const where = { companyId, warehouseId };
        if ((opts === null || opts === void 0 ? void 0 : opts.movementType) !== undefined) {
            where.movementType = opts.movementType;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.direction) !== undefined) {
            where.direction = opts.direction;
        }
        const records = await this.prisma.stockMovement.findMany({
            where,
            orderBy: { postingSeq: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getMovementsByReference(companyId, referenceType, referenceId) {
        const records = await this.prisma.stockMovement.findMany({
            where: { companyId, referenceType: referenceType, referenceId },
            orderBy: { postingSeq: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async getMovementByReference(companyId, referenceType, referenceId, referenceLineId) {
        const where = { companyId, referenceType: referenceType, referenceId };
        if (referenceLineId !== undefined) {
            where.referenceLineId = referenceLineId;
        }
        const record = await this.prisma.stockMovement.findFirst({
            where,
            orderBy: { postingSeq: 'asc' },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getMovementsByDateRange(companyId, from, to, opts) {
        const where = {
            companyId,
            date: {
                gte: from,
                lte: to,
            },
        };
        if ((opts === null || opts === void 0 ? void 0 : opts.movementType) !== undefined) {
            where.movementType = opts.movementType;
        }
        if ((opts === null || opts === void 0 ? void 0 : opts.direction) !== undefined) {
            where.direction = opts.direction;
        }
        const records = await this.prisma.stockMovement.findMany({
            where,
            orderBy: { postingSeq: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getUnsettledMovements(companyId) {
        const records = await this.prisma.stockMovement.findMany({
            where: { companyId, costSettled: false },
            orderBy: { postingSeq: 'asc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    async getMovement(id) {
        const record = await this.prisma.stockMovement.findUnique({
            where: { id },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async deleteMovement(companyId, id, transaction) {
        const prisma = transaction || this.prisma;
        await prisma.stockMovement.delete({
            where: { id, companyId },
        });
    }
    toDomain(record) {
        return StockMovement_1.StockMovement.fromJSON({
            id: record.id,
            companyId: record.companyId,
            date: record.date,
            postingSeq: record.postingSeq,
            createdAt: record.createdAt,
            createdBy: record.createdBy,
            postedAt: record.postedAt,
            itemId: record.itemId,
            warehouseId: record.warehouseId,
            direction: record.direction,
            movementType: record.movementType,
            qty: record.qty,
            uom: record.uom,
            referenceType: record.referenceType,
            referenceId: record.referenceId,
            referenceLineId: record.referenceLineId,
            reversesMovementId: record.reversesMovementId,
            transferPairId: record.transferPairId,
            unitCostBase: record.unitCostBase,
            totalCostBase: record.totalCostBase,
            unitCostCCY: record.unitCostCCY,
            totalCostCCY: record.totalCostCCY,
            movementCurrency: record.movementCurrency,
            fxRateMovToBase: record.fxRateMovToBase,
            fxRateCCYToBase: record.fxRateCCYToBase,
            fxRateKind: record.fxRateKind,
            avgCostBaseAfter: record.avgCostBaseAfter,
            avgCostCCYAfter: record.avgCostCCYAfter,
            qtyBefore: record.qtyBefore,
            qtyAfter: record.qtyAfter,
            settledQty: record.settledQty,
            unsettledQty: record.unsettledQty,
            unsettledCostBasis: record.unsettledCostBasis,
            settlesNegativeQty: record.settlesNegativeQty,
            newPositiveQty: record.newPositiveQty,
            negativeQtyAtPosting: record.negativeQtyAtPosting,
            costSettled: record.costSettled,
            isBackdated: record.isBackdated,
            costSource: record.costSource,
            notes: record.notes,
            metadata: record.metadata,
        });
    }
}
exports.PrismaStockMovementRepository = PrismaStockMovementRepository;
//# sourceMappingURL=PrismaStockMovementRepository.js.map