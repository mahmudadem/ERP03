"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaPurchaseReturnRepository = void 0;
const PurchaseReturn_1 = require("../../../../domain/purchases/entities/PurchaseReturn");
class PrismaPurchaseReturnRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(purchaseReturn, _transaction) {
        const tx = _transaction || this.prisma;
        await tx.purchaseReturn.create({
            data: {
                id: purchaseReturn.id,
                companyId: purchaseReturn.companyId,
                documentNo: purchaseReturn.returnNumber,
                vendorId: purchaseReturn.vendorId,
                vendorName: purchaseReturn.vendorName,
                returnDate: new Date(purchaseReturn.returnDate),
                currency: purchaseReturn.currency,
                exchangeRate: purchaseReturn.exchangeRate,
                status: purchaseReturn.status,
                notes: purchaseReturn.notes || null,
                subtotalBase: purchaseReturn.subtotalBase,
                taxTotalBase: purchaseReturn.taxTotalBase,
                grandTotalBase: purchaseReturn.grandTotalBase,
                subtotalDoc: purchaseReturn.subtotalDoc,
                taxTotalDoc: purchaseReturn.taxTotalDoc,
                grandTotalDoc: purchaseReturn.grandTotalDoc,
                createdBy: purchaseReturn.createdBy,
                purchaseInvoiceId: purchaseReturn.purchaseInvoiceId || null,
                goodsReceiptId: purchaseReturn.goodsReceiptId || null,
                purchaseOrderId: purchaseReturn.purchaseOrderId || null,
                returnContext: purchaseReturn.returnContext,
                warehouseId: purchaseReturn.warehouseId,
                reason: purchaseReturn.reason,
                voucherId: purchaseReturn.voucherId || null,
                company: { connect: { id: purchaseReturn.companyId } },
                lines: {
                    create: purchaseReturn.lines.map((line) => ({
                        id: line.lineId,
                        itemId: line.itemId,
                        itemCode: line.itemCode,
                        itemName: line.itemName,
                        returnQty: line.returnQty,
                        uom: line.uom,
                        unitPriceDoc: line.unitCostDoc,
                        lineTotalDoc: line.returnQty * line.unitCostDoc,
                        unitPriceBase: line.unitCostBase,
                        lineTotalBase: line.returnQty * line.unitCostBase,
                        taxCodeId: line.taxCodeId || null,
                        taxCode: line.taxCode || null,
                        taxRate: line.taxRate,
                        taxAmountDoc: line.taxAmountDoc,
                        taxAmountBase: line.taxAmountBase,
                        description: line.description || null,
                        piLineId: line.piLineId || null,
                        grnLineId: line.grnLineId || null,
                        poLineId: line.poLineId || null,
                        uomId: line.uomId || null,
                        fxRateMovToBase: line.fxRateMovToBase,
                        fxRateCCYToBase: line.fxRateCCYToBase,
                        accountId: line.accountId || null,
                        stockMovementId: line.stockMovementId || null,
                    })),
                },
            },
        });
    }
    async update(purchaseReturn, _transaction) {
        const tx = _transaction || this.prisma;
        await tx.purchaseReturn.update({
            where: { id: purchaseReturn.id, companyId: purchaseReturn.companyId },
            data: {
                documentNo: purchaseReturn.returnNumber,
                vendorId: purchaseReturn.vendorId,
                vendorName: purchaseReturn.vendorName,
                returnDate: new Date(purchaseReturn.returnDate),
                currency: purchaseReturn.currency,
                exchangeRate: purchaseReturn.exchangeRate,
                status: purchaseReturn.status,
                notes: purchaseReturn.notes || null,
                subtotalBase: purchaseReturn.subtotalBase,
                taxTotalBase: purchaseReturn.taxTotalBase,
                grandTotalBase: purchaseReturn.grandTotalBase,
                subtotalDoc: purchaseReturn.subtotalDoc,
                taxTotalDoc: purchaseReturn.taxTotalDoc,
                grandTotalDoc: purchaseReturn.grandTotalDoc,
                purchaseInvoiceId: purchaseReturn.purchaseInvoiceId || null,
                goodsReceiptId: purchaseReturn.goodsReceiptId || null,
                purchaseOrderId: purchaseReturn.purchaseOrderId || null,
                returnContext: purchaseReturn.returnContext,
                reason: purchaseReturn.reason,
                voucherId: purchaseReturn.voucherId || null,
                lines: {
                    deleteMany: {},
                    create: purchaseReturn.lines.map((line) => ({
                        id: line.lineId,
                        itemId: line.itemId,
                        itemCode: line.itemCode,
                        itemName: line.itemName,
                        returnQty: line.returnQty,
                        uom: line.uom,
                        unitPriceDoc: line.unitCostDoc,
                        lineTotalDoc: line.returnQty * line.unitCostDoc,
                        unitPriceBase: line.unitCostBase,
                        lineTotalBase: line.returnQty * line.unitCostBase,
                        taxCodeId: line.taxCodeId || null,
                        taxCode: line.taxCode || null,
                        taxRate: line.taxRate,
                        taxAmountDoc: line.taxAmountDoc,
                        taxAmountBase: line.taxAmountBase,
                        description: line.description || null,
                        piLineId: line.piLineId || null,
                        grnLineId: line.grnLineId || null,
                        poLineId: line.poLineId || null,
                        uomId: line.uomId || null,
                        fxRateMovToBase: line.fxRateMovToBase,
                        fxRateCCYToBase: line.fxRateCCYToBase,
                        accountId: line.accountId || null,
                        stockMovementId: line.stockMovementId || null,
                    })),
                },
            },
        });
    }
    async getById(companyId, id) {
        const record = await this.prisma.purchaseReturn.findUnique({
            where: { id, companyId },
            include: { lines: true },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async list(companyId, opts) {
        const where = { companyId };
        if (opts === null || opts === void 0 ? void 0 : opts.vendorId)
            where.vendorId = opts.vendorId;
        if (opts === null || opts === void 0 ? void 0 : opts.purchaseInvoiceId)
            where.purchaseInvoiceId = opts.purchaseInvoiceId;
        if (opts === null || opts === void 0 ? void 0 : opts.goodsReceiptId)
            where.goodsReceiptId = opts.goodsReceiptId;
        if (opts === null || opts === void 0 ? void 0 : opts.status)
            where.status = opts.status;
        const records = await this.prisma.purchaseReturn.findMany({
            where,
            include: { lines: true },
            orderBy: { createdAt: 'desc' },
        });
        return records.map((r) => this.toDomain(r));
    }
    toDomain(record) {
        const lines = (record.lines || []).map((line) => ({
            lineId: line.id,
            lineNo: line.lineNo,
            piLineId: line.piLineId || undefined,
            grnLineId: line.grnLineId || undefined,
            poLineId: line.poLineId || undefined,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            returnQty: line.returnQty,
            uomId: line.uomId || undefined,
            uom: line.uom,
            unitCostDoc: line.unitPriceDoc || 0,
            unitCostBase: line.unitPriceBase || 0,
            fxRateMovToBase: line.fxRateMovToBase || 1,
            fxRateCCYToBase: line.fxRateCCYToBase || 1,
            taxCodeId: line.taxCodeId || undefined,
            taxCode: line.taxCode || undefined,
            taxRate: line.taxRate,
            taxAmountDoc: line.taxAmountDoc,
            taxAmountBase: line.taxAmountBase,
            accountId: line.accountId || undefined,
            stockMovementId: line.stockMovementId || undefined,
            description: line.description || undefined,
        }));
        return PurchaseReturn_1.PurchaseReturn.fromJSON({
            id: record.id,
            companyId: record.companyId,
            returnNumber: record.documentNo,
            purchaseInvoiceId: record.purchaseInvoiceId || undefined,
            goodsReceiptId: record.goodsReceiptId || undefined,
            purchaseOrderId: record.purchaseOrderId || undefined,
            vendorId: record.vendorId,
            vendorName: record.vendorName,
            returnContext: (record.returnContext || 'DIRECT'),
            returnDate: record.returnDate instanceof Date ? record.returnDate.toISOString().split('T')[0] : String(record.returnDate).split('T')[0],
            warehouseId: record.warehouseId || '',
            currency: record.currency,
            exchangeRate: record.exchangeRate,
            lines,
            subtotalDoc: record.subtotalDoc,
            taxTotalDoc: record.taxTotalDoc,
            grandTotalDoc: record.grandTotalDoc,
            subtotalBase: record.subtotalBase,
            taxTotalBase: record.taxTotalBase,
            grandTotalBase: record.grandTotalBase,
            reason: record.reason || '',
            notes: record.notes || undefined,
            status: record.status,
            voucherId: record.voucherId || null,
            createdBy: record.createdBy,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            postedAt: record.postedAt || undefined,
        });
    }
}
exports.PrismaPurchaseReturnRepository = PrismaPurchaseReturnRepository;
//# sourceMappingURL=PrismaPurchaseReturnRepository.js.map