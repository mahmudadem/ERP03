"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnpostGoodsReceiptUseCase = exports.UpdateGoodsReceiptUseCase = exports.ListGoodsReceiptsUseCase = exports.GetGoodsReceiptUseCase = exports.PostGoodsReceiptUseCase = exports.CreateGoodsReceiptUseCase = void 0;
const crypto_1 = require("crypto");
const DocumentPolicyResolver_1 = require("../../common/services/DocumentPolicyResolver");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const GoodsReceipt_1 = require("../../../domain/purchases/entities/GoodsReceipt");
const UomResolutionService_1 = require("../../inventory/services/UomResolutionService");
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
        if (settings.requirePOForStockItems && !input.purchaseOrderId) {
            throw new Error('A Purchase Order reference is required to create a goods receipt.');
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
                uomId: line.uomId || (poLine === null || poLine === void 0 ? void 0 : poLine.uomId) || item.purchaseUomId || item.baseUomId,
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
            uomId: line.uomId,
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
    constructor(settingsRepo, inventorySettingsRepo, goodsReceiptRepo, purchaseOrderRepo, itemRepo, warehouseRepo, uomConversionRepo, companyCurrencyRepo, inventoryService, accountingPostingService, transactionManager) {
        this.settingsRepo = settingsRepo;
        this.inventorySettingsRepo = inventorySettingsRepo;
        this.goodsReceiptRepo = goodsReceiptRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.itemRepo = itemRepo;
        this.warehouseRepo = warehouseRepo;
        this.uomConversionRepo = uomConversionRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
        this.inventoryService = inventoryService;
        this.accountingPostingService = accountingPostingService;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id) {
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings)
            throw new Error('Purchases module is not initialized');
        const inventorySettings = await this.inventorySettingsRepo.getSettings(companyId);
        const accountingMode = DocumentPolicyResolver_1.DocumentPolicyResolver.resolveAccountingMode(inventorySettings);
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
        if (settings.requirePOForStockItems) {
            if (!grn.purchaseOrderId) {
                throw new Error('A Purchase Order reference is required to post a goods receipt.');
            }
        }
        if (grn.purchaseOrderId) {
            po = await this.purchaseOrderRepo.getById(companyId, grn.purchaseOrderId);
            if (!po)
                throw new Error(`Purchase order not found: ${grn.purchaseOrderId}`);
            if (settings.requirePOForStockItems) {
                validatePOLinkedForReceipt(po);
            }
        }
        const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || 'USD';
        const receiptAccountingBucket = new Map();
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
                // Guarantee a meaningful inbound cost so stock valuation and gross profit stay reliable.
                if (line.unitCostDoc <= 0) {
                    if (poLine && poLine.unitPriceDoc > 0) {
                        line.unitCostDoc = poLine.unitPriceDoc;
                        line.unitCostBase = (0, PurchasePostingHelpers_1.roundMoney)(line.unitCostDoc * line.fxRateMovToBase);
                    }
                    else {
                        throw new Error(`Unit cost must be greater than 0 for stock item ${line.itemCode || item.code}`);
                    }
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
                const conversionResult = await this.convertToBaseUom(companyId, line.receivedQty, line.uomId, line.uom, item);
                const qtyInBaseUom = conversionResult.qtyInBaseUom;
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
                    metadata: {
                        uomConversion: {
                            conversionId: conversionResult.trace.conversionId,
                            mode: conversionResult.trace.mode,
                            appliedFactor: conversionResult.trace.factor,
                            sourceQty: line.receivedQty,
                            sourceUomId: line.uomId,
                            sourceUom: line.uom,
                            baseUomId: item.baseUomId,
                            baseUom: item.baseUom,
                        },
                    },
                    transaction,
                });
                line.stockMovementId = movement.id;
                line.unitCostBase = (0, PurchasePostingHelpers_1.roundMoney)(movement.unitCostBase || line.unitCostBase);
                if (poLine) {
                    poLine.receivedQty = (0, PurchasePostingHelpers_1.roundMoney)(poLine.receivedQty + line.receivedQty);
                }
                if (DocumentPolicyResolver_1.DocumentPolicyResolver.shouldPostGoodsReceiptAccounting(accountingMode)) {
                    const inventoryAccountId = item.inventoryAssetAccountId || (inventorySettings === null || inventorySettings === void 0 ? void 0 : inventorySettings.defaultInventoryAssetAccountId);
                    if (!inventoryAccountId) {
                        throw new Error(`No inventory account configured for item ${item.code}`);
                    }
                    const current = receiptAccountingBucket.get(inventoryAccountId) || 0;
                    receiptAccountingBucket.set(inventoryAccountId, (0, PurchasePostingHelpers_1.roundMoney)(current + (movement.totalCostBase || (0, PurchasePostingHelpers_1.roundMoney)(qtyInBaseUom * line.unitCostBase))));
                }
            }
            if (DocumentPolicyResolver_1.DocumentPolicyResolver.shouldPostGoodsReceiptAccounting(accountingMode) && receiptAccountingBucket.size > 0) {
                if (!settings.defaultGRNIAccountId) {
                    throw new Error('Default GRNI account is required for perpetual goods receipt posting.');
                }
                const voucherLines = [];
                let totalBase = 0;
                for (const [inventoryAccountId, amount] of Array.from(receiptAccountingBucket.entries())) {
                    totalBase = (0, PurchasePostingHelpers_1.roundMoney)(totalBase + amount);
                    voucherLines.push({
                        accountId: inventoryAccountId,
                        side: 'Debit',
                        amount,
                    });
                }
                voucherLines.push({
                    accountId: settings.defaultGRNIAccountId,
                    side: 'Credit',
                    amount: totalBase,
                });
                const voucher = await this.accountingPostingService.postInTransaction({
                    companyId,
                    voucherType: VoucherTypes_1.VoucherType.JOURNAL_ENTRY,
                    voucherNo: `GRN-${grn.grnNumber}`,
                    date: grn.receiptDate,
                    description: `Goods Receipt ${grn.grnNumber}`,
                    currency: baseCurrency,
                    exchangeRate: 1,
                    lines: voucherLines,
                    metadata: {
                        sourceModule: 'purchases',
                        sourceType: 'GOODS_RECEIPT',
                        sourceId: grn.id,
                    },
                    createdBy: grn.createdBy,
                    postingLockPolicy: VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED,
                    reference: grn.grnNumber,
                }, transaction);
                grn.voucherId = voucher.id;
            }
            else {
                grn.voucherId = null;
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
    async convertToBaseUom(companyId, qty, uomId, uom, item) {
        const conversions = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
        return (0, UomResolutionService_1.convertItemQtyToBaseUomDetailed)({
            qty,
            item,
            conversions,
            fromUomId: uomId,
            fromUom: uom,
            round: PurchasePostingHelpers_1.roundMoney,
            itemCode: item.code,
        });
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
class UpdateGoodsReceiptUseCase {
    constructor(goodsReceiptRepo, partyRepo) {
        this.goodsReceiptRepo = goodsReceiptRepo;
        this.partyRepo = partyRepo;
    }
    async execute(input) {
        const current = await this.goodsReceiptRepo.getById(input.companyId, input.id);
        if (!current)
            throw new Error(`Goods receipt not found: ${input.id}`);
        if (current.status !== 'DRAFT') {
            throw new Error('Only draft goods receipts can be updated');
        }
        if (input.vendorId !== undefined) {
            if (!input.vendorId)
                throw new Error('vendorId is required');
            const vendor = await this.partyRepo.getById(input.companyId, input.vendorId);
            if (!vendor)
                throw new Error(`Vendor not found: ${input.vendorId}`);
            if (!vendor.roles.includes('VENDOR'))
                throw new Error(`Party is not a vendor: ${input.vendorId}`);
            current.vendorId = vendor.id;
            current.vendorName = vendor.displayName;
        }
        if (input.receiptDate !== undefined)
            current.receiptDate = input.receiptDate;
        if (input.warehouseId !== undefined)
            current.warehouseId = input.warehouseId;
        if (input.notes !== undefined)
            current.notes = input.notes;
        if (input.lines) {
            const existingById = new Map(current.lines.map((line) => [line.lineId, line]));
            const mappedLines = input.lines.map((line, index) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o;
                const existing = line.lineId ? existingById.get(line.lineId) : undefined;
                return {
                    lineId: line.lineId || (0, crypto_1.randomUUID)(),
                    lineNo: (_b = (_a = line.lineNo) !== null && _a !== void 0 ? _a : existing === null || existing === void 0 ? void 0 : existing.lineNo) !== null && _b !== void 0 ? _b : index + 1,
                    poLineId: (_c = line.poLineId) !== null && _c !== void 0 ? _c : existing === null || existing === void 0 ? void 0 : existing.poLineId,
                    itemId: line.itemId || (existing === null || existing === void 0 ? void 0 : existing.itemId) || '',
                    itemCode: (existing === null || existing === void 0 ? void 0 : existing.itemCode) || '',
                    itemName: (existing === null || existing === void 0 ? void 0 : existing.itemName) || '',
                    receivedQty: line.receivedQty,
                    uomId: (_d = line.uomId) !== null && _d !== void 0 ? _d : existing === null || existing === void 0 ? void 0 : existing.uomId,
                    uom: line.uom || (existing === null || existing === void 0 ? void 0 : existing.uom) || 'EA',
                    unitCostDoc: (_f = (_e = line.unitCostDoc) !== null && _e !== void 0 ? _e : existing === null || existing === void 0 ? void 0 : existing.unitCostDoc) !== null && _f !== void 0 ? _f : 0,
                    unitCostBase: (_g = existing === null || existing === void 0 ? void 0 : existing.unitCostBase) !== null && _g !== void 0 ? _g : 0,
                    moveCurrency: line.moveCurrency || (existing === null || existing === void 0 ? void 0 : existing.moveCurrency) || 'USD',
                    fxRateMovToBase: (_j = (_h = line.fxRateMovToBase) !== null && _h !== void 0 ? _h : existing === null || existing === void 0 ? void 0 : existing.fxRateMovToBase) !== null && _j !== void 0 ? _j : 1,
                    fxRateCCYToBase: (_l = (_k = line.fxRateCCYToBase) !== null && _k !== void 0 ? _k : existing === null || existing === void 0 ? void 0 : existing.fxRateCCYToBase) !== null && _l !== void 0 ? _l : 1,
                    stockMovementId: (_m = existing === null || existing === void 0 ? void 0 : existing.stockMovementId) !== null && _m !== void 0 ? _m : null,
                    description: (_o = line.description) !== null && _o !== void 0 ? _o : existing === null || existing === void 0 ? void 0 : existing.description,
                };
            });
            current.lines = mappedLines;
        }
        current.updatedAt = new Date();
        const updated = new GoodsReceipt_1.GoodsReceipt(current.toJSON());
        await this.goodsReceiptRepo.update(updated);
        return updated;
    }
}
exports.UpdateGoodsReceiptUseCase = UpdateGoodsReceiptUseCase;
class UnpostGoodsReceiptUseCase {
    constructor(goodsReceiptRepo, purchaseOrderRepo, inventoryService, accountingPostingService, transactionManager) {
        this.goodsReceiptRepo = goodsReceiptRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.inventoryService = inventoryService;
        this.accountingPostingService = accountingPostingService;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id) {
        const grn = await this.goodsReceiptRepo.getById(companyId, id);
        if (!grn)
            throw new Error(`Goods receipt not found: ${id}`);
        if (grn.status !== 'POSTED')
            throw new Error('Only POSTED goods receipts can be unposted');
        let po = null;
        if (grn.purchaseOrderId) {
            po = await this.purchaseOrderRepo.getById(companyId, grn.purchaseOrderId);
        }
        await this.transactionManager.runTransaction(async (transaction) => {
            if (grn.voucherId) {
                await this.accountingPostingService.deleteVoucherInTransaction(companyId, grn.voucherId, transaction);
                grn.voucherId = null;
            }
            // 1. Reverse inventory movements
            for (const line of grn.lines) {
                if (line.stockMovementId) {
                    await this.inventoryService.deleteMovement(companyId, line.stockMovementId, transaction);
                    line.stockMovementId = null;
                }
                // 2. Reverse PO receivedQty
                if (po) {
                    const poLine = findPOLine(po, line.poLineId, line.itemId);
                    if (poLine) {
                        poLine.receivedQty = (0, PurchasePostingHelpers_1.roundMoney)(Math.max(0, poLine.receivedQty - line.receivedQty));
                    }
                }
            }
            // 3. Update PO status
            if (po) {
                po.status = (0, PurchasePostingHelpers_1.updatePOStatus)(po);
                po.updatedAt = new Date();
                await this.purchaseOrderRepo.update(po, transaction);
            }
            // 4. Revert GRN to DRAFT
            grn.status = 'DRAFT';
            grn.postedAt = undefined;
            grn.updatedAt = new Date();
            await this.goodsReceiptRepo.update(grn, transaction);
        });
        const unposted = await this.goodsReceiptRepo.getById(companyId, id);
        if (!unposted)
            throw new Error('Failed to retrieve goods receipt after unposting');
        return unposted;
    }
}
exports.UnpostGoodsReceiptUseCase = UnpostGoodsReceiptUseCase;
//# sourceMappingURL=GoodsReceiptUseCases.js.map