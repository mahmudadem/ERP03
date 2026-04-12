"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseDTOMapper = void 0;
class PurchaseDTOMapper {
    static toSettingsDTO(settings) {
        return {
            companyId: settings.companyId,
            allowDirectInvoicing: settings.allowDirectInvoicing,
            requirePOForStockItems: settings.requirePOForStockItems,
            defaultAPAccountId: settings.defaultAPAccountId,
            defaultPurchaseExpenseAccountId: settings.defaultPurchaseExpenseAccountId,
            allowOverDelivery: settings.allowOverDelivery,
            overDeliveryTolerancePct: settings.overDeliveryTolerancePct,
            overInvoiceTolerancePct: settings.overInvoiceTolerancePct,
            defaultPaymentTermsDays: settings.defaultPaymentTermsDays,
            purchaseVoucherTypeId: settings.purchaseVoucherTypeId,
            defaultWarehouseId: settings.defaultWarehouseId,
            poNumberPrefix: settings.poNumberPrefix,
            poNumberNextSeq: settings.poNumberNextSeq,
            grnNumberPrefix: settings.grnNumberPrefix,
            grnNumberNextSeq: settings.grnNumberNextSeq,
            piNumberPrefix: settings.piNumberPrefix,
            piNumberNextSeq: settings.piNumberNextSeq,
            prNumberPrefix: settings.prNumberPrefix,
            prNumberNextSeq: settings.prNumberNextSeq,
        };
    }
    static toLineDTO(line) {
        return {
            lineId: line.lineId,
            lineNo: line.lineNo,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            itemType: line.itemType,
            trackInventory: line.trackInventory,
            orderedQty: line.orderedQty,
            uom: line.uom,
            receivedQty: line.receivedQty,
            invoicedQty: line.invoicedQty,
            returnedQty: line.returnedQty,
            unitPriceDoc: line.unitPriceDoc,
            lineTotalDoc: line.lineTotalDoc,
            unitPriceBase: line.unitPriceBase,
            lineTotalBase: line.lineTotalBase,
            taxCodeId: line.taxCodeId,
            taxRate: line.taxRate,
            taxAmountDoc: line.taxAmountDoc,
            taxAmountBase: line.taxAmountBase,
            warehouseId: line.warehouseId,
            description: line.description,
        };
    }
    static toOrderDTO(po) {
        var _a, _b;
        return {
            id: po.id,
            companyId: po.companyId,
            orderNumber: po.orderNumber,
            vendorId: po.vendorId,
            vendorName: po.vendorName,
            orderDate: po.orderDate,
            expectedDeliveryDate: po.expectedDeliveryDate,
            currency: po.currency,
            exchangeRate: po.exchangeRate,
            lines: po.lines.map((line) => PurchaseDTOMapper.toLineDTO(line)),
            subtotalBase: po.subtotalBase,
            taxTotalBase: po.taxTotalBase,
            grandTotalBase: po.grandTotalBase,
            subtotalDoc: po.subtotalDoc,
            taxTotalDoc: po.taxTotalDoc,
            grandTotalDoc: po.grandTotalDoc,
            status: po.status,
            notes: po.notes,
            internalNotes: po.internalNotes,
            createdBy: po.createdBy,
            createdAt: po.createdAt.toISOString(),
            updatedAt: po.updatedAt.toISOString(),
            confirmedAt: (_a = po.confirmedAt) === null || _a === void 0 ? void 0 : _a.toISOString(),
            closedAt: (_b = po.closedAt) === null || _b === void 0 ? void 0 : _b.toISOString(),
        };
    }
    static toGoodsReceiptLineDTO(line) {
        var _a;
        return {
            lineId: line.lineId,
            lineNo: line.lineNo,
            poLineId: line.poLineId,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            receivedQty: line.receivedQty,
            uom: line.uom,
            unitCostDoc: line.unitCostDoc,
            unitCostBase: line.unitCostBase,
            moveCurrency: line.moveCurrency,
            fxRateMovToBase: line.fxRateMovToBase,
            fxRateCCYToBase: line.fxRateCCYToBase,
            stockMovementId: (_a = line.stockMovementId) !== null && _a !== void 0 ? _a : null,
            description: line.description,
        };
    }
    static toGoodsReceiptDTO(grn) {
        var _a;
        return {
            id: grn.id,
            companyId: grn.companyId,
            grnNumber: grn.grnNumber,
            purchaseOrderId: grn.purchaseOrderId,
            vendorId: grn.vendorId,
            vendorName: grn.vendorName,
            receiptDate: grn.receiptDate,
            warehouseId: grn.warehouseId,
            lines: grn.lines.map((line) => PurchaseDTOMapper.toGoodsReceiptLineDTO(line)),
            status: grn.status,
            notes: grn.notes,
            createdBy: grn.createdBy,
            createdAt: grn.createdAt.toISOString(),
            updatedAt: grn.updatedAt.toISOString(),
            postedAt: (_a = grn.postedAt) === null || _a === void 0 ? void 0 : _a.toISOString(),
        };
    }
    static toPurchaseInvoiceLineDTO(line) {
        var _a;
        return {
            lineId: line.lineId,
            lineNo: line.lineNo,
            poLineId: line.poLineId,
            grnLineId: line.grnLineId,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            trackInventory: line.trackInventory,
            invoicedQty: line.invoicedQty,
            uom: line.uom,
            unitPriceDoc: line.unitPriceDoc,
            lineTotalDoc: line.lineTotalDoc,
            unitPriceBase: line.unitPriceBase,
            lineTotalBase: line.lineTotalBase,
            taxCodeId: line.taxCodeId,
            taxCode: line.taxCode,
            taxRate: line.taxRate,
            taxAmountDoc: line.taxAmountDoc,
            taxAmountBase: line.taxAmountBase,
            warehouseId: line.warehouseId,
            accountId: line.accountId,
            stockMovementId: (_a = line.stockMovementId) !== null && _a !== void 0 ? _a : null,
            description: line.description,
        };
    }
    static toPurchaseInvoiceDTO(pi) {
        var _a, _b;
        return {
            id: pi.id,
            companyId: pi.companyId,
            invoiceNumber: pi.invoiceNumber,
            vendorInvoiceNumber: pi.vendorInvoiceNumber,
            purchaseOrderId: pi.purchaseOrderId,
            vendorId: pi.vendorId,
            vendorName: pi.vendorName,
            invoiceDate: pi.invoiceDate,
            dueDate: pi.dueDate,
            currency: pi.currency,
            exchangeRate: pi.exchangeRate,
            lines: pi.lines.map((line) => PurchaseDTOMapper.toPurchaseInvoiceLineDTO(line)),
            subtotalDoc: pi.subtotalDoc,
            taxTotalDoc: pi.taxTotalDoc,
            grandTotalDoc: pi.grandTotalDoc,
            subtotalBase: pi.subtotalBase,
            taxTotalBase: pi.taxTotalBase,
            grandTotalBase: pi.grandTotalBase,
            paymentTermsDays: pi.paymentTermsDays,
            paymentStatus: pi.paymentStatus,
            paidAmountBase: pi.paidAmountBase,
            outstandingAmountBase: pi.outstandingAmountBase,
            status: pi.status,
            voucherId: (_a = pi.voucherId) !== null && _a !== void 0 ? _a : null,
            notes: pi.notes,
            createdBy: pi.createdBy,
            createdAt: pi.createdAt.toISOString(),
            updatedAt: pi.updatedAt.toISOString(),
            postedAt: (_b = pi.postedAt) === null || _b === void 0 ? void 0 : _b.toISOString(),
        };
    }
    static toPurchaseReturnLineDTO(line) {
        var _a;
        return {
            lineId: line.lineId,
            lineNo: line.lineNo,
            piLineId: line.piLineId,
            grnLineId: line.grnLineId,
            poLineId: line.poLineId,
            itemId: line.itemId,
            itemCode: line.itemCode,
            itemName: line.itemName,
            returnQty: line.returnQty,
            uom: line.uom,
            unitCostDoc: line.unitCostDoc,
            unitCostBase: line.unitCostBase,
            fxRateMovToBase: line.fxRateMovToBase,
            fxRateCCYToBase: line.fxRateCCYToBase,
            taxCodeId: line.taxCodeId,
            taxCode: line.taxCode,
            taxRate: line.taxRate,
            taxAmountDoc: line.taxAmountDoc,
            taxAmountBase: line.taxAmountBase,
            accountId: line.accountId,
            stockMovementId: (_a = line.stockMovementId) !== null && _a !== void 0 ? _a : null,
            description: line.description,
        };
    }
    static toPurchaseReturnDTO(purchaseReturn) {
        var _a, _b;
        return {
            id: purchaseReturn.id,
            companyId: purchaseReturn.companyId,
            returnNumber: purchaseReturn.returnNumber,
            purchaseInvoiceId: purchaseReturn.purchaseInvoiceId,
            goodsReceiptId: purchaseReturn.goodsReceiptId,
            purchaseOrderId: purchaseReturn.purchaseOrderId,
            vendorId: purchaseReturn.vendorId,
            vendorName: purchaseReturn.vendorName,
            returnContext: purchaseReturn.returnContext,
            returnDate: purchaseReturn.returnDate,
            warehouseId: purchaseReturn.warehouseId,
            currency: purchaseReturn.currency,
            exchangeRate: purchaseReturn.exchangeRate,
            lines: purchaseReturn.lines.map((line) => PurchaseDTOMapper.toPurchaseReturnLineDTO(line)),
            subtotalDoc: purchaseReturn.subtotalDoc,
            taxTotalDoc: purchaseReturn.taxTotalDoc,
            grandTotalDoc: purchaseReturn.grandTotalDoc,
            subtotalBase: purchaseReturn.subtotalBase,
            taxTotalBase: purchaseReturn.taxTotalBase,
            grandTotalBase: purchaseReturn.grandTotalBase,
            reason: purchaseReturn.reason,
            notes: purchaseReturn.notes,
            status: purchaseReturn.status,
            voucherId: (_a = purchaseReturn.voucherId) !== null && _a !== void 0 ? _a : null,
            createdBy: purchaseReturn.createdBy,
            createdAt: purchaseReturn.createdAt.toISOString(),
            updatedAt: purchaseReturn.updatedAt.toISOString(),
            postedAt: (_b = purchaseReturn.postedAt) === null || _b === void 0 ? void 0 : _b.toISOString(),
        };
    }
}
exports.PurchaseDTOMapper = PurchaseDTOMapper;
//# sourceMappingURL=PurchaseDTOs.js.map