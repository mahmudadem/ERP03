"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaStockAdjustmentRepository = void 0;
const StockAdjustment_1 = require("../../../../domain/inventory/entities/StockAdjustment");
class PrismaStockAdjustmentRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createAdjustment(adjustment, transaction) {
        const prisma = transaction || this.prisma;
        await prisma.stockAdjustment.create({
            data: {
                id: adjustment.id,
                companyId: adjustment.companyId,
                documentNo: adjustment.id,
                date: new Date(adjustment.date),
                reason: adjustment.reason,
                notes: adjustment.notes || null,
                status: adjustment.status,
                createdBy: adjustment.createdBy,
                lines: {
                    create: adjustment.lines.map((line) => {
                        var _a;
                        return ({
                            id: `sal_${adjustment.id}_${line.itemId}`,
                            itemId: line.itemId,
                            warehouseId: adjustment.warehouseId,
                            qtyBefore: line.currentQty,
                            qtyAfter: line.newQty,
                            unitCostBase: line.unitCostBase,
                            notes: ((_a = line.unitCostCCY) === null || _a === void 0 ? void 0 : _a.toString()) || null,
                        });
                    }),
                },
            },
        });
    }
    async updateAdjustment(companyId, id, data, transaction) {
        var _a, _b;
        const prisma = transaction || this.prisma;
        const existing = await prisma.stockAdjustment.findUnique({
            where: { id, companyId },
            include: { lines: true },
        });
        const warehouseId = data.warehouseId || ((_b = (_a = existing === null || existing === void 0 ? void 0 : existing.lines) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.warehouseId) || '';
        const updateData = {};
        if (data.warehouseId !== undefined)
            updateData.warehouseId = data.warehouseId;
        if (data.date !== undefined)
            updateData.date = new Date(data.date);
        if (data.reason !== undefined)
            updateData.reason = data.reason;
        if (data.notes !== undefined)
            updateData.notes = data.notes;
        if (data.status !== undefined)
            updateData.status = data.status;
        if (data.voucherId !== undefined)
            updateData.voucherId = data.voucherId;
        if (data.adjustmentValueBase !== undefined)
            updateData.adjustmentValueBase = data.adjustmentValueBase;
        if (data.postedAt !== undefined)
            updateData.postedAt = data.postedAt;
        if (data.lines !== undefined) {
            updateData.lines = {
                deleteMany: {},
                create: data.lines.map((line) => {
                    var _a;
                    return ({
                        id: `sal_${id}_${line.itemId}`,
                        itemId: line.itemId,
                        warehouseId,
                        qtyBefore: line.currentQty,
                        qtyAfter: line.newQty,
                        unitCostBase: line.unitCostBase,
                        notes: ((_a = line.unitCostCCY) === null || _a === void 0 ? void 0 : _a.toString()) || null,
                    });
                }),
            };
        }
        await prisma.stockAdjustment.update({
            where: { id, companyId },
            data: updateData,
        });
    }
    async getAdjustment(id) {
        const record = await this.prisma.stockAdjustment.findUnique({
            where: { id },
            include: { lines: true },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getCompanyAdjustments(companyId, opts) {
        const records = await this.prisma.stockAdjustment.findMany({
            where: { companyId },
            include: { lines: true },
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getByStatus(companyId, status, opts) {
        const records = await this.prisma.stockAdjustment.findMany({
            where: { companyId, status: status },
            include: { lines: true },
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async deleteAdjustment(id) {
        await this.prisma.stockAdjustment.delete({
            where: { id },
        });
    }
    toDomain(record) {
        var _a, _b, _c;
        const warehouseId = ((_b = (_a = record.lines) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.warehouseId) || record.warehouseId || '';
        const lines = (record.lines || []).map((line) => ({
            itemId: line.itemId,
            currentQty: line.qtyBefore,
            newQty: line.qtyAfter,
            adjustmentQty: line.qtyAfter - line.qtyBefore,
            unitCostBase: line.unitCostBase || 0,
            unitCostCCY: line.notes ? parseFloat(line.notes) : 0,
        }));
        return StockAdjustment_1.StockAdjustment.fromJSON({
            id: record.id,
            companyId: record.companyId,
            warehouseId,
            date: record.date instanceof Date ? record.date.toISOString().split('T')[0] : String(record.date).split('T')[0],
            reason: record.reason,
            notes: record.notes,
            lines,
            status: record.status,
            voucherId: record.voucherId,
            adjustmentValueBase: (_c = record.adjustmentValueBase) !== null && _c !== void 0 ? _c : 0,
            createdBy: record.createdBy,
            createdAt: record.createdAt,
            postedAt: record.postedAt,
        });
    }
}
exports.PrismaStockAdjustmentRepository = PrismaStockAdjustmentRepository;
const adjustmentWarehouseIdFallback = '';
//# sourceMappingURL=PrismaStockAdjustmentRepository.js.map