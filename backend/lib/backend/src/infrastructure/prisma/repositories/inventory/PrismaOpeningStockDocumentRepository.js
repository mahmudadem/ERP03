"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaOpeningStockDocumentRepository = void 0;
const OpeningStockDocument_1 = require("../../../../domain/inventory/entities/OpeningStockDocument");
class PrismaOpeningStockDocumentRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async createDocument(document, transaction) {
        const prisma = transaction || this.prisma;
        await prisma.openingStockDocument.create({
            data: {
                id: document.id,
                companyId: document.companyId,
                documentNo: document.id,
                date: new Date(document.date),
                status: document.status,
                notes: document.notes || null,
                createdBy: document.createdBy,
                lines: {
                    create: document.lines.map((line) => ({
                        id: line.lineId,
                        itemId: line.itemId,
                        warehouseId: document.warehouseId,
                        quantity: line.quantity,
                        unitCostBase: line.unitCostBase,
                        totalCostBase: line.totalValueBase,
                        currency: line.moveCurrency,
                        notes: `${line.unitCostInMoveCurrency}|${line.fxRateMovToBase}|${line.fxRateCCYToBase}`,
                    })),
                },
            },
        });
    }
    async updateDocument(companyId, id, data, transaction) {
        var _a, _b;
        const prisma = transaction || this.prisma;
        const existing = await prisma.openingStockDocument.findUnique({
            where: { id, companyId },
            include: { lines: true },
        });
        const warehouseId = data.warehouseId || ((_b = (_a = existing === null || existing === void 0 ? void 0 : existing.lines) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.warehouseId) || '';
        const updateData = {};
        if (data.warehouseId !== undefined)
            updateData.warehouseId = data.warehouseId;
        if (data.date !== undefined)
            updateData.date = new Date(data.date);
        if (data.notes !== undefined)
            updateData.notes = data.notes;
        if (data.status !== undefined)
            updateData.status = data.status;
        if (data.createAccountingEffect !== undefined)
            updateData.createAccountingEffect = data.createAccountingEffect;
        if (data.openingBalanceAccountId !== undefined)
            updateData.openingBalanceAccountId = data.openingBalanceAccountId;
        if (data.voucherId !== undefined)
            updateData.voucherId = data.voucherId;
        if (data.totalValueBase !== undefined)
            updateData.totalValueBase = data.totalValueBase;
        if (data.postedAt !== undefined)
            updateData.postedAt = data.postedAt;
        if (data.lines !== undefined) {
            updateData.lines = {
                deleteMany: {},
                create: data.lines.map((line) => ({
                    id: line.lineId,
                    itemId: line.itemId,
                    warehouseId,
                    quantity: line.quantity,
                    unitCostBase: line.unitCostBase,
                    totalCostBase: line.totalValueBase,
                    currency: line.moveCurrency,
                    notes: `${line.unitCostInMoveCurrency}|${line.fxRateMovToBase}|${line.fxRateCCYToBase}`,
                })),
            };
        }
        await prisma.openingStockDocument.update({
            where: { id, companyId },
            data: updateData,
        });
    }
    async getDocument(id) {
        const record = await this.prisma.openingStockDocument.findUnique({
            where: { id },
            include: { lines: true },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getCompanyDocuments(companyId, opts) {
        const records = await this.prisma.openingStockDocument.findMany({
            where: { companyId },
            include: { lines: true },
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async getByStatus(companyId, status, opts) {
        const records = await this.prisma.openingStockDocument.findMany({
            where: { companyId, status: status },
            include: { lines: true },
            orderBy: { createdAt: 'asc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async deleteDocument(id) {
        await this.prisma.openingStockDocument.delete({
            where: { id },
        });
    }
    toDomain(record) {
        var _a, _b, _c, _d;
        const lines = (record.lines || []).map((line) => {
            const costParts = (line.notes || '0|1|1').split('|');
            return {
                lineId: line.id,
                itemId: line.itemId,
                quantity: line.quantity,
                unitCostInMoveCurrency: parseFloat(costParts[0]) || 0,
                moveCurrency: line.currency,
                fxRateMovToBase: parseFloat(costParts[1]) || 1,
                fxRateCCYToBase: parseFloat(costParts[2]) || 1,
                unitCostBase: line.unitCostBase,
                totalValueBase: line.totalCostBase,
            };
        });
        return OpeningStockDocument_1.OpeningStockDocument.fromJSON({
            id: record.id,
            companyId: record.companyId,
            warehouseId: ((_b = (_a = record.lines) === null || _a === void 0 ? void 0 : _a[0]) === null || _b === void 0 ? void 0 : _b.warehouseId) || record.warehouseId || '',
            date: record.date instanceof Date ? record.date.toISOString().split('T')[0] : String(record.date).split('T')[0],
            notes: record.notes,
            lines,
            status: record.status,
            createAccountingEffect: (_c = record.createAccountingEffect) !== null && _c !== void 0 ? _c : false,
            openingBalanceAccountId: record.openingBalanceAccountId,
            voucherId: record.voucherId,
            totalValueBase: (_d = record.totalValueBase) !== null && _d !== void 0 ? _d : 0,
            createdBy: record.createdBy,
            createdAt: record.createdAt,
            postedAt: record.postedAt,
        });
    }
}
exports.PrismaOpeningStockDocumentRepository = PrismaOpeningStockDocumentRepository;
//# sourceMappingURL=PrismaOpeningStockDocumentRepository.js.map