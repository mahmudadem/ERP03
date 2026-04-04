"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListSalesReturnsUseCase = exports.GetSalesReturnUseCase = exports.PostSalesReturnUseCase = exports.CreateSalesReturnUseCase = void 0;
const crypto_1 = require("crypto");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const SalesReturn_1 = require("../../../domain/sales/entities/SalesReturn");
const SalesOrderUseCases_1 = require("./SalesOrderUseCases");
const SalesPostingHelpers_1 = require("./SalesPostingHelpers");
const determineReturnContext = (input) => {
    if (input.salesInvoiceId)
        return 'AFTER_INVOICE';
    if (input.deliveryNoteId)
        return 'BEFORE_INVOICE';
    throw new Error('salesInvoiceId or deliveryNoteId is required to create a sales return');
};
const findSILine = (si, siLineId, itemId) => {
    if (siLineId)
        return si.lines.find((line) => line.lineId === siLineId) || null;
    if (itemId)
        return si.lines.find((line) => line.itemId === itemId) || null;
    return null;
};
const findDNLine = (dn, dnLineId, itemId) => {
    if (dnLineId)
        return dn.lines.find((line) => line.lineId === dnLineId) || null;
    if (itemId)
        return dn.lines.find((line) => line.itemId === itemId) || null;
    return null;
};
const findSOLine = (so, soLineId, itemId) => {
    if (soLineId)
        return so.lines.find((line) => line.lineId === soLineId) || null;
    if (itemId)
        return so.lines.find((line) => line.itemId === itemId) || null;
    return null;
};
const recalcPaymentStatus = (si) => {
    if (si.outstandingAmountBase <= 0)
        return 'PAID';
    if (si.paidAmountBase > 0)
        return 'PARTIALLY_PAID';
    return 'UNPAID';
};
const recalcReturnTotals = (salesReturn) => {
    salesReturn.subtotalDoc = (0, SalesPostingHelpers_1.roundMoney)(salesReturn.lines.reduce((sum, line) => sum + (0, SalesPostingHelpers_1.roundMoney)(line.returnQty * (line.unitPriceDoc || 0)), 0));
    salesReturn.subtotalBase = (0, SalesPostingHelpers_1.roundMoney)(salesReturn.lines.reduce((sum, line) => sum + (0, SalesPostingHelpers_1.roundMoney)(line.returnQty * (line.unitPriceBase || 0)), 0));
    salesReturn.taxTotalDoc = (0, SalesPostingHelpers_1.roundMoney)(salesReturn.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
    salesReturn.taxTotalBase = (0, SalesPostingHelpers_1.roundMoney)(salesReturn.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
    salesReturn.grandTotalDoc = (0, SalesPostingHelpers_1.roundMoney)(salesReturn.subtotalDoc + salesReturn.taxTotalDoc);
    salesReturn.grandTotalBase = (0, SalesPostingHelpers_1.roundMoney)(salesReturn.subtotalBase + salesReturn.taxTotalBase);
};
const addToBucket = (bucket, accountId, baseAmount, docAmount) => {
    if (!accountId || (baseAmount <= 0 && docAmount <= 0))
        return;
    const current = bucket.get(accountId);
    if (current) {
        current.baseAmount = (0, SalesPostingHelpers_1.roundMoney)(current.baseAmount + baseAmount);
        current.docAmount = (0, SalesPostingHelpers_1.roundMoney)(current.docAmount + docAmount);
        return;
    }
    bucket.set(accountId, {
        accountId,
        baseAmount: (0, SalesPostingHelpers_1.roundMoney)(baseAmount),
        docAmount: (0, SalesPostingHelpers_1.roundMoney)(docAmount),
    });
};
class CreateSalesReturnUseCase {
    constructor(settingsRepo, salesReturnRepo, salesInvoiceRepo, deliveryNoteRepo) {
        this.settingsRepo = settingsRepo;
        this.salesReturnRepo = salesReturnRepo;
        this.salesInvoiceRepo = salesInvoiceRepo;
        this.deliveryNoteRepo = deliveryNoteRepo;
    }
    async execute(input) {
        var _a, _b, _c;
        const settings = await this.settingsRepo.getSettings(input.companyId);
        if (!settings)
            throw new Error('Sales module is not initialized');
        const returnContext = determineReturnContext(input);
        if (returnContext === 'BEFORE_INVOICE' && settings.salesControlMode !== 'CONTROLLED') {
            throw new Error('BEFORE_INVOICE returns are only allowed in CONTROLLED mode');
        }
        let salesInvoice = null;
        let deliveryNote = null;
        if (returnContext === 'AFTER_INVOICE') {
            salesInvoice = await this.salesInvoiceRepo.getById(input.companyId, input.salesInvoiceId);
            if (!salesInvoice)
                throw new Error(`Sales invoice not found: ${input.salesInvoiceId}`);
            if (salesInvoice.status !== 'POSTED') {
                throw new Error('AFTER_INVOICE returns require a posted sales invoice');
            }
        }
        else {
            deliveryNote = await this.deliveryNoteRepo.getById(input.companyId, input.deliveryNoteId);
            if (!deliveryNote)
                throw new Error(`Delivery note not found: ${input.deliveryNoteId}`);
            if (deliveryNote.status !== 'POSTED') {
                throw new Error('BEFORE_INVOICE returns require a posted delivery note');
            }
        }
        const lines = salesInvoice
            ? this.prefillLinesFromSalesInvoice(salesInvoice, input.lines)
            : this.prefillLinesFromDeliveryNote(deliveryNote, input.lines);
        const warehouseId = input.warehouseId
            || (deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.warehouseId)
            || ((_a = salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.lines[0]) === null || _a === void 0 ? void 0 : _a.warehouseId)
            || settings.defaultWarehouseId;
        if (!warehouseId) {
            throw new Error('warehouseId is required to create sales return');
        }
        const now = new Date();
        const salesReturn = new SalesReturn_1.SalesReturn({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            returnNumber: (0, SalesOrderUseCases_1.generateDocumentNumber)(settings, 'SR'),
            salesInvoiceId: salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.id,
            deliveryNoteId: deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.id,
            salesOrderId: input.salesOrderId || (salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.salesOrderId) || (deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.salesOrderId),
            customerId: (salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.customerId) || deliveryNote.customerId,
            customerName: (salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.customerName) || deliveryNote.customerName,
            returnContext,
            returnDate: input.returnDate,
            warehouseId,
            currency: (salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.currency) || ((_b = deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.lines[0]) === null || _b === void 0 ? void 0 : _b.moveCurrency) || 'USD',
            exchangeRate: (salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.exchangeRate) || ((_c = deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.lines[0]) === null || _c === void 0 ? void 0 : _c.fxRateMovToBase) || 1,
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
            revenueVoucherId: null,
            cogsVoucherId: null,
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
        });
        await this.salesReturnRepo.create(salesReturn);
        await this.settingsRepo.saveSettings(settings);
        return salesReturn;
    }
    prefillLinesFromSalesInvoice(salesInvoice, inputLines) {
        if (!(inputLines === null || inputLines === void 0 ? void 0 : inputLines.length)) {
            return salesInvoice.lines.map((line, index) => this.mapSalesInvoiceLineToReturnLine(line, index + 1, undefined, salesInvoice.exchangeRate));
        }
        const mapped = inputLines.map((inputLine, index) => {
            const source = findSILine(salesInvoice, inputLine.siLineId, inputLine.itemId);
            if (!source) {
                throw new Error(`Sales invoice line not found for return line ${index + 1}`);
            }
            return this.mapSalesInvoiceLineToReturnLine(source, index + 1, inputLine, salesInvoice.exchangeRate);
        });
        if (!mapped.length) {
            throw new Error('Sales return must contain at least one line');
        }
        return mapped;
    }
    prefillLinesFromDeliveryNote(deliveryNote, inputLines) {
        if (!(inputLines === null || inputLines === void 0 ? void 0 : inputLines.length)) {
            return deliveryNote.lines.map((line, index) => this.mapDeliveryNoteLineToReturnLine(line, index + 1, undefined));
        }
        const mapped = inputLines.map((inputLine, index) => {
            const source = findDNLine(deliveryNote, inputLine.dnLineId, inputLine.itemId);
            if (!source) {
                throw new Error(`Delivery note line not found for return line ${index + 1}`);
            }
            return this.mapDeliveryNoteLineToReturnLine(source, index + 1, inputLine);
        });
        if (!mapped.length) {
            throw new Error('Sales return must contain at least one line');
        }
        return mapped;
    }
    mapSalesInvoiceLineToReturnLine(salesInvoiceLine, lineNo, inputLine, exchangeRate = 1) {
        var _a, _b;
        const returnQty = (_a = inputLine === null || inputLine === void 0 ? void 0 : inputLine.returnQty) !== null && _a !== void 0 ? _a : salesInvoiceLine.invoicedQty;
        const taxRate = salesInvoiceLine.taxRate || 0;
        const unitPriceDoc = salesInvoiceLine.unitPriceDoc;
        const unitPriceBase = salesInvoiceLine.unitPriceBase || (0, SalesPostingHelpers_1.roundMoney)(unitPriceDoc * (exchangeRate || 1));
        return {
            lineId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.lineId) || (0, crypto_1.randomUUID)(),
            lineNo: (_b = inputLine === null || inputLine === void 0 ? void 0 : inputLine.lineNo) !== null && _b !== void 0 ? _b : lineNo,
            siLineId: salesInvoiceLine.lineId,
            dnLineId: salesInvoiceLine.dnLineId,
            soLineId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.soLineId) || salesInvoiceLine.soLineId,
            itemId: salesInvoiceLine.itemId,
            itemCode: salesInvoiceLine.itemCode,
            itemName: salesInvoiceLine.itemName,
            returnQty,
            uom: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.uom) || salesInvoiceLine.uom,
            unitPriceDoc,
            unitPriceBase,
            unitCostBase: salesInvoiceLine.unitCostBase || 0,
            fxRateMovToBase: exchangeRate,
            fxRateCCYToBase: exchangeRate,
            taxCodeId: salesInvoiceLine.taxCodeId,
            taxRate,
            taxAmountDoc: (0, SalesPostingHelpers_1.roundMoney)(returnQty * unitPriceDoc * taxRate),
            taxAmountBase: (0, SalesPostingHelpers_1.roundMoney)(returnQty * unitPriceBase * taxRate),
            revenueAccountId: salesInvoiceLine.revenueAccountId,
            cogsAccountId: salesInvoiceLine.cogsAccountId,
            inventoryAccountId: salesInvoiceLine.inventoryAccountId,
            stockMovementId: null,
            description: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.description) || salesInvoiceLine.description,
        };
    }
    mapDeliveryNoteLineToReturnLine(deliveryNoteLine, lineNo, inputLine) {
        var _a, _b;
        const returnQty = (_a = inputLine === null || inputLine === void 0 ? void 0 : inputLine.returnQty) !== null && _a !== void 0 ? _a : deliveryNoteLine.deliveredQty;
        return {
            lineId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.lineId) || (0, crypto_1.randomUUID)(),
            lineNo: (_b = inputLine === null || inputLine === void 0 ? void 0 : inputLine.lineNo) !== null && _b !== void 0 ? _b : lineNo,
            dnLineId: deliveryNoteLine.lineId,
            soLineId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.soLineId) || deliveryNoteLine.soLineId,
            itemId: deliveryNoteLine.itemId,
            itemCode: deliveryNoteLine.itemCode,
            itemName: deliveryNoteLine.itemName,
            returnQty,
            uom: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.uom) || deliveryNoteLine.uom,
            unitCostBase: deliveryNoteLine.unitCostBase || 0,
            fxRateMovToBase: deliveryNoteLine.fxRateMovToBase || 1,
            fxRateCCYToBase: deliveryNoteLine.fxRateCCYToBase || 1,
            taxRate: 0,
            taxAmountDoc: 0,
            taxAmountBase: 0,
            stockMovementId: null,
            description: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.description) || deliveryNoteLine.description,
        };
    }
}
exports.CreateSalesReturnUseCase = CreateSalesReturnUseCase;
class PostSalesReturnUseCase {
    constructor(settingsRepo, salesReturnRepo, salesInvoiceRepo, deliveryNoteRepo, salesOrderRepo, partyRepo, taxCodeRepo, itemRepo, itemCategoryRepo, uomConversionRepo, companyCurrencyRepo, inventoryService, voucherRepo, ledgerRepo, transactionManager) {
        this.settingsRepo = settingsRepo;
        this.salesReturnRepo = salesReturnRepo;
        this.salesInvoiceRepo = salesInvoiceRepo;
        this.deliveryNoteRepo = deliveryNoteRepo;
        this.salesOrderRepo = salesOrderRepo;
        this.partyRepo = partyRepo;
        this.taxCodeRepo = taxCodeRepo;
        this.itemRepo = itemRepo;
        this.itemCategoryRepo = itemCategoryRepo;
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
            throw new Error('Sales module is not initialized');
        const salesReturn = await this.salesReturnRepo.getById(companyId, id);
        if (!salesReturn)
            throw new Error(`Sales return not found: ${id}`);
        if (salesReturn.status !== 'DRAFT') {
            throw new Error('Only DRAFT sales returns can be posted');
        }
        const isAfterInvoice = salesReturn.returnContext === 'AFTER_INVOICE';
        if (!isAfterInvoice && settings.salesControlMode !== 'CONTROLLED') {
            throw new Error('BEFORE_INVOICE returns are only allowed in CONTROLLED mode');
        }
        let salesInvoice = null;
        let deliveryNote = null;
        if (isAfterInvoice) {
            if (!salesReturn.salesInvoiceId) {
                throw new Error('salesInvoiceId is required for AFTER_INVOICE return');
            }
            salesInvoice = await this.salesInvoiceRepo.getById(companyId, salesReturn.salesInvoiceId);
            if (!salesInvoice)
                throw new Error(`Sales invoice not found: ${salesReturn.salesInvoiceId}`);
            if (salesInvoice.status !== 'POSTED') {
                throw new Error('AFTER_INVOICE returns require a posted sales invoice');
            }
        }
        else {
            if (!salesReturn.deliveryNoteId) {
                throw new Error('deliveryNoteId is required for BEFORE_INVOICE return');
            }
            deliveryNote = await this.deliveryNoteRepo.getById(companyId, salesReturn.deliveryNoteId);
            if (!deliveryNote)
                throw new Error(`Delivery note not found: ${salesReturn.deliveryNoteId}`);
            if (deliveryNote.status !== 'POSTED') {
                throw new Error('BEFORE_INVOICE returns require a posted delivery note');
            }
        }
        const effectiveSOId = salesReturn.salesOrderId || (salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.salesOrderId) || (deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.salesOrderId);
        const salesOrder = effectiveSOId
            ? await this.salesOrderRepo.getById(companyId, effectiveSOId)
            : null;
        if (effectiveSOId && !salesOrder) {
            throw new Error(`Sales order not found: ${effectiveSOId}`);
        }
        const customer = await this.partyRepo.getById(companyId, salesReturn.customerId);
        if (!customer)
            throw new Error(`Customer not found: ${salesReturn.customerId}`);
        const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || salesReturn.currency;
        const revenueDebitBucket = new Map();
        const taxDebitBucket = new Map();
        const cogsBucket = new Map();
        const currentRunQtyBySource = new Map();
        await this.transactionManager.runTransaction(async (transaction) => {
            var _a, _b;
            for (const line of salesReturn.lines) {
                const item = await this.itemRepo.getItem(line.itemId);
                if (!item || item.companyId !== companyId) {
                    throw new Error(`Item not found: ${line.itemId}`);
                }
                if (isAfterInvoice) {
                    const sourceLine = findSILine(salesInvoice, line.siLineId, line.itemId);
                    if (!sourceLine) {
                        throw new Error(`Sales invoice line not found for return line ${line.lineId}`);
                    }
                    line.siLineId = sourceLine.lineId;
                    line.dnLineId = line.dnLineId || sourceLine.dnLineId;
                    line.soLineId = line.soLineId || sourceLine.soLineId;
                    line.itemCode = line.itemCode || sourceLine.itemCode;
                    line.itemName = line.itemName || sourceLine.itemName;
                    line.uom = line.uom || sourceLine.uom;
                    line.unitPriceDoc = (_a = line.unitPriceDoc) !== null && _a !== void 0 ? _a : sourceLine.unitPriceDoc;
                    line.unitPriceBase = (_b = line.unitPriceBase) !== null && _b !== void 0 ? _b : sourceLine.unitPriceBase;
                    line.unitCostBase = line.unitCostBase || sourceLine.unitCostBase || 0;
                    line.taxCodeId = line.taxCodeId || sourceLine.taxCodeId;
                    line.taxRate = Number.isNaN(line.taxRate) ? sourceLine.taxRate : line.taxRate;
                    line.revenueAccountId = line.revenueAccountId || sourceLine.revenueAccountId;
                    line.cogsAccountId = line.cogsAccountId || sourceLine.cogsAccountId;
                    line.inventoryAccountId = line.inventoryAccountId || sourceLine.inventoryAccountId;
                    const sourceKey = `SI:${sourceLine.lineId}`;
                    const previousReturned = await this.getPreviouslyReturnedQtyForSILine(companyId, salesInvoice.id, sourceLine.lineId, salesReturn.id);
                    const currentRunQty = currentRunQtyBySource.get(sourceKey) || 0;
                    const remainingQty = (0, SalesPostingHelpers_1.roundMoney)(sourceLine.invoicedQty - previousReturned - currentRunQty);
                    if (line.returnQty > remainingQty + 0.000001) {
                        throw new Error(`Return qty exceeds invoiced qty for ${line.itemName || sourceLine.itemName}`);
                    }
                    currentRunQtyBySource.set(sourceKey, (0, SalesPostingHelpers_1.roundMoney)(currentRunQty + line.returnQty));
                }
                else {
                    const sourceLine = findDNLine(deliveryNote, line.dnLineId, line.itemId);
                    if (!sourceLine) {
                        throw new Error(`Delivery note line not found for return line ${line.lineId}`);
                    }
                    line.dnLineId = sourceLine.lineId;
                    line.soLineId = line.soLineId || sourceLine.soLineId;
                    line.itemCode = line.itemCode || sourceLine.itemCode;
                    line.itemName = line.itemName || sourceLine.itemName;
                    line.uom = line.uom || sourceLine.uom;
                    line.unitCostBase = line.unitCostBase || sourceLine.unitCostBase || 0;
                    line.fxRateMovToBase = line.fxRateMovToBase || sourceLine.fxRateMovToBase || 1;
                    line.fxRateCCYToBase = line.fxRateCCYToBase || sourceLine.fxRateCCYToBase || 1;
                    line.taxRate = 0;
                    line.taxAmountDoc = 0;
                    line.taxAmountBase = 0;
                    const sourceKey = `DN:${sourceLine.lineId}`;
                    const previousReturned = await this.getPreviouslyReturnedQtyForDNLine(companyId, deliveryNote.id, sourceLine.lineId, salesReturn.id);
                    const currentRunQty = currentRunQtyBySource.get(sourceKey) || 0;
                    const remainingQty = (0, SalesPostingHelpers_1.roundMoney)(sourceLine.deliveredQty - previousReturned - currentRunQty);
                    if (line.returnQty > remainingQty + 0.000001) {
                        throw new Error(`Return qty exceeds delivered qty for ${line.itemName || sourceLine.itemName}`);
                    }
                    currentRunQtyBySource.set(sourceKey, (0, SalesPostingHelpers_1.roundMoney)(currentRunQty + line.returnQty));
                }
                const lineTotalDoc = (0, SalesPostingHelpers_1.roundMoney)(line.returnQty * (line.unitPriceDoc || 0));
                const lineTotalBase = (0, SalesPostingHelpers_1.roundMoney)(line.returnQty * (line.unitPriceBase || 0));
                line.taxAmountDoc = (0, SalesPostingHelpers_1.roundMoney)(lineTotalDoc * line.taxRate);
                line.taxAmountBase = (0, SalesPostingHelpers_1.roundMoney)(lineTotalBase * line.taxRate);
                if (isAfterInvoice) {
                    if (!line.revenueAccountId) {
                        line.revenueAccountId = await this.resolveRevenueAccount(companyId, item, settings.defaultRevenueAccountId);
                    }
                    addToBucket(revenueDebitBucket, line.revenueAccountId, lineTotalBase, lineTotalDoc);
                    if (line.taxAmountBase > 0) {
                        const taxAccountId = await this.resolveSalesTaxAccount(companyId, line.taxCodeId);
                        addToBucket(taxDebitBucket, taxAccountId, line.taxAmountBase, line.taxAmountDoc);
                    }
                }
                if (item.trackInventory) {
                    const qtyInBaseUom = await this.convertToBaseUom(companyId, line.returnQty, line.uom, item.baseUom, item.id, item.code);
                    const unitCostBase = (0, SalesPostingHelpers_1.roundMoney)(line.unitCostBase || 0);
                    line.unitCostBase = unitCostBase;
                    const lineCostBase = (0, SalesPostingHelpers_1.roundMoney)(qtyInBaseUom * unitCostBase);
                    const fxRateMovToBase = line.fxRateMovToBase > 0 ? line.fxRateMovToBase : (salesReturn.exchangeRate || 1);
                    const fxRateCCYToBase = line.fxRateCCYToBase > 0 ? line.fxRateCCYToBase : (salesReturn.exchangeRate || 1);
                    const unitCostInMoveCurrency = (0, SalesPostingHelpers_1.roundMoney)(unitCostBase / fxRateMovToBase);
                    const movement = await this.inventoryService.processIN({
                        companyId,
                        itemId: line.itemId,
                        warehouseId: salesReturn.warehouseId,
                        qty: qtyInBaseUom,
                        date: salesReturn.returnDate,
                        movementType: 'RETURN_IN',
                        refs: {
                            type: 'SALES_RETURN',
                            docId: salesReturn.id,
                            lineId: line.lineId,
                        },
                        currentUser: salesReturn.createdBy,
                        unitCostInMoveCurrency,
                        moveCurrency: salesReturn.currency,
                        fxRateMovToBase,
                        fxRateCCYToBase,
                        transaction,
                    });
                    line.stockMovementId = movement.id;
                    const accounts = await this.resolveCOGSAccounts(companyId, item, settings.defaultCOGSAccountId, false);
                    if (accounts && lineCostBase > 0) {
                        line.cogsAccountId = line.cogsAccountId || accounts.cogsAccountId;
                        line.inventoryAccountId = line.inventoryAccountId || accounts.inventoryAccountId;
                        const key = `${accounts.inventoryAccountId}|${accounts.cogsAccountId}`;
                        const existing = cogsBucket.get(key);
                        if (existing) {
                            existing.amountBase = (0, SalesPostingHelpers_1.roundMoney)(existing.amountBase + lineCostBase);
                        }
                        else {
                            cogsBucket.set(key, {
                                inventoryAccountId: accounts.inventoryAccountId,
                                cogsAccountId: accounts.cogsAccountId,
                                amountBase: lineCostBase,
                            });
                        }
                    }
                }
                if (salesOrder) {
                    const soLine = findSOLine(salesOrder, line.soLineId, line.itemId);
                    if (soLine) {
                        soLine.returnedQty = (0, SalesPostingHelpers_1.roundMoney)(soLine.returnedQty + line.returnQty);
                        if (isAfterInvoice) {
                            soLine.invoicedQty = Math.max(0, (0, SalesPostingHelpers_1.roundMoney)(soLine.invoicedQty - line.returnQty));
                        }
                        else {
                            soLine.deliveredQty = Math.max(0, (0, SalesPostingHelpers_1.roundMoney)(soLine.deliveredQty - line.returnQty));
                        }
                    }
                }
            }
            recalcReturnTotals(salesReturn);
            if (cogsBucket.size > 0) {
                const cogsVoucher = await this.createCOGSReversalVoucherInTransaction(transaction, salesReturn, baseCurrency, Array.from(cogsBucket.values()));
                salesReturn.cogsVoucherId = cogsVoucher.id;
            }
            else {
                salesReturn.cogsVoucherId = null;
            }
            if (isAfterInvoice) {
                const arAccountId = this.resolveARAccount(customer, settings.defaultARAccountId);
                const revenueVoucher = await this.createRevenueReversalVoucherInTransaction(transaction, salesReturn, baseCurrency, arAccountId, Array.from(revenueDebitBucket.values()), Array.from(taxDebitBucket.values()));
                salesReturn.revenueVoucherId = revenueVoucher.id;
                const invoice = salesInvoice;
                invoice.outstandingAmountBase = (0, SalesPostingHelpers_1.roundMoney)(invoice.outstandingAmountBase - salesReturn.grandTotalBase);
                invoice.paymentStatus = recalcPaymentStatus(invoice);
                invoice.updatedAt = new Date();
                await this.salesInvoiceRepo.update(invoice, transaction);
            }
            else {
                salesReturn.revenueVoucherId = null;
            }
            if (salesOrder) {
                salesOrder.status = (0, SalesPostingHelpers_1.updateSOStatus)(salesOrder);
                salesOrder.updatedAt = new Date();
                await this.salesOrderRepo.update(salesOrder, transaction);
            }
            salesReturn.status = 'POSTED';
            salesReturn.postedAt = new Date();
            salesReturn.updatedAt = new Date();
            await this.salesReturnRepo.update(salesReturn, transaction);
        });
        const posted = await this.salesReturnRepo.getById(companyId, id);
        if (!posted)
            throw new Error(`Sales return not found after posting: ${id}`);
        return posted;
    }
    resolveARAccount(customer, defaultARAccountId) {
        return customer.defaultARAccountId || defaultARAccountId;
    }
    async resolveRevenueAccount(companyId, item, defaultRevenueAccountId) {
        if (item.revenueAccountId)
            return item.revenueAccountId;
        if (item.categoryId) {
            const category = await this.itemCategoryRepo.getCategory(item.categoryId);
            if (category && category.companyId === companyId && category.defaultRevenueAccountId) {
                return category.defaultRevenueAccountId;
            }
        }
        if (!defaultRevenueAccountId) {
            throw new Error(`No revenue account configured for item ${item.code}`);
        }
        return defaultRevenueAccountId;
    }
    async resolveCOGSAccounts(companyId, item, defaultCOGSAccountId, strict) {
        let category = null;
        if (item.categoryId) {
            category = await this.itemCategoryRepo.getCategory(item.categoryId);
            if ((category === null || category === void 0 ? void 0 : category.companyId) !== companyId) {
                category = null;
            }
        }
        const cogsAccountId = item.cogsAccountId || (category === null || category === void 0 ? void 0 : category.defaultCogsAccountId) || defaultCOGSAccountId;
        const inventoryAccountId = item.inventoryAssetAccountId || (category === null || category === void 0 ? void 0 : category.defaultInventoryAssetAccountId);
        if (!cogsAccountId || !inventoryAccountId) {
            if (strict) {
                if (!cogsAccountId)
                    throw new Error(`No COGS account configured for item ${item.code}`);
                throw new Error(`No inventory account configured for item ${item.code}`);
            }
            return null;
        }
        return { cogsAccountId, inventoryAccountId };
    }
    async resolveSalesTaxAccount(companyId, taxCodeId) {
        if (!taxCodeId) {
            throw new Error('taxCodeId is required for sales tax reversal');
        }
        const taxCode = await this.taxCodeRepo.getById(companyId, taxCodeId);
        if (!taxCode)
            throw new Error(`Tax code not found: ${taxCodeId}`);
        if (!taxCode.salesTaxAccountId) {
            throw new Error(`Tax code ${taxCode.code} has no sales tax account`);
        }
        return taxCode.salesTaxAccountId;
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
            return (0, SalesPostingHelpers_1.roundMoney)(qty * direct.factor);
        const reverse = conversions.find((conversion) => conversion.active
            && conversion.fromUom.toUpperCase() === normalizedTo
            && conversion.toUom.toUpperCase() === normalizedFrom);
        if (reverse)
            return (0, SalesPostingHelpers_1.roundMoney)(qty / reverse.factor);
        throw new Error(`No UOM conversion from ${uom} to ${baseUom} for item ${itemCode}`);
    }
    async getPreviouslyReturnedQtyForSILine(companyId, salesInvoiceId, siLineId, excludeReturnId) {
        const returns = await this.salesReturnRepo.list(companyId, {
            salesInvoiceId,
            status: 'POSTED',
        });
        return (0, SalesPostingHelpers_1.roundMoney)(returns.reduce((sum, entry) => {
            if (entry.id === excludeReturnId)
                return sum;
            const qty = entry.lines
                .filter((line) => line.siLineId === siLineId)
                .reduce((lineSum, line) => lineSum + line.returnQty, 0);
            return sum + qty;
        }, 0));
    }
    async getPreviouslyReturnedQtyForDNLine(companyId, deliveryNoteId, dnLineId, excludeReturnId) {
        const returns = await this.salesReturnRepo.list(companyId, {
            deliveryNoteId,
            status: 'POSTED',
        });
        return (0, SalesPostingHelpers_1.roundMoney)(returns.reduce((sum, entry) => {
            if (entry.id === excludeReturnId)
                return sum;
            const qty = entry.lines
                .filter((line) => line.dnLineId === dnLineId)
                .reduce((lineSum, line) => lineSum + line.returnQty, 0);
            return sum + qty;
        }, 0));
    }
    async createCOGSReversalVoucherInTransaction(transaction, salesReturn, baseCurrency, lines) {
        const voucherLines = [];
        let seq = 1;
        for (const line of lines) {
            const amount = (0, SalesPostingHelpers_1.roundMoney)(line.amountBase);
            voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(seq++, line.inventoryAccountId, 'Debit', amount, baseCurrency, amount, baseCurrency, 1, `Inventory return - ${salesReturn.returnNumber}`, undefined, { sourceModule: 'sales', sourceType: 'SALES_RETURN', sourceId: salesReturn.id }));
            voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(seq++, line.cogsAccountId, 'Credit', amount, baseCurrency, amount, baseCurrency, 1, `COGS reversal - ${salesReturn.returnNumber}`, undefined, { sourceModule: 'sales', sourceType: 'SALES_RETURN', sourceId: salesReturn.id }));
        }
        const totalDebit = (0, SalesPostingHelpers_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
        const totalCredit = (0, SalesPostingHelpers_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));
        const now = new Date();
        const voucher = new VoucherEntity_1.VoucherEntity((0, crypto_1.randomUUID)(), salesReturn.companyId, `SR-COGS-${salesReturn.returnNumber}`, VoucherTypes_1.VoucherType.JOURNAL_ENTRY, salesReturn.returnDate, `Sales Return ${salesReturn.returnNumber} COGS Reversal`, baseCurrency, baseCurrency, 1, voucherLines, totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, {
            sourceModule: 'sales',
            sourceType: 'SALES_RETURN',
            sourceId: salesReturn.id,
            referenceType: 'SALES_RETURN',
            referenceId: salesReturn.id,
        }, salesReturn.createdBy, now, salesReturn.createdBy, now);
        const postedVoucher = voucher.post(salesReturn.createdBy, now, VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED);
        await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
        await this.voucherRepo.save(postedVoucher, transaction);
        return postedVoucher;
    }
    async createRevenueReversalVoucherInTransaction(transaction, salesReturn, baseCurrency, arAccountId, revenueDebits, taxDebits) {
        const voucherLines = [];
        const isForeignCurrency = salesReturn.currency.toUpperCase() !== baseCurrency.toUpperCase();
        let seq = 1;
        for (const line of revenueDebits) {
            voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(seq++, line.accountId, 'Debit', (0, SalesPostingHelpers_1.roundMoney)(line.baseAmount), baseCurrency, isForeignCurrency ? (0, SalesPostingHelpers_1.roundMoney)(line.docAmount) : (0, SalesPostingHelpers_1.roundMoney)(line.baseAmount), salesReturn.currency, isForeignCurrency ? salesReturn.exchangeRate : 1, `Revenue reversal - ${salesReturn.returnNumber}`, undefined, { sourceModule: 'sales', sourceType: 'SALES_RETURN', sourceId: salesReturn.id }));
        }
        for (const line of taxDebits) {
            voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(seq++, line.accountId, 'Debit', (0, SalesPostingHelpers_1.roundMoney)(line.baseAmount), baseCurrency, isForeignCurrency ? (0, SalesPostingHelpers_1.roundMoney)(line.docAmount) : (0, SalesPostingHelpers_1.roundMoney)(line.baseAmount), salesReturn.currency, isForeignCurrency ? salesReturn.exchangeRate : 1, `Sales tax reversal - ${salesReturn.returnNumber}`, undefined, { sourceModule: 'sales', sourceType: 'SALES_RETURN', sourceId: salesReturn.id }));
        }
        voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(seq++, arAccountId, 'Credit', (0, SalesPostingHelpers_1.roundMoney)(salesReturn.grandTotalBase), baseCurrency, isForeignCurrency ? (0, SalesPostingHelpers_1.roundMoney)(salesReturn.grandTotalDoc) : (0, SalesPostingHelpers_1.roundMoney)(salesReturn.grandTotalBase), salesReturn.currency, isForeignCurrency ? salesReturn.exchangeRate : 1, `AR reversal - ${salesReturn.customerName} - ${salesReturn.returnNumber}`, undefined, { sourceModule: 'sales', sourceType: 'SALES_RETURN', sourceId: salesReturn.id, customerId: salesReturn.customerId }));
        const totalDebit = (0, SalesPostingHelpers_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
        const totalCredit = (0, SalesPostingHelpers_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));
        const now = new Date();
        const voucher = new VoucherEntity_1.VoucherEntity((0, crypto_1.randomUUID)(), salesReturn.companyId, `SR-REV-${salesReturn.returnNumber}`, VoucherTypes_1.VoucherType.JOURNAL_ENTRY, salesReturn.returnDate, `Sales Return ${salesReturn.returnNumber} Revenue Reversal`, salesReturn.currency, baseCurrency, isForeignCurrency ? salesReturn.exchangeRate : 1, voucherLines, totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, {
            sourceModule: 'sales',
            sourceType: 'SALES_RETURN',
            sourceId: salesReturn.id,
            referenceType: 'SALES_RETURN',
            referenceId: salesReturn.id,
        }, salesReturn.createdBy, now, salesReturn.createdBy, now);
        const postedVoucher = voucher.post(salesReturn.createdBy, now, VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED);
        await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
        await this.voucherRepo.save(postedVoucher, transaction);
        return postedVoucher;
    }
}
exports.PostSalesReturnUseCase = PostSalesReturnUseCase;
class GetSalesReturnUseCase {
    constructor(salesReturnRepo) {
        this.salesReturnRepo = salesReturnRepo;
    }
    async execute(companyId, id) {
        const salesReturn = await this.salesReturnRepo.getById(companyId, id);
        if (!salesReturn)
            throw new Error(`Sales return not found: ${id}`);
        return salesReturn;
    }
}
exports.GetSalesReturnUseCase = GetSalesReturnUseCase;
class ListSalesReturnsUseCase {
    constructor(salesReturnRepo) {
        this.salesReturnRepo = salesReturnRepo;
    }
    async execute(companyId, filters = {}) {
        return this.salesReturnRepo.list(companyId, {
            customerId: filters.customerId,
            salesInvoiceId: filters.salesInvoiceId,
            deliveryNoteId: filters.deliveryNoteId,
            status: filters.status,
        });
    }
}
exports.ListSalesReturnsUseCase = ListSalesReturnsUseCase;
//# sourceMappingURL=SalesReturnUseCases.js.map