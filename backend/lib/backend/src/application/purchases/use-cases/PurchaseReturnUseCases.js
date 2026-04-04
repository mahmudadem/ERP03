"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListPurchaseReturnsUseCase = exports.GetPurchaseReturnUseCase = exports.PostPurchaseReturnUseCase = exports.CreatePurchaseReturnUseCase = void 0;
const crypto_1 = require("crypto");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const PurchaseReturn_1 = require("../../../domain/purchases/entities/PurchaseReturn");
const PurchaseOrderUseCases_1 = require("./PurchaseOrderUseCases");
const PurchasePostingHelpers_1 = require("./PurchasePostingHelpers");
const determineReturnContext = (input) => {
    if (input.purchaseInvoiceId)
        return 'AFTER_INVOICE';
    if (input.goodsReceiptId)
        return 'BEFORE_INVOICE';
    throw new Error('purchaseInvoiceId or goodsReceiptId is required to create a purchase return');
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
    constructor(settingsRepo, purchaseReturnRepo, purchaseInvoiceRepo, goodsReceiptRepo) {
        this.settingsRepo = settingsRepo;
        this.purchaseReturnRepo = purchaseReturnRepo;
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.goodsReceiptRepo = goodsReceiptRepo;
    }
    async execute(input) {
        var _a, _b, _c;
        const settings = await this.settingsRepo.getSettings(input.companyId);
        if (!settings)
            throw new Error('Purchases module is not initialized');
        const returnContext = determineReturnContext(input);
        const now = new Date();
        if (returnContext === 'BEFORE_INVOICE' && settings.procurementControlMode !== 'CONTROLLED') {
            throw new Error('BEFORE_INVOICE returns are only allowed in CONTROLLED mode');
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
        else {
            goodsReceipt = await this.goodsReceiptRepo.getById(input.companyId, input.goodsReceiptId);
            if (!goodsReceipt)
                throw new Error(`Goods receipt not found: ${input.goodsReceiptId}`);
            if (goodsReceipt.status !== 'POSTED') {
                throw new Error('Purchase return BEFORE_INVOICE requires a posted goods receipt');
            }
        }
        const lines = purchaseInvoice
            ? this.prefillLinesFromInvoice(purchaseInvoice, input.lines)
            : this.prefillLinesFromGoodsReceipt(goodsReceipt, input.lines);
        const warehouseId = input.warehouseId
            || (purchaseInvoice ? (_a = purchaseInvoice.lines[0]) === null || _a === void 0 ? void 0 : _a.warehouseId : undefined)
            || (goodsReceipt === null || goodsReceipt === void 0 ? void 0 : goodsReceipt.warehouseId)
            || settings.defaultWarehouseId;
        if (!warehouseId) {
            throw new Error('warehouseId is required to create purchase return');
        }
        const purchaseReturn = new PurchaseReturn_1.PurchaseReturn({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            returnNumber: (0, PurchaseOrderUseCases_1.generateDocumentNumber)(settings, 'PR'),
            purchaseInvoiceId: purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.id,
            goodsReceiptId: goodsReceipt === null || goodsReceipt === void 0 ? void 0 : goodsReceipt.id,
            purchaseOrderId: input.purchaseOrderId || (purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.purchaseOrderId) || (goodsReceipt === null || goodsReceipt === void 0 ? void 0 : goodsReceipt.purchaseOrderId),
            vendorId: (purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.vendorId) || goodsReceipt.vendorId,
            vendorName: (purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.vendorName) || goodsReceipt.vendorName,
            returnContext,
            returnDate: input.returnDate,
            warehouseId,
            currency: (purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.currency) || ((_b = goodsReceipt === null || goodsReceipt === void 0 ? void 0 : goodsReceipt.lines[0]) === null || _b === void 0 ? void 0 : _b.moveCurrency) || 'USD',
            exchangeRate: (purchaseInvoice === null || purchaseInvoice === void 0 ? void 0 : purchaseInvoice.exchangeRate) || ((_c = goodsReceipt === null || goodsReceipt === void 0 ? void 0 : goodsReceipt.lines[0]) === null || _c === void 0 ? void 0 : _c.fxRateMovToBase) || 1,
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
            uom: invoiceLine.uom,
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
            uom: grnLine.uom,
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
}
exports.CreatePurchaseReturnUseCase = CreatePurchaseReturnUseCase;
class PostPurchaseReturnUseCase {
    constructor(settingsRepo, purchaseReturnRepo, purchaseInvoiceRepo, goodsReceiptRepo, purchaseOrderRepo, partyRepo, taxCodeRepo, itemRepo, uomConversionRepo, companyCurrencyRepo, inventoryService, voucherRepo, ledgerRepo, transactionManager) {
        this.settingsRepo = settingsRepo;
        this.purchaseReturnRepo = purchaseReturnRepo;
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.goodsReceiptRepo = goodsReceiptRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.partyRepo = partyRepo;
        this.taxCodeRepo = taxCodeRepo;
        this.itemRepo = itemRepo;
        this.uomConversionRepo = uomConversionRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
        this.inventoryService = inventoryService;
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id) {
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings)
            throw new Error('Purchases module is not initialized');
        const purchaseReturn = await this.purchaseReturnRepo.getById(companyId, id);
        if (!purchaseReturn)
            throw new Error(`Purchase return not found: ${id}`);
        if (purchaseReturn.status !== 'DRAFT') {
            throw new Error('Only DRAFT purchase returns can be posted');
        }
        const isAfterInvoice = purchaseReturn.returnContext === 'AFTER_INVOICE';
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
        else {
            if (settings.procurementControlMode !== 'CONTROLLED') {
                throw new Error('BEFORE_INVOICE returns are only allowed in CONTROLLED mode');
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
        const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || purchaseReturn.currency;
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
                else {
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
                }
                const lineTotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(line.returnQty * line.unitCostDoc);
                const lineTotalBase = (0, PurchasePostingHelpers_1.roundMoney)(line.returnQty * line.unitCostBase);
                line.taxAmountDoc = (0, PurchasePostingHelpers_1.roundMoney)(lineTotalDoc * (line.taxRate || 0));
                line.taxAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(lineTotalBase * (line.taxRate || 0));
                if (item.trackInventory) {
                    const qtyInBaseUom = await this.convertToBaseUom(companyId, line.returnQty, line.uom, item.baseUom, item.id, item.code);
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
                        transaction,
                    });
                    line.stockMovementId = movement.id;
                }
                if (isAfterInvoice) {
                    if (!line.accountId) {
                        throw new Error(`accountId is required for AFTER_INVOICE return line ${line.lineId}`);
                    }
                    voucherLines.push({
                        accountId: line.accountId,
                        side: 'Credit',
                        baseAmount: lineTotalBase,
                        docAmount: lineTotalDoc,
                        notes: `Return: ${line.itemName} x ${line.returnQty}`,
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
            if (isAfterInvoice) {
                const apAccountId = this.resolveAPAccount(vendor, settings.defaultAPAccountId);
                voucherLines.push({
                    accountId: apAccountId,
                    side: 'Debit',
                    baseAmount: purchaseReturn.grandTotalBase,
                    docAmount: purchaseReturn.grandTotalDoc,
                    notes: `AP reversal - ${purchaseReturn.vendorName} - Return ${purchaseReturn.returnNumber}`,
                    metadata: {
                        sourceModule: 'purchases',
                        sourceType: 'PURCHASE_RETURN',
                        sourceId: purchaseReturn.id,
                        vendorId: purchaseReturn.vendorId,
                    },
                });
                const voucher = await this.createAccountingVoucherInTransaction(transaction, purchaseReturn, baseCurrency, voucherLines);
                purchaseReturn.voucherId = voucher.id;
                const invoice = purchaseInvoice;
                invoice.outstandingAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(invoice.outstandingAmountBase - purchaseReturn.grandTotalBase);
                invoice.paymentStatus = recalcPaymentStatus(invoice);
                invoice.updatedAt = new Date();
                await this.purchaseInvoiceRepo.update(invoice, transaction);
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
    async convertToBaseUom(companyId, qty, uom, baseUom, itemId, itemCode) {
        if (uom.toUpperCase() === baseUom.toUpperCase()) {
            return qty;
        }
        const conversions = await this.uomConversionRepo.getConversionsForItem(companyId, itemId, { active: true });
        const normalizedFrom = uom.toUpperCase();
        const normalizedTo = baseUom.toUpperCase();
        const direct = conversions.find((conversion) => conversion.active
            && conversion.fromUom.toUpperCase() === normalizedFrom
            && conversion.toUom.toUpperCase() === normalizedTo);
        if (direct)
            return (0, PurchasePostingHelpers_1.roundMoney)(qty * direct.factor);
        const reverse = conversions.find((conversion) => conversion.active
            && conversion.fromUom.toUpperCase() === normalizedTo
            && conversion.toUom.toUpperCase() === normalizedFrom);
        if (reverse)
            return (0, PurchasePostingHelpers_1.roundMoney)(qty / reverse.factor);
        throw new Error(`No UOM conversion from ${uom} to ${baseUom} for item ${itemCode}`);
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
            if (source === null || source === void 0 ? void 0 : source.stockMovementId)
                return source.stockMovementId;
        }
        if (line.piLineId && purchaseInvoice) {
            const source = findPILine(purchaseInvoice, line.piLineId, line.itemId);
            if (source === null || source === void 0 ? void 0 : source.stockMovementId)
                return source.stockMovementId || undefined;
            if (source === null || source === void 0 ? void 0 : source.grnLineId) {
                return grnMovementByLineId.get(source.grnLineId);
            }
        }
        if (line.grnLineId) {
            return grnMovementByLineId.get(line.grnLineId);
        }
        return undefined;
    }
    async createAccountingVoucherInTransaction(transaction, purchaseReturn, baseCurrency, lines) {
        const isForeignCurrency = purchaseReturn.currency.toUpperCase() !== baseCurrency.toUpperCase();
        const voucherLines = lines.map((line, index) => {
            const baseAmount = (0, PurchasePostingHelpers_1.roundMoney)(line.baseAmount);
            const amount = isForeignCurrency ? (0, PurchasePostingHelpers_1.roundMoney)(line.docAmount) : baseAmount;
            const rate = isForeignCurrency ? purchaseReturn.exchangeRate : 1;
            return new VoucherLineEntity_1.VoucherLineEntity(index + 1, line.accountId, line.side, baseAmount, baseCurrency, amount, purchaseReturn.currency, rate, line.notes, undefined, line.metadata || {});
        });
        const totalDebit = (0, PurchasePostingHelpers_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
        const totalCredit = (0, PurchasePostingHelpers_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));
        const now = new Date();
        const voucher = new VoucherEntity_1.VoucherEntity((0, crypto_1.randomUUID)(), purchaseReturn.companyId, `PR-${purchaseReturn.returnNumber}`, VoucherTypes_1.VoucherType.JOURNAL_ENTRY, purchaseReturn.returnDate, `Purchase Return ${purchaseReturn.returnNumber} - ${purchaseReturn.vendorName}`, purchaseReturn.currency, baseCurrency, isForeignCurrency ? purchaseReturn.exchangeRate : 1, voucherLines, totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, {
            sourceModule: 'purchases',
            sourceType: 'PURCHASE_RETURN',
            sourceId: purchaseReturn.id,
            referenceType: 'PURCHASE_RETURN',
            referenceId: purchaseReturn.id,
        }, purchaseReturn.createdBy, now, purchaseReturn.createdBy, now);
        const postedVoucher = voucher.post(purchaseReturn.createdBy, now, VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED);
        await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
        await this.voucherRepo.save(postedVoucher, transaction);
        return postedVoucher;
    }
}
exports.PostPurchaseReturnUseCase = PostPurchaseReturnUseCase;
class GetPurchaseReturnUseCase {
    constructor(purchaseReturnRepo) {
        this.purchaseReturnRepo = purchaseReturnRepo;
    }
    async execute(companyId, id) {
        const purchaseReturn = await this.purchaseReturnRepo.getById(companyId, id);
        if (!purchaseReturn)
            throw new Error(`Purchase return not found: ${id}`);
        return purchaseReturn;
    }
}
exports.GetPurchaseReturnUseCase = GetPurchaseReturnUseCase;
class ListPurchaseReturnsUseCase {
    constructor(purchaseReturnRepo) {
        this.purchaseReturnRepo = purchaseReturnRepo;
    }
    async execute(companyId, filters = {}) {
        return this.purchaseReturnRepo.list(companyId, {
            vendorId: filters.vendorId,
            purchaseInvoiceId: filters.purchaseInvoiceId,
            goodsReceiptId: filters.goodsReceiptId,
            status: filters.status,
        });
    }
}
exports.ListPurchaseReturnsUseCase = ListPurchaseReturnsUseCase;
//# sourceMappingURL=PurchaseReturnUseCases.js.map