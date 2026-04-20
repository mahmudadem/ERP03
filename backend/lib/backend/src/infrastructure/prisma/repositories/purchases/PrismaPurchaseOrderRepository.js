"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaPurchaseOrderRepository = void 0;
const PurchaseOrder_1 = require("../../../../domain/purchases/entities/PurchaseOrder");
class PrismaPurchaseOrderRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async create(po, _transaction) {
        const tx = _transaction || this.prisma;
        await tx.purchaseOrder.create({
            data: {
                id: po.id,
                companyId: po.companyId,
                orderNumber: po.orderNumber,
                vendorId: po.vendorId,
                vendorName: po.vendorName,
                orderDate: new Date(po.orderDate),
                expectedDeliveryDate: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate) : null,
                currency: po.currency,
                exchangeRate: po.exchangeRate,
                status: po.status,
                notes: po.notes || null,
                internalNotes: po.internalNotes || null,
                subtotalBase: po.subtotalBase,
                taxTotalBase: po.taxTotalBase,
                grandTotalBase: po.grandTotalBase,
                subtotalDoc: po.subtotalDoc,
                taxTotalDoc: po.taxTotalDoc,
                grandTotalDoc: po.grandTotalDoc,
                createdBy: po.createdBy,
                confirmedAt: po.confirmedAt || null,
                closedAt: po.closedAt || null,
                company: { connect: { id: po.companyId } },
                lines: {
                    create: po.lines.map((line) => ({
                        id: line.lineId,
                        lineNo: line.lineNo,
                        itemId: line.itemId,
                        itemCode: line.itemCode,
                        itemName: line.itemName,
                        itemType: line.itemType,
                        trackInventory: line.trackInventory,
                        orderedQty: line.orderedQty,
                        uomId: line.uomId || null,
                        uom: line.uom,
                        receivedQty: line.receivedQty,
                        invoicedQty: line.invoicedQty,
                        returnedQty: line.returnedQty,
                        unitPriceDoc: line.unitPriceDoc,
                        lineTotalDoc: line.lineTotalDoc,
                        unitPriceBase: line.unitPriceBase,
                        lineTotalBase: line.lineTotalBase,
                        taxCodeId: line.taxCodeId || null,
                        taxRate: line.taxRate,
                        taxAmountDoc: line.taxAmountDoc,
                        taxAmountBase: line.taxAmountBase,
                        warehouseId: line.warehouseId || null,
                        description: line.description || null,
                    })),
                },
            },
        });
    }
    async update(po, _transaction) {
        const tx = _transaction || this.prisma;
        await tx.purchaseOrder.update({
            where: { id: po.id, companyId: po.companyId },
            data: {
                orderNumber: po.orderNumber,
                vendorId: po.vendorId,
                vendorName: po.vendorName,
                orderDate: new Date(po.orderDate),
                expectedDeliveryDate: po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate) : null,
                currency: po.currency,
                exchangeRate: po.exchangeRate,
                status: po.status,
                notes: po.notes || null,
                internalNotes: po.internalNotes || null,
                subtotalBase: po.subtotalBase,
                taxTotalBase: po.taxTotalBase,
                grandTotalBase: po.grandTotalBase,
                subtotalDoc: po.subtotalDoc,
                taxTotalDoc: po.taxTotalDoc,
                grandTotalDoc: po.grandTotalDoc,
                confirmedAt: po.confirmedAt || null,
                closedAt: po.closedAt || null,
                lines: {
                    deleteMany: {},
                    create: po.lines.map((line) => ({
                        id: line.lineId,
                        lineNo: line.lineNo,
                        itemId: line.itemId,
                        itemCode: line.itemCode,
                        itemName: line.itemName,
                        itemType: line.itemType,
                        trackInventory: line.trackInventory,
                        orderedQty: line.orderedQty,
                        uomId: line.uomId || null,
                        uom: line.uom,
                        receivedQty: line.receivedQty,
                        invoicedQty: line.invoicedQty,
                        returnedQty: line.returnedQty,
                        unitPriceDoc: line.unitPriceDoc,
                        lineTotalDoc: line.lineTotalDoc,
                        unitPriceBase: line.unitPriceBase,
                        lineTotalBase: line.lineTotalBase,
                        taxCodeId: line.taxCodeId || null,
                        taxRate: line.taxRate,
                        taxAmountDoc: line.taxAmountDoc,
                        taxAmountBase: line.taxAmountBase,
                        warehouseId: line.warehouseId || null,
                        description: line.description || null,
                    })),
                },
            },
        });
    }
    async getById(companyId, id) {
        const record = await this.prisma.purchaseOrder.findUnique({
            where: { id, companyId },
            include: { lines: { orderBy: { lineNo: 'asc' } } },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async getByNumber(companyId, orderNumber) {
        const record = await this.prisma.purchaseOrder.findUnique({
            where: { companyId_orderNumber: { companyId, orderNumber } },
            include: { lines: { orderBy: { lineNo: 'asc' } } },
        });
        if (!record)
            return null;
        return this.toDomain(record);
    }
    async list(companyId, opts) {
        const where = { companyId };
        if (opts === null || opts === void 0 ? void 0 : opts.status)
            where.status = opts.status;
        if (opts === null || opts === void 0 ? void 0 : opts.vendorId)
            where.vendorId = opts.vendorId;
        const records = await this.prisma.purchaseOrder.findMany({
            where,
            include: { lines: { orderBy: { lineNo: 'asc' } } },
            orderBy: { createdAt: 'desc' },
            take: opts === null || opts === void 0 ? void 0 : opts.limit,
            skip: opts === null || opts === void 0 ? void 0 : opts.offset,
        });
        return records.map((r) => this.toDomain(r));
    }
    async delete(companyId, id) {
        await this.prisma.purchaseOrder.delete({
            where: { id, companyId },
        });
    }
    toDomain(record) {
        const lines = (record.lines || []).map((line) => ({
            lineId: line.id,
            lineNo: line.lineNo,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            itemType: line.itemType,
            trackInventory: line.trackInventory,
            orderedQty: line.orderedQty,
            uomId: line.uomId || undefined,
            uom: line.uom,
            receivedQty: line.receivedQty,
            invoicedQty: line.invoicedQty,
            returnedQty: line.returnedQty,
            unitPriceDoc: line.unitPriceDoc,
            lineTotalDoc: line.lineTotalDoc,
            unitPriceBase: line.unitPriceBase,
            lineTotalBase: line.lineTotalBase,
            taxCodeId: line.taxCodeId || undefined,
            taxRate: line.taxRate,
            taxAmountDoc: line.taxAmountDoc,
            taxAmountBase: line.taxAmountBase,
            warehouseId: line.warehouseId || undefined,
            description: line.description || undefined,
        }));
        return PurchaseOrder_1.PurchaseOrder.fromJSON({
            id: record.id,
            companyId: record.companyId,
            orderNumber: record.orderNumber,
            vendorId: record.vendorId,
            vendorName: record.vendorName,
            orderDate: record.orderDate instanceof Date ? record.orderDate.toISOString().split('T')[0] : String(record.orderDate).split('T')[0],
            expectedDeliveryDate: record.expectedDeliveryDate
                ? record.expectedDeliveryDate instanceof Date
                    ? record.expectedDeliveryDate.toISOString().split('T')[0]
                    : String(record.expectedDeliveryDate).split('T')[0]
                : undefined,
            currency: record.currency,
            exchangeRate: record.exchangeRate,
            lines,
            subtotalBase: record.subtotalBase,
            taxTotalBase: record.taxTotalBase,
            grandTotalBase: record.grandTotalBase,
            subtotalDoc: record.subtotalDoc,
            taxTotalDoc: record.taxTotalDoc,
            grandTotalDoc: record.grandTotalDoc,
            status: record.status,
            notes: record.notes || undefined,
            internalNotes: record.internalNotes || undefined,
            createdBy: record.createdBy,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
            confirmedAt: record.confirmedAt || undefined,
            closedAt: record.closedAt || undefined,
        });
    }
}
exports.PrismaPurchaseOrderRepository = PrismaPurchaseOrderRepository;
//# sourceMappingURL=PrismaPurchaseOrderRepository.js.map