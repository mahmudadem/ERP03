"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListPurchaseReturnsUseCase = exports.GetPurchaseReturnUseCase = exports.UnpostPurchaseReturnUseCase = exports.UpdatePurchaseReturnUseCase = exports.PostPurchaseReturnUseCase = exports.CreatePurchaseReturnUseCase = void 0;
const crypto_1 = require("crypto");
const DocumentPolicyResolver_1 = require("../../common/services/DocumentPolicyResolver");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const PurchaseReturn_1 = require("../../../domain/purchases/entities/PurchaseReturn");
const UomResolutionService_1 = require("../../inventory/services/UomResolutionService");
const PurchaseOrderUseCases_1 = require("./PurchaseOrderUseCases");
const PurchasePostingHelpers_1 = require("./PurchasePostingHelpers");
const determineReturnContext = (input) => {
    if (input.purchaseInvoiceId)
        return 'AFTER_INVOICE';
    if (input.goodsReceiptId)
        return 'BEFORE_INVOICE';
    if (input.vendorId)
        return 'DIRECT';
    throw new Error('purchaseInvoiceId, goodsReceiptId, or vendorId is required to create a purchase return');
};
const findPOLine = (po, poLineId, itemId) => {
    if (poLineId)
        return po.lines.find((line) => line.lineId === poLineId) || null;
    if (itemId)
        return po.lines.find((line) => line.itemId === itemId) || null;
    return null;
};
const findPILine = (pi, piLineId, itemId) => {
    if (piLineId)
        return pi.lines.find((line) => line.lineId === piLineId) || null;
    if (itemId)
        return pi.lines.find((line) => line.itemId === itemId) || null;
    return null;
};
const findGRNLine = (grn, grnLineId, itemId) => {
    if (grnLineId)
        return grn.lines.find((line) => line.lineId === grnLineId) || null;
    if (itemId)
        return grn.lines.find((line) => line.itemId === itemId) || null;
    return null;
};
const recalcPaymentStatus = (pi) => {
    if (pi.outstandingAmountBase <= 0)
        return 'PAID';
    if (pi.paidAmountBase > 0)
        return 'PARTIALLY_PAID';
    return 'UNPAID';
};
const recalcReturnTotals = (purchaseReturn) => {
    purchaseReturn.subtotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(purchaseReturn.lines.reduce((sum, line) => sum + (0, PurchasePostingHelpers_1.roundMoney)(line.returnQty * line.unitCostDoc), 0));
    purchaseReturn.subtotalBase = (0, PurchasePostingHelpers_1.roundMoney)(purchaseReturn.lines.reduce((sum, line) => sum + (0, PurchasePostingHelpers_1.roundMoney)(line.returnQty * line.unitCostBase), 0));
    purchaseReturn.taxTotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(purchaseReturn.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    purchaseReturn.taxTotalBase = (0, PurchasePostingHelpers_1.roundMoney)(purchaseReturn.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
    purchaseReturn.grandTotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(purchaseReturn.subtotalDoc + purchaseReturn.taxTotalDoc);
    purchaseReturn.grandTotalBase = (0, PurchasePostingHelpers_1.roundMoney)(purchaseReturn.subtotalBase + purchaseReturn.taxTotalBase);
};
class CreatePurchaseReturnUseCase {
    constructor(settingsRepo, purchaseReturnRepo, purchaseInvoiceRepo, goodsReceiptRepo, partyRepo, itemRepo) {
        this.settingsRepo = settingsRepo;
        this.purchaseReturnRepo = purchaseReturnRepo;
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.goodsReceiptRepo = goodsReceiptRepo;
        this.partyRepo = partyRepo;
        this.itemRepo = itemRepo;
    }
    async execute(input) {
        var _a, _b, _c;
        const settings = await this.settingsRepo.getSettings(input.companyId);
        if (!settings)
            throw new Error('Purchases module is not initialized');
        const returnContext = determineReturnContext(input);
        const now = new Date();
        if (returnContext === 'BEFORE_INVOICE' && !settings.requirePOForStockItems) {
            throw new Error('BEFORE_INVOICE returns require "Require Purchase Orders for Stock Items" to be enabled.');
        }
        let purchaseInvoice = null;
        let goodsReceipt = null;
        if (returnContext === 'AFTER_INVOICE') {
            purchaseInvoice = await this.purchaseInvoiceRepo.getById(input.companyId, input.purchaseInvoiceId);
            if (!purchaseInvoice)
                throw new Error(`Purchase invoice not found: ${input.purchaseInvoiceId}`);
            if (purchaseInvoice.status !== 'POSTED') {
                throw new Error('Purchase return AFTER_INVOICE requires a posted purchase invoice');
            }
        }
        else if (returnContext === 'BEFORE_INVOICE') {
            goodsReceipt = await this.goodsReceiptRepo.getById(input.companyId, input.goodsReceiptId);
            if (!goodsReceipt)
                throw new Error(`Goods receipt not found: ${input.goodsReceiptId}`);
            if (goodsReceipt.status !== 'POSTED') {
                throw new Error('Purchase return BEFORE_INVOICE requires a posted goods receipt');
            }
        }
        const lines = purchaseInvoice
            ? this.prefillLinesFromInvoice(purchaseInvoice, input.lines)
            : goodsReceipt
                ? this.prefillLinesFromGoodsReceipt(goodsReceipt, input.lines)
                : await this.createLinesDirectly(input.companyId, input.lines);
        const warehouseId = input.warehouseId
            || (purchaseInvoice ? (_a = purchaseInvoice.lines[0]) === null || _a === void 0 ? void 0 : _a.warehouseId : undefined)
            || (goodsReceipt === null || goodsReceipt === void 0 ? void 0 : goodsReceipt.warehouseId)
            || settings.defaultWarehouseId;
        if (!warehouseId) {
            throw new Error('warehouseId is required to create purchase return');
        }
        let vendorId = input.vendorId || (purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.vendorId) || (goodsReceipt === null || goodsReceipt === void 0 ? void 0 : goodsReceipt.vendorId);
        let vendorName = (purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.vendorName) || (goodsReceipt === null || goodsReceipt === void 0 ? void 0 : goodsReceipt.vendorName) || '';
        if (!vendorId) {
            throw new Error('vendorId is required for purchase return');
        }
        if (!vendorName) {
            const vendor = await this.partyRepo.getById(input.companyId, vendorId);
            vendorName = (vendor === null || vendor === void 0 ? void 0 : vendor.displayName) || '';
        }
        const purchaseReturn = new PurchaseReturn_1.PurchaseReturn({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            returnNumber: (0, PurchaseOrderUseCases_1.generateDocumentNumber)(settings, 'PR'),
            purchaseInvoiceId: purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.id,
            goodsReceiptId: goodsReceipt === null || goodsReceipt === void 0 ? void 0 : goodsReceipt.id,
            purchaseOrderId: input.purchaseOrderId || (purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.purchaseOrderId) || (goodsReceipt === null || goodsReceipt === void 0 ? void 0 : goodsReceipt.purchaseOrderId),
            vendorId,
            vendorName,
            returnContext,
            returnDate: input.returnDate,
            warehouseId,
            currency: input.currency || (purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.currency) || ((_b = goodsReceipt === null || goodsReceipt === void 0 ? void 0 : goodsReceipt.lines[0]) === null || _b === void 0 ? void 0 : _b.moveCurrency) || 'USD',
            exchangeRate: input.exchangeRate || (purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.exchangeRate) || ((_c = goodsReceipt === null || goodsReceipt === void 0 ? void 0 : goodsReceipt.lines[0]) === null || _c === void 0 ? void 0 : _c.fxRateMovToBase) || 1,
            lines,
            subtotalDoc: 0,
            taxTotalDoc: 0,
            grandTotalDoc: 0,
            subtotalBase: 0,
            taxTotalBase: 0,
            grandTotalBase: 0,
            reason: input.reason,
            notes: input.notes,
            status: 'DRAFT',
            voucherId: null,
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
        });
        await this.purchaseReturnRepo.create(purchaseReturn);
        await this.settingsRepo.saveSettings(settings);
        return purchaseReturn;
    }
    prefillLinesFromInvoice(purchaseInvoice, inputLines) {
        if (!(inputLines === null || inputLines === void 0 ? void 0 : inputLines.length)) {
            return purchaseInvoice.lines.map((line, index) => this.mapInvoiceLineToReturnLine(line, index + 1, undefined, purchaseInvoice.exchangeRate));
        }
        const mapped = inputLines.map((inputLine, index) => {
            const source = findPILine(purchaseInvoice, inputLine.piLineId, inputLine.itemId);
            if (!source) {
                throw new Error(`Invoice line not found for return line ${index + 1}`);
            }
            return this.mapInvoiceLineToReturnLine(source, index + 1, inputLine, purchaseInvoice.exchangeRate);
        });
        if (!mapped.length) {
            throw new Error('Purchase return must contain at least one line');
        }
        return mapped;
    }
    prefillLinesFromGoodsReceipt(goodsReceipt, inputLines) {
        if (!(inputLines === null || inputLines === void 0 ? void 0 : inputLines.length)) {
            return goodsReceipt.lines.map((line, index) => this.mapGRNLineToReturnLine(line, index + 1, undefined));
        }
        const mapped = inputLines.map((inputLine, index) => {
            const source = findGRNLine(goodsReceipt, inputLine.grnLineId, inputLine.itemId);
            if (!source) {
                throw new Error(`GRN line not found for return line ${index + 1}`);
            }
            return this.mapGRNLineToReturnLine(source, index + 1, inputLine);
        });
        if (!mapped.length) {
            throw new Error('Purchase return must contain at least one line');
        }
        return mapped;
    }
    mapInvoiceLineToReturnLine(invoiceLine, lineNo, inputLine, exchangeRate = 1) {
        var _a, _b;
        const returnQty = (_a = inputLine === null || inputLine === void 0 ? void 0 : inputLine.returnQty) !== null && _a !== void 0 ? _a : invoiceLine.invoicedQty;
        const taxRate = invoiceLine.taxRate || 0;
        const taxAmountDoc = (0, PurchasePostingHelpers_1.roundMoney)(returnQty * invoiceLine.unitPriceDoc * taxRate);
        const taxAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(returnQty * invoiceLine.unitPriceBase * taxRate);
        return {
            lineId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.lineId) || (0, crypto_1.randomUUID)(),
            lineNo: (_b = inputLine === null || inputLine === void 0 ? void 0 : inputLine.lineNo) !== null && _b !== void 0 ? _b : lineNo,
            piLineId: invoiceLine.lineId,
            grnLineId: invoiceLine.grnLineId,
            poLineId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.poLineId) || invoiceLine.poLineId,
            itemId: invoiceLine.itemId,
            itemCode: invoiceLine.itemCode,
            itemName: invoiceLine.itemName,
            returnQty,
            uomId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.uomId) || invoiceLine.uomId,
            uom: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.uom) || invoiceLine.uom,
            unitCostDoc: invoiceLine.unitPriceDoc,
            unitCostBase: invoiceLine.unitPriceBase,
            fxRateMovToBase: exchangeRate,
            fxRateCCYToBase: exchangeRate,
            taxCodeId: invoiceLine.taxCodeId,
            taxCode: invoiceLine.taxCode,
            taxRate,
            taxAmountDoc,
            taxAmountBase,
            accountId: invoiceLine.accountId,
            stockMovementId: null,
            description: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.description) || invoiceLine.description,
        };
    }
    mapGRNLineToReturnLine(grnLine, lineNo, inputLine) {
        var _a, _b;
        const returnQty = (_a = inputLine === null || inputLine === void 0 ? void 0 : inputLine.returnQty) !== null && _a !== void 0 ? _a : grnLine.receivedQty;
        return {
            lineId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.lineId) || (0, crypto_1.randomUUID)(),
            lineNo: (_b = inputLine === null || inputLine === void 0 ? void 0 : inputLine.lineNo) !== null && _b !== void 0 ? _b : lineNo,
            grnLineId: grnLine.lineId,
            poLineId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.poLineId) || grnLine.poLineId,
            itemId: grnLine.itemId,
            itemCode: grnLine.itemCode,
            itemName: grnLine.itemName,
            returnQty,
            uomId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.uomId) || grnLine.uomId,
            uom: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.uom) || grnLine.uom,
            unitCostDoc: grnLine.unitCostDoc,
            unitCostBase: grnLine.unitCostBase,
            fxRateMovToBase: grnLine.fxRateMovToBase,
            fxRateCCYToBase: grnLine.fxRateCCYToBase,
            taxRate: 0,
            taxAmountDoc: 0,
            taxAmountBase: 0,
            stockMovementId: null,
            description: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.description) || grnLine.description,
        };
    }
    async createLinesDirectly(companyId, inputLines) {
        if (!(inputLines === null || inputLines === void 0 ? void 0 : inputLines.length)) {
            throw new Error('DIRECT purchase return requires lines to be provided manually');
        }
        const lines = [];
        for (let i = 0; i < inputLines.length; i += 1) {
            const input = inputLines[i];
            if (!input.itemId)
                throw new Error(`Line ${i + 1}: itemId is required`);
            const item = await this.itemRepo.getItem(input.itemId);
            if (!item || item.companyId !== companyId)
                throw new Error(`Line ${i + 1}: Item not found: ${input.itemId}`);
            const qty = input.returnQty || 0;
            const unitCost = input.unitCostDoc || 0;
            lines.push({
                lineId: input.lineId || (0, crypto_1.randomUUID)(),
                lineNo: input.lineNo || (i + 1),
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                returnQty: qty,
                uomId: input.uomId || item.purchaseUomId || item.baseUomId,
                uom: input.uom || item.purchaseUom || item.baseUom,
                unitCostDoc: unitCost,
                unitCostBase: 0,
                fxRateMovToBase: 0,
                fxRateCCYToBase: 0,
                taxRate: 0,
                taxAmountDoc: 0,
                taxAmountBase: 0,
                description: input.description,
            });
        }
        return lines;
    }
}
exports.CreatePurchaseReturnUseCase = CreatePurchaseReturnUseCase;
class PostPurchaseReturnUseCase {
    constructor(settingsRepo, inventorySettingsRepo, purchaseReturnRepo, companySettingsRepo, purchaseInvoiceRepo, goodsReceiptRepo, purchaseOrderRepo, partyRepo, taxCodeRepo, itemRepo, uomConversionRepo, companyCurrencyRepo, inventoryService, accountingPostingService, transactionManager) {
        this.settingsRepo = settingsRepo;
        this.inventorySettingsRepo = inventorySettingsRepo;
        this.purchaseReturnRepo = purchaseReturnRepo;
        this.companySettingsRepo = companySettingsRepo;
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.goodsReceiptRepo = goodsReceiptRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.partyRepo = partyRepo;
        this.taxCodeRepo = taxCodeRepo;
        this.itemRepo = itemRepo;
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
        const purchaseReturn = await this.purchaseReturnRepo.getById(companyId, id);
        if (!purchaseReturn)
            throw new Error(`Purchase return not found: ${id}`);
        if (purchaseReturn.status !== 'DRAFT') {
            throw new Error('Only DRAFT purchase returns can be posted');
        }
        const isAfterInvoice = purchaseReturn.returnContext === 'AFTER_INVOICE';
        const isDirect = purchaseReturn.returnContext === 'DIRECT';
        const shouldCreateVoucher = DocumentPolicyResolver_1.DocumentPolicyResolver.shouldPurchaseReturnCreateVoucher(accountingMode, purchaseReturn.returnContext);
        let purchaseInvoice = null;
        let goodsReceipt = null;
        let purchaseOrder = null;
        if (isAfterInvoice) {
            if (!purchaseReturn.purchaseInvoiceId) {
                throw new Error('purchaseInvoiceId is required for AFTER_INVOICE return');
            }
            purchaseInvoice = await this.purchaseInvoiceRepo.getById(companyId, purchaseReturn.purchaseInvoiceId);
            if (!purchaseInvoice)
                throw new Error(`Purchase invoice not found: ${purchaseReturn.purchaseInvoiceId}`);
            if (purchaseInvoice.status !== 'POSTED') {
                throw new Error('Purchase return AFTER_INVOICE requires posted purchase invoice');
            }
        }
        else if (purchaseReturn.returnContext === 'BEFORE_INVOICE') {
            if (!settings.requirePOForStockItems) {
                throw new Error('BEFORE_INVOICE returns require "Require Purchase Orders for Stock Items" to be enabled.');
            }
            if (!purchaseReturn.goodsReceiptId) {
                throw new Error('goodsReceiptId is required for BEFORE_INVOICE return');
            }
            goodsReceipt = await this.goodsReceiptRepo.getById(companyId, purchaseReturn.goodsReceiptId);
            if (!goodsReceipt)
                throw new Error(`Goods receipt not found: ${purchaseReturn.goodsReceiptId}`);
            if (goodsReceipt.status !== 'POSTED') {
                throw new Error('Purchase return BEFORE_INVOICE requires posted goods receipt');
            }
        }
        if (purchaseReturn.purchaseOrderId) {
            purchaseOrder = await this.purchaseOrderRepo.getById(companyId, purchaseReturn.purchaseOrderId);
            if (!purchaseOrder)
                throw new Error(`Purchase order not found: ${purchaseReturn.purchaseOrderId}`);
        }
        const vendor = await this.partyRepo.getById(companyId, purchaseReturn.vendorId);
        if (!vendor)
            throw new Error(`Vendor not found: ${purchaseReturn.vendorId}`);
        const voucherLines = [];
        const currentRunQtyBySource = new Map();
        const originalMovementByGRNLineId = new Map();
        if (isAfterInvoice && (purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.purchaseOrderId)) {
            const grns = await this.goodsReceiptRepo.list(companyId, {
                purchaseOrderId: purchaseInvoice.purchaseOrderId,
                status: 'POSTED',
                limit: 500,
            });
            grns.forEach((grn) => {
                grn.lines.forEach((line) => {
                    if (line.stockMovementId) {
                        originalMovementByGRNLineId.set(line.lineId, line.stockMovementId);
                    }
                });
            });
        }
        await this.transactionManager.runTransaction(async (transaction) => {
            for (const line of purchaseReturn.lines) {
                const item = await this.itemRepo.getItem(line.itemId);
                if (!item || item.companyId !== companyId) {
                    throw new Error(`Item not found: ${line.itemId}`);
                }
                if (isAfterInvoice) {
                    const sourceLine = findPILine(purchaseInvoice, line.piLineId, line.itemId);
                    if (!sourceLine) {
                        throw new Error(`Purchase invoice line not found for return line ${line.lineId}`);
                    }
                    const sourceKey = `PI:${sourceLine.lineId}`;
                    const prevReturned = await this.getPreviouslyReturnedQtyForPILine(companyId, purchaseInvoice.id, sourceLine.lineId, purchaseReturn.id);
                    const currentRun = currentRunQtyBySource.get(sourceKey) || 0;
                    const remaining = (0, PurchasePostingHelpers_1.roundMoney)(sourceLine.invoicedQty - prevReturned - currentRun);
                    if (line.returnQty > remaining + 0.000001) {
                        throw new Error(`Return qty exceeds invoiced qty for ${line.itemName || sourceLine.itemName}`);
                    }
                    currentRunQtyBySource.set(sourceKey, (0, PurchasePostingHelpers_1.roundMoney)(currentRun + line.returnQty));
                    line.accountId = line.accountId || sourceLine.accountId;
                    line.taxCodeId = line.taxCodeId || sourceLine.taxCodeId;
                    line.taxCode = line.taxCode || sourceLine.taxCode;
                    line.taxRate = Number.isNaN(line.taxRate) ? sourceLine.taxRate : line.taxRate;
                    line.unitCostDoc = (0, PurchasePostingHelpers_1.roundMoney)(line.unitCostDoc || sourceLine.unitPriceDoc);
                    line.unitCostBase = (0, PurchasePostingHelpers_1.roundMoney)(line.unitCostBase || sourceLine.unitPriceBase);
                }
                else if (purchaseReturn.returnContext === 'BEFORE_INVOICE') {
                    const sourceLine = findGRNLine(goodsReceipt, line.grnLineId, line.itemId);
                    if (!sourceLine) {
                        throw new Error(`Goods receipt line not found for return line ${line.lineId}`);
                    }
                    const sourceKey = `GRN:${sourceLine.lineId}`;
                    const prevReturned = await this.getPreviouslyReturnedQtyForGRNLine(companyId, goodsReceipt.id, sourceLine.lineId, purchaseReturn.id);
                    const currentRun = currentRunQtyBySource.get(sourceKey) || 0;
                    const remaining = (0, PurchasePostingHelpers_1.roundMoney)(sourceLine.receivedQty - prevReturned - currentRun);
                    if (line.returnQty > remaining + 0.000001) {
                        throw new Error(`Return qty exceeds received qty for ${line.itemName || sourceLine.itemName}`);
                    }
                    currentRunQtyBySource.set(sourceKey, (0, PurchasePostingHelpers_1.roundMoney)(currentRun + line.returnQty));
                    line.unitCostDoc = (0, PurchasePostingHelpers_1.roundMoney)(line.unitCostDoc || sourceLine.unitCostDoc);
                    line.unitCostBase = (0, PurchasePostingHelpers_1.roundMoney)(line.unitCostBase || sourceLine.unitCostBase);
                    line.taxRate = 0;
                    line.taxCodeId = undefined;
                    line.taxCode = undefined;
                }
                else if (isDirect) {
                    line.accountId = line.accountId || settings.defaultPurchaseExpenseAccountId;
                    if (!line.accountId) {
                        throw new Error(`Account is required for manual return line ${line.lineId}`);
                    }
                    line.unitCostBase = (0, PurchasePostingHelpers_1.roundMoney)(line.unitCostDoc * purchaseReturn.exchangeRate);
                    line.taxRate = 0;
                }
                const lineTotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(line.returnQty * line.unitCostDoc);
                const lineTotalBase = (0, PurchasePostingHelpers_1.roundMoney)(line.returnQty * line.unitCostBase);
                line.taxAmountDoc = (0, PurchasePostingHelpers_1.roundMoney)(lineTotalDoc * (line.taxRate || 0));
                line.taxAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(lineTotalBase * (line.taxRate || 0));
                if (item.trackInventory) {
                    const conversionResult = await this.convertToBaseUom(companyId, line.returnQty, line.uomId, line.uom, item);
                    const qtyInBaseUom = conversionResult.qtyInBaseUom;
                    const reversesMovementId = this.findOriginalMovementId(line, purchaseInvoice, goodsReceipt, originalMovementByGRNLineId);
                    const movement = await this.inventoryService.processOUT({
                        companyId,
                        itemId: line.itemId,
                        warehouseId: purchaseReturn.warehouseId,
                        qty: qtyInBaseUom,
                        date: purchaseReturn.returnDate,
                        movementType: 'RETURN_OUT',
                        refs: {
                            type: 'PURCHASE_RETURN',
                            docId: purchaseReturn.id,
                            lineId: line.lineId,
                            reversesMovementId,
                        },
                        currentUser: purchaseReturn.createdBy,
                        metadata: {
                            uomConversion: {
                                conversionId: conversionResult.trace.conversionId,
                                mode: conversionResult.trace.mode,
                                appliedFactor: conversionResult.trace.factor,
                                sourceQty: line.returnQty,
                                sourceUomId: line.uomId,
                                sourceUom: line.uom,
                                baseUomId: item.baseUomId,
                                baseUom: item.baseUom,
                            },
                        },
                        transaction,
                    });
                    line.stockMovementId = movement.id;
                }
                if (isAfterInvoice && shouldCreateVoucher) {
                    const creditAccountId = item.trackInventory
                        ? this.resolveInventoryAccount(item, inventorySettings === null || inventorySettings === void 0 ? void 0 : inventorySettings.defaultInventoryAssetAccountId)
                        : line.accountId;
                    if (!creditAccountId) {
                        throw new Error(`accountId is required for AFTER_INVOICE return line ${line.lineId}`);
                    }
                    voucherLines.push({
                        accountId: creditAccountId,
                        side: 'Credit',
                        baseAmount: lineTotalBase,
                        docAmount: lineTotalDoc,
                        notes: `Return: ${line.itemName} x ${line.returnQty}`,
                        effectiveRate: line.unitCostDoc > 0 ? line.unitCostBase / line.unitCostDoc : purchaseReturn.exchangeRate,
                        metadata: {
                            sourceModule: 'purchases',
                            sourceType: 'PURCHASE_RETURN',
                            sourceId: purchaseReturn.id,
                            lineId: line.lineId,
                            itemId: line.itemId,
                        },
                    });
                    if (line.taxAmountBase > 0) {
                        const taxAccountId = await this.resolvePurchaseTaxAccount(companyId, line.taxCodeId);
                        voucherLines.push({
                            accountId: taxAccountId,
                            side: 'Credit',
                            baseAmount: line.taxAmountBase,
                            docAmount: line.taxAmountDoc,
                            notes: `Tax reversal: ${line.taxCode || line.taxCodeId || ''}`,
                            effectiveRate: line.taxAmountDoc > 0 ? line.taxAmountBase / line.taxAmountDoc : purchaseReturn.exchangeRate,
                            metadata: {
                                sourceModule: 'purchases',
                                sourceType: 'PURCHASE_RETURN',
                                sourceId: purchaseReturn.id,
                                lineId: line.lineId,
                                taxCodeId: line.taxCodeId,
                            },
                        });
                    }
                }
                else if (purchaseReturn.returnContext === 'BEFORE_INVOICE' && shouldCreateVoucher) {
                    const inventoryAccountId = this.resolveInventoryAccount(item, inventorySettings === null || inventorySettings === void 0 ? void 0 : inventorySettings.defaultInventoryAssetAccountId);
                    voucherLines.push({
                        accountId: inventoryAccountId,
                        side: 'Credit',
                        baseAmount: lineTotalBase,
                        docAmount: lineTotalDoc,
                        notes: `Return before invoice: ${line.itemName} x ${line.returnQty}`,
                        metadata: {
                            sourceModule: 'purchases',
                            sourceType: 'PURCHASE_RETURN',
                            sourceId: purchaseReturn.id,
                            lineId: line.lineId,
                            itemId: line.itemId,
                        },
                    });
                }
                else if (isDirect && shouldCreateVoucher) {
                    if (!line.accountId)
                        throw new Error(`Account is required for direct return line ${line.lineId}`);
                    voucherLines.push({
                        accountId: line.accountId,
                        side: 'Credit',
                        baseAmount: lineTotalBase,
                        docAmount: lineTotalDoc,
                        notes: `Direct Return: ${line.itemName} x ${line.returnQty}`,
                        metadata: {
                            sourceModule: 'purchases',
                            sourceType: 'PURCHASE_RETURN',
                            sourceId: purchaseReturn.id,
                            lineId: line.lineId,
                            itemId: line.itemId,
                        },
                    });
                }
                if (purchaseOrder) {
                    const poLine = findPOLine(purchaseOrder, line.poLineId, line.itemId);
                    if (poLine) {
                        if (!isAfterInvoice) {
                            const nextReceivedQty = (0, PurchasePostingHelpers_1.roundMoney)(poLine.receivedQty - line.returnQty);
                            if (nextReceivedQty < -0.000001) {
                                throw new Error(`Return qty would make receivedQty negative for PO line ${poLine.lineId}`);
                            }
                            poLine.receivedQty = Math.max(0, nextReceivedQty);
                        }
                        poLine.returnedQty = (0, PurchasePostingHelpers_1.roundMoney)(poLine.returnedQty + line.returnQty);
                    }
                }
            }
            recalcReturnTotals(purchaseReturn);
            if (isAfterInvoice || isDirect) {
                const apAccountId = this.resolveAPAccount(vendor, settings.defaultAPAccountId);
                const apDebitBase = (0, PurchasePostingHelpers_1.roundMoney)(purchaseReturn.grandTotalDoc * purchaseReturn.exchangeRate);
                voucherLines.push({
                    accountId: apAccountId,
                    side: 'Debit',
                    baseAmount: apDebitBase,
                    docAmount: purchaseReturn.grandTotalDoc,
                    notes: `AP reversal - ${purchaseReturn.vendorName} - Return ${purchaseReturn.returnNumber} @ ${purchaseReturn.exchangeRate}`,
                    effectiveRate: purchaseReturn.exchangeRate,
                    metadata: {
                        sourceModule: 'purchases',
                        sourceType: 'PURCHASE_RETURN',
                        sourceId: purchaseReturn.id,
                        vendorId: purchaseReturn.vendorId,
                    },
                });
                const inventoryTaxCreditBase = purchaseReturn.grandTotalBase;
                const exchangeDiff = (0, PurchasePostingHelpers_1.roundMoney)(apDebitBase - inventoryTaxCreditBase);
                if (Math.abs(exchangeDiff) > 0.001) {
                    let gainLossAccountId = settings.exchangeGainLossAccountId;
                    if (!gainLossAccountId) {
                        const globalSettings = await this.companySettingsRepo.getSettings(companyId);
                        gainLossAccountId = globalSettings === null || globalSettings === void 0 ? void 0 : globalSettings.exchangeGainLossAccountId;
                    }
                    if (!gainLossAccountId) {
                        throw new Error('Exchange Gain/Loss account is not configured in Purchases or Global Accounting Settings. Cannot post multi-currency return with rate difference.');
                    }
                    voucherLines.push({
                        accountId: gainLossAccountId,
                        side: exchangeDiff > 0 ? 'Credit' : 'Debit',
                        baseAmount: Math.abs(exchangeDiff),
                        docAmount: 0,
                        notes: `Exchange ${exchangeDiff > 0 ? 'Gain' : 'Loss'} on Purchase Return ${purchaseReturn.returnNumber}`,
                        metadata: {
                            sourceModule: 'purchases',
                            sourceType: 'PURCHASE_RETURN',
                            sourceId: purchaseReturn.id,
                            isExchangeDifference: true,
                        },
                    });
                }
                const voucher = await this.accountingPostingService.postInTransaction({
                    companyId,
                    voucherType: VoucherTypes_1.VoucherType.PURCHASE_RETURN,
                    voucherNo: `RET-VCH-${purchaseReturn.returnNumber}`,
                    date: purchaseReturn.returnDate,
                    description: `Purchase Return: ${purchaseReturn.returnNumber} - ${purchaseReturn.vendorName}`,
                    currency: purchaseReturn.currency,
                    exchangeRate: purchaseReturn.exchangeRate,
                    lines: voucherLines,
                    metadata: {
                        sourceModule: 'purchases',
                        sourceType: 'PURCHASE_RETURN',
                        sourceId: purchaseReturn.id,
                        originType: 'purchase_return',
                    },
                    createdBy: purchaseReturn.createdBy,
                    postingLockPolicy: VoucherTypes_1.PostingLockPolicy.STRICT_LOCKED,
                    reference: purchaseReturn.returnNumber,
                }, transaction);
                purchaseReturn.voucherId = voucher.id;
                if (isAfterInvoice) {
                    const invoice = purchaseInvoice;
                    invoice.outstandingAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(invoice.outstandingAmountBase - purchaseReturn.grandTotalBase);
                    invoice.paymentStatus = recalcPaymentStatus(invoice);
                    invoice.updatedAt = new Date();
                    await this.purchaseInvoiceRepo.update(invoice, transaction);
                }
            }
            else if (shouldCreateVoucher) {
                if (!settings.defaultGRNIAccountId) {
                    throw new Error('Default GRNI account is required for perpetual goods-return reversals before invoice.');
                }
                voucherLines.push({
                    accountId: settings.defaultGRNIAccountId,
                    side: 'Debit',
                    baseAmount: purchaseReturn.grandTotalBase,
                    docAmount: purchaseReturn.grandTotalDoc,
                    notes: `GRNI reversal - ${purchaseReturn.vendorName} - Return ${purchaseReturn.returnNumber}`,
                    metadata: {
                        sourceModule: 'purchases',
                        sourceType: 'PURCHASE_RETURN',
                        sourceId: purchaseReturn.id,
                        vendorId: purchaseReturn.vendorId,
                    },
                });
                const voucher = await this.accountingPostingService.postInTransaction({
                    companyId,
                    voucherType: VoucherTypes_1.VoucherType.PURCHASE_RETURN,
                    voucherNo: `RET-VCH-${purchaseReturn.returnNumber}`,
                    date: purchaseReturn.returnDate,
                    description: `Purchase Return: ${purchaseReturn.returnNumber} - ${purchaseReturn.vendorName}`,
                    currency: purchaseReturn.currency,
                    exchangeRate: purchaseReturn.exchangeRate,
                    lines: voucherLines,
                    metadata: {
                        sourceModule: 'purchases',
                        sourceType: 'PURCHASE_RETURN',
                        sourceId: purchaseReturn.id,
                        originType: 'purchase_return',
                    },
                    createdBy: purchaseReturn.createdBy,
                    postingLockPolicy: VoucherTypes_1.PostingLockPolicy.STRICT_LOCKED,
                    reference: purchaseReturn.returnNumber,
                }, transaction);
                purchaseReturn.voucherId = voucher.id;
            }
            else {
                purchaseReturn.voucherId = null;
            }
            purchaseReturn.status = 'POSTED';
            purchaseReturn.postedAt = new Date();
            purchaseReturn.updatedAt = new Date();
            await this.purchaseReturnRepo.update(purchaseReturn, transaction);
            if (purchaseOrder) {
                purchaseOrder.status = (0, PurchasePostingHelpers_1.updatePOStatus)(purchaseOrder);
                purchaseOrder.updatedAt = new Date();
                await this.purchaseOrderRepo.update(purchaseOrder, transaction);
            }
        });
        const posted = await this.purchaseReturnRepo.getById(companyId, id);
        if (!posted)
            throw new Error(`Purchase return not found after posting: ${id}`);
        return posted;
    }
    resolveAPAccount(vendor, defaultAPAccountId) {
        return vendor.defaultAPAccountId || defaultAPAccountId;
    }
    resolveInventoryAccount(item, defaultInventoryAccountId) {
        const inventoryAccountId = item.inventoryAssetAccountId || defaultInventoryAccountId;
        if (!inventoryAccountId) {
            throw new Error(`No inventory account configured for item ${item.code}`);
        }
        return inventoryAccountId;
    }
    async resolvePurchaseTaxAccount(companyId, taxCodeId) {
        if (!taxCodeId)
            throw new Error('taxCodeId is required for tax reversal line');
        const taxCode = await this.taxCodeRepo.getById(companyId, taxCodeId);
        if (!taxCode)
            throw new Error(`Tax code not found: ${taxCodeId}`);
        if (!taxCode.purchaseTaxAccountId) {
            throw new Error(`TaxCode ${taxCode.code} has no purchase tax account`);
        }
        return taxCode.purchaseTaxAccountId;
    }
    async convertToBaseUom(companyId, qty, uomId, uom, item) {
        const conversions = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
        return (0, UomResolutionService_1.convertItemQtyToBaseUomDetailed)({
            qty,
            item,
            conversions,
            fromUomId: uomId,
            fromUom: uom,
            round: VoucherLineEntity_1.roundMoney,
            itemCode: item.code,
        });
    }
    async getPreviouslyReturnedQtyForPILine(companyId, purchaseInvoiceId, piLineId, excludeReturnId) {
        const returns = await this.purchaseReturnRepo.list(companyId, {
            purchaseInvoiceId,
            status: 'POSTED',
        });
        return (0, PurchasePostingHelpers_1.roundMoney)(returns.reduce((sum, entry) => {
            if (entry.id === excludeReturnId)
                return sum;
            const qty = entry.lines
                .filter((line) => line.piLineId === piLineId)
                .reduce((lineSum, line) => lineSum + line.returnQty, 0);
            return sum + qty;
        }, 0));
    }
    async getPreviouslyReturnedQtyForGRNLine(companyId, goodsReceiptId, grnLineId, excludeReturnId) {
        const returns = await this.purchaseReturnRepo.list(companyId, {
            goodsReceiptId,
            status: 'POSTED',
        });
        return (0, PurchasePostingHelpers_1.roundMoney)(returns.reduce((sum, entry) => {
            if (entry.id === excludeReturnId)
                return sum;
            const qty = entry.lines
                .filter((line) => line.grnLineId === grnLineId)
                .reduce((lineSum, line) => lineSum + line.returnQty, 0);
            return sum + qty;
        }, 0));
    }
    findOriginalMovementId(line, purchaseInvoice, goodsReceipt, grnMovementByLineId) {
        if (line.grnLineId && goodsReceipt) {
            const source = findGRNLine(goodsReceipt, line.grnLineId, line.itemId);
            return source === null || source === void 0 ? void 0 : source.stockMovementId;
        }
        if (line.grnLineId) {
            return grnMovementByLineId.get(line.grnLineId);
        }
        return undefined;
    }
}
exports.PostPurchaseReturnUseCase = PostPurchaseReturnUseCase;
class UpdatePurchaseReturnUseCase {
    constructor(purchaseReturnRepo, partyRepo, itemRepo) {
        this.purchaseReturnRepo = purchaseReturnRepo;
        this.partyRepo = partyRepo;
        this.itemRepo = itemRepo;
    }
    async execute(input) {
        const existing = await this.purchaseReturnRepo.getById(input.companyId, input.id);
        if (!existing)
            throw new Error(`Purchase return not found: ${input.id}`);
        if (existing.status !== 'DRAFT') {
            throw new Error('Only DRAFT purchase returns can be updated directly. Unpost the document first if it is already posted.');
        }
        if (input.vendorId && input.vendorId !== existing.vendorId) {
            if (existing.purchaseInvoiceId || existing.goodsReceiptId) {
                throw new Error('Vendor cannot be changed for a source-linked return.');
            }
            const vendor = await this.partyRepo.getById(input.companyId, input.vendorId);
            if (!vendor)
                throw new Error(`Vendor not found: ${input.vendorId}`);
            existing.vendorId = vendor.id;
            existing.vendorName = vendor.displayName || '';
        }
        if (input.returnDate)
            existing.returnDate = input.returnDate;
        if (input.warehouseId)
            existing.warehouseId = input.warehouseId;
        if (input.reason)
            existing.reason = input.reason;
        if (input.notes !== undefined)
            existing.notes = input.notes;
        if (input.currency)
            existing.currency = input.currency;
        if (input.exchangeRate)
            existing.exchangeRate = input.exchangeRate;
        if (input.lines) {
            const newLines = [];
            for (let i = 0; i < input.lines.length; i++) {
                const lineInput = input.lines[i];
                if (!lineInput.itemId)
                    throw new Error(`Line ${i + 1}: itemId is required`);
                const item = await this.itemRepo.getItem(lineInput.itemId);
                if (!item)
                    throw new Error(`Line ${i + 1}: Item not found: ${lineInput.itemId}`);
                const returnQty = lineInput.returnQty || 0;
                const unitCostDoc = lineInput.unitCostDoc || 0;
                const unitCostBase = (0, PurchasePostingHelpers_1.roundMoney)(unitCostDoc * existing.exchangeRate);
                newLines.push({
                    lineId: lineInput.lineId || (0, crypto_1.randomUUID)(),
                    lineNo: lineInput.lineNo || (i + 1),
                    piLineId: lineInput.piLineId,
                    grnLineId: lineInput.grnLineId,
                    poLineId: lineInput.poLineId,
                    itemId: item.id,
                    itemCode: item.code,
                    itemName: item.name,
                    returnQty,
                    uomId: lineInput.uomId || item.purchaseUomId || item.baseUomId,
                    uom: lineInput.uom || item.purchaseUom || item.baseUom,
                    unitCostDoc,
                    unitCostBase,
                    fxRateMovToBase: existing.exchangeRate,
                    fxRateCCYToBase: existing.exchangeRate,
                    taxRate: 0,
                    taxAmountDoc: 0,
                    taxAmountBase: 0,
                    accountId: lineInput.accountId,
                    description: lineInput.description,
                });
            }
            existing.lines = newLines;
        }
        recalcReturnTotals(existing);
        existing.updatedAt = new Date();
        await this.purchaseReturnRepo.update(existing);
        return existing;
    }
}
exports.UpdatePurchaseReturnUseCase = UpdatePurchaseReturnUseCase;
class UnpostPurchaseReturnUseCase {
    constructor(purchaseReturnRepo, purchaseInvoiceRepo, purchaseOrderRepo, goodsReceiptRepo, inventoryService, accountingPostingService, transactionManager) {
        this.purchaseReturnRepo = purchaseReturnRepo;
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.goodsReceiptRepo = goodsReceiptRepo;
        this.inventoryService = inventoryService;
        this.accountingPostingService = accountingPostingService;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id, currentUser) {
        const purchaseReturn = await this.purchaseReturnRepo.getById(companyId, id);
        if (!purchaseReturn)
            throw new Error(`Purchase return not found: ${id}`);
        if (purchaseReturn.status !== 'POSTED') {
            throw new Error('Only POSTED purchase returns can be unposted');
        }
        let purchaseInvoice = null;
        let purchaseOrder = null;
        if (purchaseReturn.purchaseInvoiceId) {
            purchaseInvoice = await this.purchaseInvoiceRepo.getById(companyId, purchaseReturn.purchaseInvoiceId);
        }
        if (purchaseReturn.purchaseOrderId) {
            purchaseOrder = await this.purchaseOrderRepo.getById(companyId, purchaseReturn.purchaseOrderId);
        }
        await this.transactionManager.runTransaction(async (transaction) => {
            if (purchaseReturn.voucherId) {
                await this.accountingPostingService.deleteVoucherInTransaction(companyId, purchaseReturn.voucherId, transaction);
                purchaseReturn.voucherId = null;
            }
            for (const line of purchaseReturn.lines) {
                if (line.stockMovementId) {
                    await this.inventoryService.deleteMovement(companyId, line.stockMovementId, transaction);
                    line.stockMovementId = null;
                }
                if (purchaseOrder) {
                    const poLine = findPOLine(purchaseOrder, line.poLineId, line.itemId);
                    if (poLine) {
                        if (purchaseReturn.returnContext === 'BEFORE_INVOICE') {
                            poLine.receivedQty = (0, PurchasePostingHelpers_1.roundMoney)(poLine.receivedQty + line.returnQty);
                        }
                        poLine.returnedQty = (0, PurchasePostingHelpers_1.roundMoney)(poLine.returnedQty - line.returnQty);
                    }
                }
            }
            if (purchaseInvoice) {
                purchaseInvoice.outstandingAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(purchaseInvoice.outstandingAmountBase + purchaseReturn.grandTotalBase);
                purchaseInvoice.paymentStatus = recalcPaymentStatus(purchaseInvoice);
                purchaseInvoice.updatedAt = new Date();
                await this.purchaseInvoiceRepo.update(purchaseInvoice, transaction);
            }
            if (purchaseOrder) {
                purchaseOrder.status = (0, PurchasePostingHelpers_1.updatePOStatus)(purchaseOrder);
                purchaseOrder.updatedAt = new Date();
                await this.purchaseOrderRepo.update(purchaseOrder, transaction);
            }
            purchaseReturn.status = 'DRAFT';
            purchaseReturn.postedAt = undefined;
            purchaseReturn.updatedAt = new Date();
            await this.purchaseReturnRepo.update(purchaseReturn, transaction);
        });
        const unposted = await this.purchaseReturnRepo.getById(companyId, id);
        if (!unposted)
            throw new Error('Failed to retrieve return after unposting');
        return unposted;
    }
}
exports.UnpostPurchaseReturnUseCase = UnpostPurchaseReturnUseCase;
class GetPurchaseReturnUseCase {
    constructor(purchaseReturnRepo) {
        this.purchaseReturnRepo = purchaseReturnRepo;
    }
    async execute(companyId, id) {
        const pr = await this.purchaseReturnRepo.getById(companyId, id);
        if (!pr)
            throw new Error(`Purchase return not found: ${id}`);
        return pr;
    }
}
exports.GetPurchaseReturnUseCase = GetPurchaseReturnUseCase;
class ListPurchaseReturnsUseCase {
    constructor(purchaseReturnRepo) {
        this.purchaseReturnRepo = purchaseReturnRepo;
    }
    async execute(companyId, filters) {
        return this.purchaseReturnRepo.list(companyId, filters);
    }
}
exports.ListPurchaseReturnsUseCase = ListPurchaseReturnsUseCase;
//# sourceMappingURL=PurchaseReturnUseCases.js.map