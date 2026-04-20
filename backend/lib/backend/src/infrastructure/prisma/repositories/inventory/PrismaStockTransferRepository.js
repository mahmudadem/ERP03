"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaStockTransferRepository = void 0;
const StockTransfer_1 = require("../../../../domain/inventory/entities/StockTransfer");
class PrismaStockTransferRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createTransfer(transfer) {
        await this.prisma.stockTransfer.create({
            data: {
                id: transfer.id,
                companyId: transfer.companyId,
                documentNo: transfer.id,
                fromWarehouseId: transfer.sourceWarehouseId,
                toWarehouseId: transfer.destinationWarehouseId,
                date: new Date(transfer.date),
                status: transfer.status,
                notes: transfer.notes || null,
                createdBy: transfer.createdBy,
                lines: {
                    create: transfer.lines.map((line, index) => ({
                        id: `stl_${transfer.id}_${line.itemId}_${index}`,
                        itemId: line.itemId,
                        quantity: line.qty,
                        qtyReceived: 0,
                        notes: `${line.unitCostBaseAtTransfer}|${line.unitCostCCYAtTransfer}`,
                    })),
                },
            },
        });
    }
    async updateTransfer(id, data) {
        const existing = await this.prisma.stockTransfer.findUnique({
            where: { id },
            include: { lines: true },
        });
        const updateData = {};
        if (data.sourceWarehouseId !== undefined)
            updateData.fromWarehouseId = data.sourceWarehouseId;
        if (data.destinationWarehouseId !== undefined)
            updateData.toWarehouseId = data.destinationWarehouseId;
        if (data.date !== undefined)
            updateData.date = new Date(data.date);
        if (data.notes !== undefined)
            updateData.notes = data.notes;
        if (data.status !== undefined)
            updateData.status = data.status;
        if (data.transferPairId !== undefined)
            updateData.transferPairId = data.transferPairId;
        if (data.completedAt !== undefined)
            updateData.completedAt = data.completedAt;
        if (data.lines !== undefined) {
            updateData.lines = {
                deleteMany: {},
                create: data.lines.map((line, index) => {
                    var _a, _b, _c;
                    return ({
                        id: `stl_${id}_${line.itemId}_${index}`,
                        itemId: line.itemId,
                        quantity: line.qty,
                        qtyReceived: (_c = (_b = (_a = existing === null || existing === void 0 ? void 0 : existing.lines) === null || _a === void 0 ? void 0 : _a[index]) === null || _b === void 0 ? void 0 : _b.qtyReceived) !== null && _c !== void 0 ? _c : 0,
                        notes: `${line.unitCostBaseAtTransfer}|${line.unitCostCCYAtTransfer}`,
                    });
                }),
            };
        }
        await this.prisma.stockTransfer.update({
            where: { id },
            data: updateData,
        });
    }
    async getTransfer(id) {
        const record = await this.prisma.stockTransfer.findUnique({
            where: { id },
            include: { lines: true },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getCompanyTransfers(companyId, opts) {
        const records = await this.prisma.stockTransfer.findMany({
            where: { companyId },
            include: { lines: true },
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getByStatus(companyId, status, opts) {
        const records = await this.prisma.stockTransfer.findMany({
            where: { companyId, status: status },
            include: { lines: true },
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async deleteTransfer(id) {
        await this.prisma.stockTransfer.delete({
            where: { id },
        });
    }
    toDomain(record) {
        const lines = (record.lines || []).map((line) => {
            const costParts = (line.notes || '0|0').split('|');
            return {
                itemId: line.itemId,
                qty: line.quantity,
                unitCostBaseAtTransfer: parseFloat(costParts[0]) || 0,
                unitCostCCYAtTransfer: parseFloat(costParts[1]) || 0,
            };
        });
        return StockTransfer_1.StockTransfer.fromJSON({
            id: record.id,
            companyId: record.companyId,
            sourceWarehouseId: record.fromWarehouseId,
            destinationWarehouseId: record.toWarehouseId,
            date: record.date instanceof Date ? record.date.toISOString().split('T')[0] : String(record.date).split('T')[0],
            notes: record.notes,
            lines,
            status: record.status,
            transferPairId: record.transferPairId || record.id,
            createdBy: record.createdBy,
            createdAt: record.createdAt,
            completedAt: record.completedAt,
        });
    }
}
exports.PrismaStockTransferRepository = PrismaStockTransferRepository;
//# sourceMappingURL=PrismaStockTransferRepository.js.map