"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListGoodsReceiptsUseCase = exports.GetGoodsReceiptUseCase = exports.PostGoodsReceiptUseCase = exports.CreateGoodsReceiptUseCase = void 0;
const crypto_1 = require("crypto");
const GoodsReceipt_1 = require("../../../domain/purchases/entities/GoodsReceipt");
const PurchaseOrderUseCases_1 = require("./PurchaseOrderUseCases");
const PurchasePostingHelpers_1 = require("./PurchasePostingHelpers");
const validatePOLinkedForReceipt = (po) => {
    if (!['CONFIRMED', 'PARTIALLY_RECEIVED'].includes(po.status)) {
        throw new Error(`Purchase order must be CONFIRMED or PARTIALLY_RECEIVED. Current: ${po.status}`);
    }
};
const findPOLine = (po, poLineId, itemId) => {
    if (poLineId) {
        return po.lines.find((line) => line.lineId === poLineId) || null;
    }
    if (itemId) {
        return po.lines.find((line) => line.itemId === itemId) || null;
    }
    return null;
};
class CreateGoodsReceiptUseCase {
    constructor(settingsRepo, goodsReceiptRepo, purchaseOrderRepo, partyRepo, itemRepo) {
        this.settingsRepo = settingsRepo;
        this.goodsReceiptRepo = goodsReceiptRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.partyRepo = partyRepo;
        this.itemRepo = itemRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g;
        const settings = await this.settingsRepo.getSettings(input.companyId);
        if (!settings) {
            throw new Error('Purchases module is not initialized');
        }
        if (settings.procurementControlMode === 'CONTROLLED' && !input.purchaseOrderId) {
            throw new Error('purchaseOrderId is required in CONTROLLED mode');
        }
        let po = null;
        if (input.purchaseOrderId) {
            po = await this.purchaseOrderRepo.getById(input.companyId, input.purchaseOrderId);
            if (!po)
                throw new Error(`Purchase order not found: ${input.purchaseOrderId}`);
            validatePOLinkedForReceipt(po);
        }
        let vendorId = input.vendorId || '';
        let vendorName = '';
        if (po) {
            vendorId = po.vendorId;
            vendorName = po.vendorName;
        }
        else {
            if (!vendorId)
                throw new Error('vendorId is required for standalone goods receipt');
            const vendor = await this.partyRepo.getById(input.companyId, vendorId);
            if (!vendor)
                throw new Error(`Vendor not found: ${vendorId}`);
            if (!vendor.roles.includes('VENDOR'))
                throw new Error(`Party is not a vendor: ${vendorId}`);
            vendorName = vendor.displayName;
        }
        const sourceLines = this.resolveSourceLines(input.lines, po);
        const lines = [];
        for (let i = 0; i < sourceLines.length; i += 1) {
            const line = sourceLines[i];
            const poLine = po ? findPOLine(po, line.poLineId, line.itemId) : null;
            const itemId = line.itemId || (poLine === null || poLine === void 0 ? void 0 : poLine.itemId);
            if (!itemId) {
                throw new Error(`Line ${i + 1}: itemId is required`);
            }
            const item = await this.itemRepo.getItem(itemId);
            if (!item || item.companyId !== input.companyId) {
                throw new Error(`Item not found: ${itemId}`);
            }
            const receivedQty = (_a = line.receivedQty) !== null && _a !== void 0 ? _a : (poLine ? Math.max(poLine.orderedQty - poLine.receivedQty, 0) : 0);
            const unitCostDoc = (_c = (_b = line.unitCostDoc) !== null && _b !== void 0 ? _b : poLine === null || poLine === void 0 ? void 0 : poLine.unitPriceDoc) !== null && _c !== void 0 ? _c : 0;
            const moveCurrency = (line.moveCurrency || (po === null || po === void 0 ? void 0 : po.currency) || item.costCurrency || 'USD').toUpperCase();
            const fxRateMovToBase = (_e = (_d = line.fxRateMovToBase) !== null && _d !== void 0 ? _d : po === null || po === void 0 ? void 0 : po.exchangeRate) !== null && _e !== void 0 ? _e : 1;
            const fxRateCCYToBase = (_f = line.fxRateCCYToBase) !== null && _f !== void 0 ? _f : fxRateMovToBase;
            lines.push({
                lineId: line.lineId || (0, crypto_1.randomUUID)(),
                lineNo: (_g = line.lineNo) !== null && _g !== void 0 ? _g : i + 1,
                poLineId: line.poLineId || (poLine === null || poLine === void 0 ? void 0 : poLine.lineId),
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                receivedQty,
                uom: line.uom || (poLine === null || poLine === void 0 ? void 0 : poLine.uom) || item.purchaseUom || item.baseUom,
                unitCostDoc,
                unitCostBase: (0, PurchasePostingHelpers_1.roundMoney)(unitCostDoc * fxRateMovToBase),
                moveCurrency,
                fxRateMovToBase,
                fxRateCCYToBase,
                stockMovementId: null,
                description: line.description,
            });
        }
        const now = new Date();
        const grn = new GoodsReceipt_1.GoodsReceipt({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            grnNumber: (0, PurchaseOrderUseCases_1.generateDocumentNumber)(settings, 'GRN'),
            purchaseOrderId: po === null || po === void 0 ? void 0 : po.id,
            vendorId,
            vendorName,
            receiptDate: input.receiptDate,
            warehouseId: input.warehouseId,
            lines,
            status: 'DRAFT',
            notes: input.notes,
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
        });
        await this.goodsReceiptRepo.create(grn);
        await this.settingsRepo.saveSettings(settings);
        return grn;
    }
    resolveSourceLines(lines, po) {
        if (Array.isArray(lines) && lines.length > 0) {
            return lines;
        }
        if (!po) {
            throw new Error('At least one line is required');
        }
        return po.lines
            .filter((line) => line.trackInventory && line.orderedQty - line.receivedQty > 0)
            .map((line) => ({
            poLineId: line.lineId,
            itemId: line.itemId,
            receivedQty: (0, PurchasePostingHelpers_1.roundMoney)(line.orderedQty - line.receivedQty),
            uom: line.uom,
            unitCostDoc: line.unitPriceDoc,
            moveCurrency: po.currency,
            fxRateMovToBase: po.exchangeRate,
            fxRateCCYToBase: po.exchangeRate,
            description: line.description,
        }));
    }
}
exports.CreateGoodsReceiptUseCase = CreateGoodsReceiptUseCase;
class PostGoodsReceiptUseCase {
    constructor(settingsRepo, goodsReceiptRepo, purchaseOrderRepo, itemRepo, warehouseRepo, uomConversionRepo, inventoryService, transactionManager) {
        this.settingsRepo = settingsRepo;
        this.goodsReceiptRepo = goodsReceiptRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.itemRepo = itemRepo;
        this.warehouseRepo = warehouseRepo;
        this.uomConversionRepo = uomConversionRepo;
        this.inventoryService = inventoryService;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id) {
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings)
            throw new Error('Purchases module is not initialized');
        const grn = await this.goodsReceiptRepo.getById(companyId, id);
        if (!grn)
            throw new Error(`Goods receipt not found: ${id}`);
        if (grn.status !== 'DRAFT')
            throw new Error('Only DRAFT goods receipts can be posted');
        const warehouse = await this.warehouseRepo.getWarehouse(grn.warehouseId);
        if (!warehouse || warehouse.companyId !== companyId) {
            throw new Error(`Warehouse not found: ${grn.warehouseId}`);
        }
        let po = null;
        if (settings.procurementControlMode === 'CONTROLLED') {
            if (!grn.purchaseOrderId) {
                throw new Error('purchaseOrderId is required in CONTROLLED mode');
            }
        }
        if (grn.purchaseOrderId) {
            po = await this.purchaseOrderRepo.getById(companyId, grn.purchaseOrderId);
            if (!po)
                throw new Error(`Purchase order not found: ${grn.purchaseOrderId}`);
            if (settings.procurementControlMode === 'CONTROLLED') {
                validatePOLinkedForReceipt(po);
            }
        }
        await this.transactionManager.runTransaction(async (transaction) => {
            for (const line of grn.lines) {
                const item = await this.itemRepo.getItem(line.itemId);
                if (!item || item.companyId !== companyId) {
                    throw new Error(`Item not found: ${line.itemId}`);
                }
                if (!item.trackInventory) {
                    throw new Error(`Goods receipt line item must track inventory: ${item.code}`);
                }
                const poLine = po ? findPOLine(po, line.poLineId, line.itemId) : null;
                if (po && !poLine) {
                    throw new Error(`PO line not found for GRN line ${line.lineId}`);
                }
                if (poLine) {
                    const openQty = poLine.orderedQty - poLine.receivedQty;
                    if (!settings.allowOverDelivery) {
                        if (line.receivedQty > openQty + 0.000001) {
                            throw new Error(`Received qty exceeds open qty for item ${line.itemName || poLine.itemName}`);
                        }
                    }
                    else {
                        const maxQty = openQty * (1 + settings.overDeliveryTolerancePct / 100);
                        if (line.receivedQty > maxQty + 0.000001) {
                            throw new Error(`Received qty exceeds tolerance for item ${line.itemName || poLine.itemName}`);
                        }
                    }
                }
                const qtyInBaseUom = await this.convertToBaseUom(companyId, line.receivedQty, line.uom, item.baseUom, item.id, item.code);
                const movement = await this.inventoryService.processIN({
                    companyId,
                    itemId: line.itemId,
                    warehouseId: grn.warehouseId,
                    qty: qtyInBaseUom,
                    date: grn.receiptDate,
                    movementType: 'PURCHASE_RECEIPT',
                    refs: {
                        type: 'GOODS_RECEIPT',
                        docId: grn.id,
                        lineId: line.lineId,
                    },
                    currentUser: grn.createdBy,
                    unitCostInMoveCurrency: line.unitCostDoc,
                    moveCurrency: line.moveCurrency,
                    fxRateMovToBase: line.fxRateMovToBase,
                    fxRateCCYToBase: line.fxRateCCYToBase,
                    transaction,
                });
                line.stockMovementId = movement.id;
                if (poLine) {
                    poLine.receivedQty = (0, PurchasePostingHelpers_1.roundMoney)(poLine.receivedQty + line.receivedQty);
                }
            }
            grn.status = 'POSTED';
            grn.postedAt = new Date();
            grn.updatedAt = new Date();
            await this.goodsReceiptRepo.update(grn, transaction);
            if (po) {
                po.status = (0, PurchasePostingHelpers_1.updatePOStatus)(po);
                po.updatedAt = new Date();
                await this.purchaseOrderRepo.update(po, transaction);
            }
        });
        const posted = await this.goodsReceiptRepo.getById(companyId, id);
        if (!posted)
            throw new Error(`Goods receipt not found after posting: ${id}`);
        return posted;
    }
    async convertToBaseUom(companyId, qty, uom, baseUom, itemId, itemCode) {
        if (uom.toUpperCase() === baseUom.toUpperCase()) {
            return qty;
        }
        const conversions = await this.uomConversionRepo.getConversionsForItem(companyId, itemId, { active: true });
        const normalizedFrom = uom.toUpperCase();
        const normalizedTo = baseUom.toUpperCase();
        const direct = conversions.find((conversion) => conversion.active &&
            conversion.fromUom.toUpperCase() === normalizedFrom &&
            conversion.toUom.toUpperCase() === normalizedTo);
        if (direct)
            return (0, PurchasePostingHelpers_1.roundMoney)(qty * direct.factor);
        const reverse = conversions.find((conversion) => conversion.active &&
            conversion.fromUom.toUpperCase() === normalizedTo &&
            conversion.toUom.toUpperCase() === normalizedFrom);
        if (reverse)
            return (0, PurchasePostingHelpers_1.roundMoney)(qty / reverse.factor);
        throw new Error(`No UOM conversion from ${uom} to ${baseUom} for item ${itemCode}`);
    }
}
exports.PostGoodsReceiptUseCase = PostGoodsReceiptUseCase;
class GetGoodsReceiptUseCase {
    constructor(goodsReceiptRepo) {
        this.goodsReceiptRepo = goodsReceiptRepo;
    }
    async execute(companyId, id) {
        const grn = await this.goodsReceiptRepo.getById(companyId, id);
        if (!grn)
            throw new Error(`Goods receipt not found: ${id}`);
        return grn;
    }
}
exports.GetGoodsReceiptUseCase = GetGoodsReceiptUseCase;
class ListGoodsReceiptsUseCase {
    constructor(goodsReceiptRepo) {
        this.goodsReceiptRepo = goodsReceiptRepo;
    }
    async execute(companyId, filters = {}) {
        return this.goodsReceiptRepo.list(companyId, {
            purchaseOrderId: filters.purchaseOrderId,
            status: filters.status,
            limit: filters.limit,
        });
    }
}
exports.ListGoodsReceiptsUseCase = ListGoodsReceiptsUseCase;
//# sourceMappingURL=GoodsReceiptUseCases.js.map