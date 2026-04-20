"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaSalesReturnRepository = void 0;
const SalesReturn_1 = require("../../../../domain/sales/entities/SalesReturn");
class PrismaSalesReturnRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(sr, _transaction) {
        const tx = _transaction || this.prisma;
        await tx.salesReturn.create({
            data: {
                id: sr.id,
                companyId: sr.companyId,
                documentNo: sr.returnNumber,
                customerId: sr.customerId,
                customerName: sr.customerName,
                returnDate: new Date(sr.returnDate),
                currency: sr.currency,
                exchangeRate: sr.exchangeRate,
                status: sr.status,
                notes: sr.notes || null,
                subtotalBase: sr.subtotalBase,
                taxTotalBase: sr.taxTotalBase,
                grandTotalBase: sr.grandTotalBase,
                subtotalDoc: sr.subtotalDoc,
                taxTotalDoc: sr.taxTotalDoc,
                grandTotalDoc: sr.grandTotalDoc,
                createdBy: sr.createdBy,
                salesInvoiceId: sr.salesInvoiceId || null,
                deliveryNoteId: sr.deliveryNoteId || null,
                salesOrderId: sr.salesOrderId || null,
                returnContext: sr.returnContext,
                reason: sr.reason,
                revenueVoucherId: sr.revenueVoucherId || null,
                cogsVoucherId: sr.cogsVoucherId || null,
                company: { connect: { id: sr.companyId } },
                lines: {
                    create: sr.lines.map((line) => ({
                        id: line.lineId,
                        itemId: line.itemId,
                        itemCode: line.itemCode,
                        itemName: line.itemName,
                        returnQty: line.returnQty,
                        uom: line.uom,
                        unitPriceDoc: line.unitPriceDoc || 0,
                        lineTotalDoc: line.returnQty * (line.unitPriceDoc || 0),
                        unitPriceBase: line.unitPriceBase || 0,
                        lineTotalBase: line.returnQty * (line.unitPriceBase || 0),
                        taxCodeId: line.taxCodeId || null,
                        taxRate: line.taxRate,
                        taxAmountDoc: line.taxAmountDoc,
                        taxAmountBase: line.taxAmountBase,
                        description: line.description || null,
                        siLineId: line.siLineId || null,
                        dnLineId: line.dnLineId || null,
                        soLineId: line.soLineId || null,
                        uomId: line.uomId || null,
                        unitCostBase: line.unitCostBase,
                        fxRateMovToBase: line.fxRateMovToBase,
                        fxRateCCYToBase: line.fxRateCCYToBase,
                        revenueAccountId: line.revenueAccountId || null,
                        cogsAccountId: line.cogsAccountId || null,
                        inventoryAccountId: line.inventoryAccountId || null,
                        stockMovementId: line.stockMovementId || null,
                    })),
                },
            },
        });
    }
    async update(sr, _transaction) {
        const tx = _transaction || this.prisma;
        await tx.salesReturn.update({
            where: { id: sr.id, companyId: sr.companyId },
            data: {
                documentNo: sr.returnNumber,
                customerId: sr.customerId,
                customerName: sr.customerName,
                returnDate: new Date(sr.returnDate),
                currency: sr.currency,
                exchangeRate: sr.exchangeRate,
                status: sr.status,
                notes: sr.notes || null,
                subtotalBase: sr.subtotalBase,
                taxTotalBase: sr.taxTotalBase,
                grandTotalBase: sr.grandTotalBase,
                subtotalDoc: sr.subtotalDoc,
                taxTotalDoc: sr.taxTotalDoc,
                grandTotalDoc: sr.grandTotalDoc,
                salesInvoiceId: sr.salesInvoiceId || null,
                deliveryNoteId: sr.deliveryNoteId || null,
                salesOrderId: sr.salesOrderId || null,
                returnContext: sr.returnContext,
                reason: sr.reason,
                revenueVoucherId: sr.revenueVoucherId || null,
                cogsVoucherId: sr.cogsVoucherId || null,
                lines: {
                    deleteMany: {},
                    create: sr.lines.map((line) => ({
                        id: line.lineId,
                        itemId: line.itemId,
                        itemCode: line.itemCode,
                        itemName: line.itemName,
                        returnQty: line.returnQty,
                        uom: line.uom,
                        unitPriceDoc: line.unitPriceDoc || 0,
                        lineTotalDoc: line.returnQty * (line.unitPriceDoc || 0),
                        unitPriceBase: line.unitPriceBase || 0,
                        lineTotalBase: line.returnQty * (line.unitPriceBase || 0),
                        taxCodeId: line.taxCodeId || null,
                        taxRate: line.taxRate,
                        taxAmountDoc: line.taxAmountDoc,
                        taxAmountBase: line.taxAmountBase,
                        description: line.description || null,
                        siLineId: line.siLineId || null,
                        dnLineId: line.dnLineId || null,
                        soLineId: line.soLineId || null,
                        uomId: line.uomId || null,
                        unitCostBase: line.unitCostBase,
                        fxRateMovToBase: line.fxRateMovToBase,
                        fxRateCCYToBase: line.fxRateCCYToBase,
                        revenueAccountId: line.revenueAccountId || null,
                        cogsAccountId: line.cogsAccountId || null,
                        inventoryAccountId: line.inventoryAccountId || null,
                        stockMovementId: line.stockMovementId || null,
                    })),
                },
            },
        });
    }
    async getById(companyId, id) {
        const record = await this.prisma.salesReturn.findUnique({
            where: { id, companyId },
            include: { lines: true },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getByNumber(companyId, returnNumber) {
        const record = await this.prisma.salesReturn.findUnique({
            where: { companyId_documentNo: { companyId, documentNo: returnNumber } },
            include: { lines: true },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async list(companyId, opts) {
        const where = { companyId };
        if (opts === null || opts === void 0 ? void 0 : opts.customerId)
            where.customerId = opts.customerId;
        if (opts === null || opts === void 0 ? void 0 : opts.salesInvoiceId)
            where.salesInvoiceId = opts.salesInvoiceId;
        if (opts === null || opts === void 0 ? void 0 : opts.deliveryNoteId)
            where.deliveryNoteId = opts.deliveryNoteId;
        if (opts === null || opts === void 0 ? void 0 : opts.status)
            where.status = opts.status;
        const records = await this.prisma.salesReturn.findMany({
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
            siLineId: line.siLineId || undefined,
            dnLineId: line.dnLineId || undefined,
            soLineId: line.soLineId || undefined,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            returnQty: line.returnQty,
            uomId: line.uomId || undefined,
            uom: line.uom,
            unitPriceDoc: line.unitPriceDoc || undefined,
            unitPriceBase: line.unitPriceBase || undefined,
            unitCostBase: line.unitCostBase || 0,
            fxRateMovToBase: line.fxRateMovToBase || 1,
            fxRateCCYToBase: line.fxRateCCYToBase || 1,
            taxCodeId: line.taxCodeId || undefined,
            taxRate: line.taxRate,
            taxAmountDoc: line.taxAmountDoc,
            taxAmountBase: line.taxAmountBase,
            revenueAccountId: line.revenueAccountId || undefined,
            cogsAccountId: line.cogsAccountId || undefined,
            inventoryAccountId: line.inventoryAccountId || undefined,
            stockMovementId: line.stockMovementId || undefined,
            description: line.description || undefined,
        }));
        return SalesReturn_1.SalesReturn.fromJSON({
            id: record.id,
            companyId: record.companyId,
            returnNumber: record.documentNo,
            salesInvoiceId: record.salesInvoiceId || undefined,
            deliveryNoteId: record.deliveryNoteId || undefined,
            salesOrderId: record.salesOrderId || undefined,
            customerId: record.customerId,
            customerName: record.customerName,
            returnContext: (record.returnContext || 'AFTER_INVOICE'),
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
            revenueVoucherId: record.revenueVoucherId || null,
            cogsVoucherId: record.cogsVoucherId || null,
            createdBy: record.createdBy,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            postedAt: record.postedAt || undefined,
        });
    }
}
exports.PrismaSalesReturnRepository = PrismaSalesReturnRepository;
//# sourceMappingURL=PrismaSalesReturnRepository.js.map