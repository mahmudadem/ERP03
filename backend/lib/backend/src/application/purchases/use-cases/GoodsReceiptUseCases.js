"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnpostGoodsReceiptUseCase = exports.UpdateGoodsReceiptUseCase = exports.ListGoodsReceiptsUseCase = exports.GetGoodsReceiptUseCase = exports.PostGoodsReceiptUseCase = exports.CreateGoodsReceiptUseCase = void 0;
const crypto_1 = require("crypto");
const DocumentPolicyResolver_1 = require("../../common/services/DocumentPolicyResolver");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const GoodsReceipt_1 = require("../../../domain/purchases/entities/GoodsReceipt");
const StockLevel_1 = require("../../../domain/inventory/entities/StockLevel");
const StockMovement_1 = require("../../../domain/inventory/entities/StockMovement");
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
    constructor(settingsRepo, inventorySettingsRepo, goodsReceiptRepo, purchaseOrderRepo, itemRepo, warehouseRepo, uomConversionRepo, companyCurrencyRepo, inventoryService, companyModuleRepo, accountingPostingService, accountRepo, transactionManager) {
        this.settingsRepo = settingsRepo;
        this.inventorySettingsRepo = inventorySettingsRepo;
        this.goodsReceiptRepo = goodsReceiptRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.itemRepo = itemRepo;
        this.warehouseRepo = warehouseRepo;
        this.uomConversionRepo = uomConversionRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
        this.inventoryService = inventoryService;
        this.companyModuleRepo = companyModuleRepo;
        this.accountingPostingService = accountingPostingService;
        this.accountRepo = accountRepo;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id, createAccountingEffect = true) {
        // ===================================================================
        // FIRESTORE TRANSACTION RULE: All reads must complete before any writes.
        // We pre-fetch ALL data here. The postingLogic callback only writes.
        // ===================================================================
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings)
            throw new Error('Purchases module is not initialized');
        const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
        const accountingMode = DocumentPolicyResolver_1.DocumentPolicyResolver.resolveAccountingMode(invSettings);
        const shouldPostAccounting = createAccountingEffect && await this.isAccountingEnabled(companyId);
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
        // PHASE 1A: PRE-FETCH ALL MASTER DATA (bare reads before transaction)
        const distinctItemIds = [...new Set(grn.lines.map(l => l.itemId))];
        const itemsMap = new Map();
        for (const itemId of distinctItemIds) {
            const item = await this.itemRepo.getItem(itemId);
            if (item && item.companyId === companyId) {
                itemsMap.set(item.id, item);
            }
        }
        // Validate all items track inventory
        for (const line of grn.lines) {
            const item = itemsMap.get(line.itemId);
            if (!item || item.companyId !== companyId)
                throw new Error(`Item not found: ${line.itemId}`);
            if (!item.trackInventory)
                throw new Error(`Goods receipt line item must track inventory: ${item.code}`);
        }
        // PHASE 1B: PRE-FETCH STOCK LEVELS (bare reads before transaction)
        const stockLevelMap = new Map();
        for (const line of grn.lines) {
            const key = `${line.itemId}|${grn.warehouseId}`;
            if (!stockLevelMap.has(key)) {
                const existing = await this.inventoryService.preFetchStockLevel(companyId, line.itemId, grn.warehouseId);
                stockLevelMap.set(key, existing !== null && existing !== void 0 ? existing : StockLevel_1.StockLevel.createNew(companyId, line.itemId, grn.warehouseId));
            }
        }
        // PHASE 1C: PRE-FETCH UOM CONVERSIONS (bare reads before transaction)
        const uomConversionMap = new Map();
        for (const itemId of distinctItemIds) {
            const item = itemsMap.get(itemId);
            if (item && !uomConversionMap.has(item.id)) {
                const convs = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
                uomConversionMap.set(item.id, convs);
            }
        }
        // PHASE 1D: COMPUTE INVENTORY MOVEMENTS OUTSIDE TRANSACTION (pure computation)
        const inventoryMovements = new Map();
        const receiptAccountingBucket = new Map();
        for (const line of grn.lines) {
            const item = itemsMap.get(line.itemId);
            const poLine = po ? findPOLine(po, line.poLineId, line.itemId) : null;
            if (po && !poLine) {
                throw new Error(`PO line not found for GRN line ${line.lineId}`);
            }
            // Guarantee a meaningful inbound cost
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
            const convs = uomConversionMap.get(item.id) || [];
            const conversionResult = (0, UomResolutionService_1.convertItemQtyToBaseUomDetailed)({
                qty: line.receivedQty,
                item,
                conversions: convs,
                fromUomId: line.uomId,
                fromUom: line.uom,
                round: PurchasePostingHelpers_1.roundMoney,
                itemCode: item.code,
            });
            const qtyInBaseUom = conversionResult.qtyInBaseUom;
            // Compute IN movement (mirrors processIN logic but without DB reads)
            const stockLevelKey = `${item.id}|${grn.warehouseId}`;
            const level = stockLevelMap.get(stockLevelKey);
            if (!level)
                throw new Error(`Stock level not pre-fetched for item ${item.code}`);
            const qtyBefore = level.qtyOnHand;
            const oldMaxBusinessDate = level.maxBusinessDate;
            const unitCostBase = (0, PurchasePostingHelpers_1.roundMoney)(line.unitCostDoc * line.fxRateMovToBase);
            const unitCostCCY = (0, PurchasePostingHelpers_1.roundMoney)(line.unitCostDoc * (line.fxRateCCYToBase || line.fxRateMovToBase));
            const totalCostBase = (0, PurchasePostingHelpers_1.roundMoney)(unitCostBase * qtyInBaseUom);
            const totalCostCCY = (0, PurchasePostingHelpers_1.roundMoney)(unitCostCCY * qtyInBaseUom);
            const moveCurrency = (line.moveCurrency || item.costCurrency || 'USD').toUpperCase();
            const fxRateMovToBase = line.fxRateMovToBase || 1;
            const fxRateCCYToBase = line.fxRateCCYToBase || fxRateMovToBase;
            // AVG cost recalculation
            let newAvgBase = unitCostBase;
            let newAvgCCY = unitCostCCY;
            if (qtyBefore > 0) {
                const newQty = qtyBefore + qtyInBaseUom;
                newAvgBase = (0, PurchasePostingHelpers_1.roundMoney)(((level.avgCostBase * qtyBefore) + (unitCostBase * qtyInBaseUom)) / newQty);
                newAvgCCY = (0, PurchasePostingHelpers_1.roundMoney)(((level.avgCostCCY * qtyBefore) + (unitCostCCY * qtyInBaseUom)) / newQty);
            }
            const settlesNegativeQty = Math.min(qtyInBaseUom, Math.max(-qtyBefore, 0));
            const newPositiveQty = qtyInBaseUom - settlesNegativeQty;
            const qtyAfter = qtyBefore + qtyInBaseUom;
            const movement = new StockMovement_1.StockMovement({
                id: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                companyId,
                date: grn.receiptDate,
                postingSeq: level.postingSeq + 1,
                createdAt: new Date(),
                createdBy: grn.createdBy,
                postedAt: new Date(),
                itemId: item.id,
                warehouseId: grn.warehouseId,
                direction: 'IN',
                movementType: 'PURCHASE_RECEIPT',
                qty: qtyInBaseUom,
                uom: item.baseUom,
                referenceType: 'GOODS_RECEIPT',
                referenceId: grn.id,
                referenceLineId: line.lineId,
                unitCostBase,
                totalCostBase,
                unitCostCCY,
                totalCostCCY,
                movementCurrency: moveCurrency,
                fxRateMovToBase,
                fxRateCCYToBase,
                fxRateKind: 'DOCUMENT',
                avgCostBaseAfter: newAvgBase,
                avgCostCCYAfter: newAvgCCY,
                qtyBefore,
                qtyAfter,
                settlesNegativeQty,
                newPositiveQty,
                negativeQtyAtPosting: qtyAfter < 0,
                costSettled: true,
                isBackdated: grn.receiptDate < oldMaxBusinessDate,
                costSource: 'PURCHASE',
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
            });
            // Update stock level in memory
            level.qtyOnHand += qtyInBaseUom;
            level.avgCostBase = newAvgBase;
            level.avgCostCCY = newAvgCCY;
            level.lastCostBase = unitCostBase;
            level.lastCostCCY = unitCostCCY;
            level.postingSeq += 1;
            level.version += 1;
            level.totalMovements += 1;
            level.maxBusinessDate = grn.receiptDate > oldMaxBusinessDate ? grn.receiptDate : oldMaxBusinessDate;
            level.updatedAt = new Date();
            level.lastMovementId = movement.id;
            line.stockMovementId = movement.id;
            line.unitCostBase = (0, PurchasePostingHelpers_1.roundMoney)(movement.unitCostBase || line.unitCostBase);
            if (poLine) {
                poLine.receivedQty = (0, PurchasePostingHelpers_1.roundMoney)(poLine.receivedQty + line.receivedQty);
            }
            inventoryMovements.set(line.lineId, { movement, updatedLevel: level });
            // Pre-resolve inventory account ID for accounting
            if (DocumentPolicyResolver_1.DocumentPolicyResolver.shouldPostGoodsReceiptAccounting(accountingMode)) {
                const inventoryAccountId = item.inventoryAssetAccountId || (invSettings === null || invSettings === void 0 ? void 0 : invSettings.defaultInventoryAssetAccountId);
                if (!inventoryAccountId) {
                    throw new Error(`No inventory account configured for item ${item.code}`);
                }
                const resolvedInventoryId = await this.resolveAccountId(companyId, inventoryAccountId);
                const current = receiptAccountingBucket.get(resolvedInventoryId) || 0;
                receiptAccountingBucket.set(resolvedInventoryId, (0, PurchasePostingHelpers_1.roundMoney)(current + (movement.totalCostBase || (0, PurchasePostingHelpers_1.roundMoney)(qtyInBaseUom * line.unitCostBase))));
            }
        }
        // Pre-resolve base currency and GRNI account
        const resolvedBaseCurrency = (baseCurrency || 'USD').toUpperCase();
        // PHASE 2: TRANSACTION CALLBACK — WRITES ONLY
        await this.transactionManager.runTransaction(async (transaction) => {
            // Write inventory movements and stock levels
            for (const [, { movement, updatedLevel }] of inventoryMovements) {
                await this.inventoryService.writeStockMovement(movement, transaction);
                await this.inventoryService.writeStockLevel(updatedLevel, transaction);
            }
            // Create GRNI voucher if needed
            if (DocumentPolicyResolver_1.DocumentPolicyResolver.shouldPostGoodsReceiptAccounting(accountingMode) && receiptAccountingBucket.size > 0) {
                if (!settings.defaultGRNIAccountId) {
                    throw new Error('Default GRNI account is required for perpetual goods receipt posting.');
                }
                const resolvedGRNIAccountId = await this.resolveAccountId(companyId, settings.defaultGRNIAccountId);
                const voucherLines = [];
                let totalBase = 0;
                for (const [inventoryAccountId, amount] of Array.from(receiptAccountingBucket.entries())) {
                    totalBase = (0, PurchasePostingHelpers_1.roundMoney)(totalBase + amount);
                    voucherLines.push({
                        accountId: inventoryAccountId,
                        side: 'Debit',
                        amount,
                        baseAmount: amount,
                        docAmount: amount,
                    });
                }
                voucherLines.push({
                    accountId: resolvedGRNIAccountId,
                    side: 'Credit',
                    amount: totalBase,
                    baseAmount: totalBase,
                    docAmount: totalBase,
                });
                if (shouldPostAccounting) {
                    const voucher = await this.accountingPostingService.postInTransaction({
                        companyId,
                        voucherType: VoucherTypes_1.VoucherType.JOURNAL_ENTRY,
                        voucherNo: `GRN-${grn.grnNumber}`,
                        date: grn.receiptDate,
                        description: `Goods Receipt ${grn.grnNumber}`,
                        currency: resolvedBaseCurrency,
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
                        baseCurrencyOverride: resolvedBaseCurrency,
                        skipAccountValidation: true,
                    }, transaction);
                    grn.voucherId = voucher.id;
                }
                else {
                    grn.voucherId = null;
                }
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
    async resolveAccountId(companyId, idOrCode) {
        if (!idOrCode)
            return '';
        if (!this.accountRepo)
            return idOrCode;
        const acc = (await this.accountRepo.getById(companyId, idOrCode)) || (await this.accountRepo.getByUserCode(companyId, idOrCode));
        return acc ? acc.id : idOrCode;
    }
    async isAccountingEnabled(companyId) {
        const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
        return !!(accountingModule === null || accountingModule === void 0 ? void 0 : accountingModule.initialized);
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
    constructor(goodsReceiptRepo, purchaseOrderRepo, inventoryService, companyModuleRepo, accountingPostingService, transactionManager) {
        this.goodsReceiptRepo = goodsReceiptRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.inventoryService = inventoryService;
        this.companyModuleRepo = companyModuleRepo;
        this.accountingPostingService = accountingPostingService;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id, createAccountingEffect = true) {
        const grn = await this.goodsReceiptRepo.getById(companyId, id);
        if (!grn)
            throw new Error(`Goods receipt not found: ${id}`);
        if (grn.status !== 'POSTED')
            throw new Error('Only POSTED goods receipts can be unposted');
        const shouldPostAccounting = createAccountingEffect && await this.isAccountingEnabled(companyId);
        let po = null;
        if (grn.purchaseOrderId) {
            po = await this.purchaseOrderRepo.getById(companyId, grn.purchaseOrderId);
        }
        await this.transactionManager.runTransaction(async (transaction) => {
            if (shouldPostAccounting) {
                if (grn.voucherId) {
                    await this.accountingPostingService.deleteVoucherInTransaction(companyId, grn.voucherId, transaction);
                    grn.voucherId = null;
                }
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
    async isAccountingEnabled(companyId) {
        const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
        return !!(accountingModule === null || accountingModule === void 0 ? void 0 : accountingModule.initialized);
    }
}
exports.UnpostGoodsReceiptUseCase = UnpostGoodsReceiptUseCase;
//# sourceMappingURL=GoodsReceiptUseCases.js.map