"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListSalesReturnsUseCase = exports.GetSalesReturnUseCase = exports.PostSalesReturnUseCase = exports.CreateSalesReturnUseCase = void 0;
const crypto_1 = require("crypto");
const DocumentPolicyResolver_1 = require("../../common/services/DocumentPolicyResolver");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const SalesReturn_1 = require("../../../domain/sales/entities/SalesReturn");
const StockLevel_1 = require("../../../domain/inventory/entities/StockLevel");
const StockMovement_1 = require("../../../domain/inventory/entities/StockMovement");
const UomResolutionService_1 = require("../../inventory/services/UomResolutionService");
const SalesOrderUseCases_1 = require("./SalesOrderUseCases");
const SalesPostingHelpers_1 = require("./SalesPostingHelpers");
const determineReturnContext = (input) => {
    if (input.salesInvoiceId)
        return 'AFTER_INVOICE';
    if (input.deliveryNoteId)
        return 'BEFORE_INVOICE';
    return 'DIRECT';
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
        var _a, _b, _c, _d;
        const settings = await this.settingsRepo.getSettings(input.companyId);
        if (!settings)
            throw new Error('Sales module is not initialized');
        const returnContext = determineReturnContext(input);
        if (returnContext === 'BEFORE_INVOICE' && !settings.requireSOForStockItems) {
            throw new Error('BEFORE_INVOICE returns require "Require Sales Orders for Stock Items" to be enabled.');
        }
        let salesInvoice = null;
        let deliveryNote = null;
        let lines;
        if (returnContext === 'AFTER_INVOICE') {
            salesInvoice = await this.salesInvoiceRepo.getById(input.companyId, input.salesInvoiceId);
            if (!salesInvoice)
                throw new Error(`Sales invoice not found: ${input.salesInvoiceId}`);
            if (salesInvoice.status !== 'POSTED') {
                throw new Error('AFTER_INVOICE returns require a posted sales invoice');
            }
            lines = this.prefillLinesFromSalesInvoice(salesInvoice, input.lines);
        }
        else if (returnContext === 'BEFORE_INVOICE') {
            deliveryNote = await this.deliveryNoteRepo.getById(input.companyId, input.deliveryNoteId);
            if (!deliveryNote)
                throw new Error(`Delivery note not found: ${input.deliveryNoteId}`);
            if (deliveryNote.status !== 'POSTED') {
                throw new Error('BEFORE_INVOICE returns require a posted delivery note');
            }
            lines = this.prefillLinesFromDeliveryNote(deliveryNote, input.lines);
        }
        else {
            // DIRECT: standalone return
            if (!((_a = input.lines) === null || _a === void 0 ? void 0 : _a.length)) {
                throw new Error('Standalone returns require at least one line with item details');
            }
            if (!input.warehouseId && !settings.defaultWarehouseId) {
                throw new Error('warehouseId is required for standalone returns');
            }
            lines = input.lines.map((inputLine, index) => {
                var _a, _b, _c;
                return ({
                    lineId: inputLine.lineId || (0, crypto_1.randomUUID)(),
                    lineNo: (_a = inputLine.lineNo) !== null && _a !== void 0 ? _a : index + 1,
                    itemId: inputLine.itemId || '',
                    itemCode: '',
                    itemName: '',
                    returnQty: inputLine.returnQty || 0,
                    uomId: inputLine.uomId,
                    uom: inputLine.uom || 'EA',
                    unitPriceDoc: (_b = inputLine.unitPriceDoc) !== null && _b !== void 0 ? _b : 0,
                    unitPriceBase: (_c = inputLine.unitPriceDoc) !== null && _c !== void 0 ? _c : 0,
                    unitCostBase: 0,
                    fxRateMovToBase: 1,
                    fxRateCCYToBase: 1,
                    taxCodeId: inputLine.taxCodeId,
                    taxRate: 0,
                    taxAmountDoc: 0,
                    taxAmountBase: 0,
                    stockMovementId: null,
                    description: inputLine.description,
                });
            });
        }
        const warehouseId = input.warehouseId ||
            (deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.warehouseId) ||
            ((_b = salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.lines[0]) === null || _b === void 0 ? void 0 : _b.warehouseId) ||
            settings.defaultWarehouseId;
        if (!warehouseId) {
            throw new Error('warehouseId is required to create sales return');
        }
        const now = new Date();
        const returnNumber = await (0, SalesOrderUseCases_1.generateUniqueDocumentNumber)(settings, 'SR', async (candidate) => !!(await this.salesReturnRepo.getByNumber(input.companyId, candidate)));
        const salesReturn = new SalesReturn_1.SalesReturn({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            returnNumber,
            salesInvoiceId: salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.id,
            deliveryNoteId: deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.id,
            salesOrderId: input.salesOrderId || (salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.salesOrderId) || (deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.salesOrderId),
            customerId: input.customerId || (salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.customerId) || (deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.customerId),
            customerName: input.customerName || (salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.customerName) || (deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.customerName),
            returnContext,
            returnDate: input.returnDate,
            warehouseId,
            currency: (salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.currency) || ((_c = deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.lines[0]) === null || _c === void 0 ? void 0 : _c.moveCurrency) || 'USD',
            exchangeRate: (salesInvoice === null || salesInvoice === void 0 ? void 0 : salesInvoice.exchangeRate) || ((_d = deliveryNote === null || deliveryNote === void 0 ? void 0 : deliveryNote.lines[0]) === null || _d === void 0 ? void 0 : _d.fxRateMovToBase) || 1,
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
        var _a, _b, _c;
        const returnQty = (_a = inputLine === null || inputLine === void 0 ? void 0 : inputLine.returnQty) !== null && _a !== void 0 ? _a : salesInvoiceLine.invoicedQty;
        const taxRate = salesInvoiceLine.taxRate || 0;
        const unitPriceDoc = (_b = inputLine === null || inputLine === void 0 ? void 0 : inputLine.unitPriceDoc) !== null && _b !== void 0 ? _b : salesInvoiceLine.unitPriceDoc;
        const unitPriceBase = salesInvoiceLine.unitPriceBase || (0, SalesPostingHelpers_1.roundMoney)(unitPriceDoc * (exchangeRate || 1));
        return {
            lineId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.lineId) || (0, crypto_1.randomUUID)(),
            lineNo: (_c = inputLine === null || inputLine === void 0 ? void 0 : inputLine.lineNo) !== null && _c !== void 0 ? _c : lineNo,
            siLineId: salesInvoiceLine.lineId,
            dnLineId: salesInvoiceLine.dnLineId,
            soLineId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.soLineId) || salesInvoiceLine.soLineId,
            itemId: salesInvoiceLine.itemId,
            itemCode: salesInvoiceLine.itemCode,
            itemName: salesInvoiceLine.itemName,
            returnQty,
            uomId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.uomId) || salesInvoiceLine.uomId,
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
            uomId: (inputLine === null || inputLine === void 0 ? void 0 : inputLine.uomId) || deliveryNoteLine.uomId,
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
    constructor(settingsRepo, inventorySettingsRepo, salesReturnRepo, salesInvoiceRepo, deliveryNoteRepo, salesOrderRepo, partyRepo, taxCodeRepo, itemRepo, itemCategoryRepo, uomConversionRepo, companyCurrencyRepo, inventoryService, companyModuleRepo, accountingPostingService, accountRepo, transactionManager) {
        this.settingsRepo = settingsRepo;
        this.inventorySettingsRepo = inventorySettingsRepo;
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
        this.companyModuleRepo = companyModuleRepo;
        this.accountingPostingService = accountingPostingService;
        this.accountRepo = accountRepo;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id, createAccountingEffect = true) {
        var _a, _b, _c, _d;
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings)
            throw new Error('Sales module is not initialized');
        const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
        const accountingMode = DocumentPolicyResolver_1.DocumentPolicyResolver.resolveAccountingMode(invSettings);
        const shouldPostAccounting = createAccountingEffect && await this.isAccountingEnabled(companyId);
        const salesReturn = await this.salesReturnRepo.getById(companyId, id);
        if (!salesReturn)
            throw new Error(`Sales return not found: ${id}`);
        if (salesReturn.status !== 'DRAFT') {
            throw new Error('Only DRAFT sales returns can be posted');
        }
        const isAfterInvoice = salesReturn.returnContext === 'AFTER_INVOICE';
        const isBeforeInvoice = salesReturn.returnContext === 'BEFORE_INVOICE';
        const isDirect = salesReturn.returnContext === 'DIRECT';
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
        else if (isBeforeInvoice) {
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
        else if (isDirect) {
            if (accountingMode === 'PERPETUAL') {
                throw new Error('Standalone returns require a source document in Real-Time Costing mode');
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
        const distinctItemIds = [...new Set(salesReturn.lines.map(l => l.itemId))];
        const distinctTaxCodeIds = [...new Set(salesReturn.lines.filter(l => l.taxCodeId).map(l => l.taxCodeId))];
        const [itemsMap, categoriesMap, taxCodesMap] = await Promise.all([
            Promise.all(distinctItemIds.map(id => this.itemRepo.getItem(id))).then(res => new Map(res.filter((i) => !!i && i.companyId === companyId).map(i => [i.id, i]))),
            this.itemCategoryRepo.getCompanyCategories(companyId).then(res => new Map(res.map(c => [c.id, c]))),
            Promise.all(distinctTaxCodeIds.map(id => this.taxCodeRepo.getById(companyId, id))).then(res => new Map(res.filter((t) => !!t).map(t => [t.id, t]))),
        ]);
        const previousReturnQtyMap = new Map();
        const currentRunQtyBySource = new Map();
        for (const line of salesReturn.lines) {
            if (isAfterInvoice && salesInvoice) {
                const sourceLine = findSILine(salesInvoice, line.siLineId, line.itemId);
                if (sourceLine) {
                    const sourceKey = `SI:${sourceLine.lineId}`;
                    const previousReturned = await this.getPreviouslyReturnedQtyForSILine(companyId, salesInvoice.id, sourceLine.lineId, salesReturn.id);
                    previousReturnQtyMap.set(sourceKey, previousReturned);
                }
            }
            else if (isBeforeInvoice && deliveryNote) {
                const sourceLine = findDNLine(deliveryNote, line.dnLineId, line.itemId);
                if (sourceLine) {
                    const sourceKey = `DN:${sourceLine.lineId}`;
                    const previousReturned = await this.getPreviouslyReturnedQtyForDNLine(companyId, deliveryNote.id, sourceLine.lineId, salesReturn.id);
                    previousReturnQtyMap.set(sourceKey, previousReturned);
                }
            }
        }
        const warehouseId = salesReturn.warehouseId || settings.defaultWarehouseId || '';
        const stockLevelMap = new Map();
        for (const line of salesReturn.lines) {
            const item = itemsMap.get(line.itemId);
            if ((item === null || item === void 0 ? void 0 : item.trackInventory) && warehouseId) {
                const key = `${line.itemId}|${warehouseId}`;
                if (!stockLevelMap.has(key)) {
                    const existing = await this.inventoryService.preFetchStockLevel(companyId, line.itemId, warehouseId);
                    stockLevelMap.set(key, existing !== null && existing !== void 0 ? existing : StockLevel_1.StockLevel.createNew(companyId, line.itemId, warehouseId));
                }
            }
        }
        const uomConversionMap = new Map();
        for (const itemId of distinctItemIds) {
            const item = itemsMap.get(itemId);
            if (item && !uomConversionMap.has(item.id)) {
                const convs = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
                uomConversionMap.set(item.id, convs);
            }
        }
        const revenueDebitBucket = new Map();
        const taxDebitBucket = new Map();
        const cogsBucket = new Map();
        const inventoryMovements = new Map();
        for (const line of salesReturn.lines) {
            const item = itemsMap.get(line.itemId);
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
                line.uomId = line.uomId || sourceLine.uomId;
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
                const previousReturned = previousReturnQtyMap.get(sourceKey) || 0;
                const currentRunQty = currentRunQtyBySource.get(sourceKey) || 0;
                const remainingQty = (0, SalesPostingHelpers_1.roundMoney)(sourceLine.invoicedQty - previousReturned - currentRunQty);
                if (line.returnQty > remainingQty + 0.000001) {
                    throw new Error(`Return qty exceeds invoiced qty for ${line.itemName || sourceLine.itemName}`);
                }
                currentRunQtyBySource.set(sourceKey, (0, SalesPostingHelpers_1.roundMoney)(currentRunQty + line.returnQty));
            }
            else if (isBeforeInvoice) {
                const sourceLine = findDNLine(deliveryNote, line.dnLineId, line.itemId);
                if (!sourceLine) {
                    throw new Error(`Delivery note line not found for return line ${line.lineId}`);
                }
                line.dnLineId = sourceLine.lineId;
                line.soLineId = line.soLineId || sourceLine.soLineId;
                line.itemCode = line.itemCode || sourceLine.itemCode;
                line.itemName = line.itemName || sourceLine.itemName;
                line.uomId = line.uomId || sourceLine.uomId;
                line.uom = line.uom || sourceLine.uom;
                line.unitCostBase = line.unitCostBase || sourceLine.unitCostBase || 0;
                line.fxRateMovToBase = line.fxRateMovToBase || sourceLine.fxRateMovToBase || 1;
                line.fxRateCCYToBase = line.fxRateCCYToBase || sourceLine.fxRateCCYToBase || 1;
                line.taxRate = 0;
                line.taxAmountDoc = 0;
                line.taxAmountBase = 0;
                const sourceKey = `DN:${sourceLine.lineId}`;
                const previousReturned = previousReturnQtyMap.get(sourceKey) || 0;
                const currentRunQty = currentRunQtyBySource.get(sourceKey) || 0;
                const remainingQty = (0, SalesPostingHelpers_1.roundMoney)(sourceLine.deliveredQty - previousReturned - currentRunQty);
                if (line.returnQty > remainingQty + 0.000001) {
                    throw new Error(`Return qty exceeds delivered qty for ${line.itemName || sourceLine.itemName}`);
                }
                currentRunQtyBySource.set(sourceKey, (0, SalesPostingHelpers_1.roundMoney)(currentRunQty + line.returnQty));
            }
            else {
                if (!item)
                    throw new Error(`Item not found: ${line.itemId}`);
                line.itemCode = line.itemCode || item.code;
                line.itemName = line.itemName || item.name;
                line.uomId = line.uomId || item.salesUomId || item.baseUomId;
                line.uom = line.uom || item.salesUom || item.baseUom;
            }
            const lineTotalDoc = (0, SalesPostingHelpers_1.roundMoney)(line.returnQty * (line.unitPriceDoc || 0));
            const lineTotalBase = (0, SalesPostingHelpers_1.roundMoney)(line.returnQty * (line.unitPriceBase || 0));
            line.taxAmountDoc = (0, SalesPostingHelpers_1.roundMoney)(lineTotalDoc * line.taxRate);
            line.taxAmountBase = (0, SalesPostingHelpers_1.roundMoney)(lineTotalBase * line.taxRate);
            if (isAfterInvoice || isDirect) {
                if (!line.revenueAccountId) {
                    const category = item.categoryId ? categoriesMap.get(item.categoryId) : null;
                    line.revenueAccountId = item.revenueAccountId || (category === null || category === void 0 ? void 0 : category.defaultRevenueAccountId) || settings.defaultRevenueAccountId;
                }
                addToBucket(revenueDebitBucket, line.revenueAccountId, lineTotalBase, lineTotalDoc);
                if (line.taxAmountBase > 0 && line.taxCodeId) {
                    const sTaxCode = taxCodesMap.get(line.taxCodeId);
                    const taxAccountId = sTaxCode === null || sTaxCode === void 0 ? void 0 : sTaxCode.salesTaxAccountId;
                    addToBucket(taxDebitBucket, taxAccountId || '', line.taxAmountBase, line.taxAmountDoc);
                }
            }
            if (item.trackInventory) {
                const convs = uomConversionMap.get(item.id) || [];
                const conversionResult = (0, UomResolutionService_1.convertItemQtyToBaseUomDetailed)({
                    qty: line.returnQty,
                    item,
                    conversions: convs,
                    fromUomId: line.uomId,
                    fromUom: line.uom,
                    round: SalesPostingHelpers_1.roundMoney,
                    itemCode: item.code,
                });
                const qtyInBaseUom = conversionResult.qtyInBaseUom;
                const stockLevelKey = `${item.id}|${warehouseId}`;
                const level = stockLevelMap.get(stockLevelKey);
                if (!level)
                    throw new Error(`Stock level not pre-fetched for item ${item.code}`);
                const sourceLineCost = isAfterInvoice && salesInvoice
                    ? (_c = findSILine(salesInvoice, line.siLineId, line.itemId)) === null || _c === void 0 ? void 0 : _c.unitCostBase
                    : isBeforeInvoice && deliveryNote
                        ? (_d = findDNLine(deliveryNote, line.dnLineId, line.itemId)) === null || _d === void 0 ? void 0 : _d.unitCostBase
                        : undefined;
                const unitCostBase = (0, SalesPostingHelpers_1.roundMoney)(this.resolveReturnUnitCostBase(line.unitCostBase, level, sourceLineCost));
                line.unitCostBase = unitCostBase;
                const lineCostBase = (0, SalesPostingHelpers_1.roundMoney)(qtyInBaseUom * unitCostBase);
                if (DocumentPolicyResolver_1.DocumentPolicyResolver.shouldRequirePositiveCostOnReturn(accountingMode)) {
                    this.assertPositiveTrackedCost(qtyInBaseUom, unitCostBase, line.itemName || item.name, `sales return ${salesReturn.returnNumber}`);
                }
                const fxRateMovToBase = line.fxRateMovToBase > 0 ? line.fxRateMovToBase : (salesReturn.exchangeRate || 1);
                const fxRateCCYToBase = line.fxRateCCYToBase > 0 ? line.fxRateCCYToBase : (salesReturn.exchangeRate || 1);
                const unitCostInMoveCurrency = (0, SalesPostingHelpers_1.roundMoney)(unitCostBase / fxRateMovToBase);
                const qtyBefore = level.qtyOnHand;
                const oldMaxBusinessDate = level.maxBusinessDate;
                let newAvgBase = unitCostBase;
                let newAvgCCY = unitCostInMoveCurrency;
                if (qtyBefore > 0) {
                    const newQty = qtyBefore + qtyInBaseUom;
                    newAvgBase = (0, SalesPostingHelpers_1.roundMoney)(((level.avgCostBase * qtyBefore) + (unitCostBase * qtyInBaseUom)) / newQty);
                    newAvgCCY = (0, SalesPostingHelpers_1.roundMoney)(((level.avgCostCCY * qtyBefore) + (unitCostInMoveCurrency * qtyInBaseUom)) / newQty);
                }
                const settlesNegativeQty = Math.min(qtyInBaseUom, Math.max(-qtyBefore, 0));
                const newPositiveQty = qtyInBaseUom - settlesNegativeQty;
                const qtyAfter = qtyBefore + qtyInBaseUom;
                const movement = new StockMovement_1.StockMovement({
                    id: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                    companyId,
                    date: salesReturn.returnDate,
                    postingSeq: level.postingSeq + 1,
                    createdAt: new Date(),
                    createdBy: salesReturn.createdBy,
                    postedAt: new Date(),
                    itemId: item.id,
                    warehouseId,
                    direction: 'IN',
                    movementType: 'RETURN_IN',
                    qty: qtyInBaseUom,
                    uom: item.baseUom,
                    referenceType: 'SALES_RETURN',
                    referenceId: salesReturn.id,
                    referenceLineId: line.lineId,
                    unitCostBase,
                    totalCostBase: (0, SalesPostingHelpers_1.roundMoney)(unitCostBase * qtyInBaseUom),
                    unitCostCCY: newAvgCCY,
                    totalCostCCY: (0, SalesPostingHelpers_1.roundMoney)(newAvgCCY * qtyInBaseUom),
                    movementCurrency: salesReturn.currency.toUpperCase(),
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
                    costSettled: unitCostBase > 0,
                    isBackdated: salesReturn.returnDate < oldMaxBusinessDate,
                    costSource: 'RETURN',
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
                });
                level.qtyOnHand += qtyInBaseUom;
                level.avgCostBase = newAvgBase;
                level.avgCostCCY = newAvgCCY;
                level.lastCostBase = unitCostBase;
                level.lastCostCCY = newAvgCCY;
                level.postingSeq += 1;
                level.version += 1;
                level.totalMovements += 1;
                level.maxBusinessDate = salesReturn.returnDate > oldMaxBusinessDate ? salesReturn.returnDate : oldMaxBusinessDate;
                level.updatedAt = new Date();
                level.lastMovementId = movement.id;
                line.stockMovementId = movement.id;
                inventoryMovements.set(line.lineId, { movement, updatedLevel: level });
                if (DocumentPolicyResolver_1.DocumentPolicyResolver.shouldSalesReturnReverseInventoryAccounting(accountingMode, salesReturn.returnContext)) {
                    const category = item.categoryId ? categoriesMap.get(item.categoryId) : null;
                    const cogsAccountId = item.cogsAccountId || (category === null || category === void 0 ? void 0 : category.defaultCogsAccountId) || (invSettings === null || invSettings === void 0 ? void 0 : invSettings.defaultCOGSAccountId);
                    const inventoryAccountId = item.inventoryAssetAccountId || (category === null || category === void 0 ? void 0 : category.defaultInventoryAssetAccountId) || (invSettings === null || invSettings === void 0 ? void 0 : invSettings.defaultInventoryAssetAccountId);
                    if (!cogsAccountId)
                        throw new Error(`No COGS account configured for item ${item.code}`);
                    if (!inventoryAccountId)
                        throw new Error(`No inventory account configured for item ${item.code}`);
                    if (lineCostBase > 0) {
                        line.cogsAccountId = line.cogsAccountId || cogsAccountId;
                        line.inventoryAccountId = line.inventoryAccountId || inventoryAccountId;
                        const key = `${inventoryAccountId}|${cogsAccountId}`;
                        const existing = cogsBucket.get(key);
                        if (existing) {
                            existing.amountBase = (0, SalesPostingHelpers_1.roundMoney)(existing.amountBase + lineCostBase);
                        }
                        else {
                            cogsBucket.set(key, {
                                inventoryAccountId,
                                cogsAccountId,
                                amountBase: lineCostBase,
                            });
                        }
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
        const accountCache = new Map();
        const resolveAccountCached = async (idOrCode) => {
            if (!idOrCode)
                return '';
            if (accountCache.has(idOrCode))
                return accountCache.get(idOrCode);
            const resolved = await this.resolveAccountId(companyId, idOrCode);
            accountCache.set(idOrCode, resolved);
            return resolved;
        };
        const arAccountId = this.resolveARAccount(customer);
        const resolvedARId = await resolveAccountCached(arAccountId);
        for (const [, line] of revenueDebitBucket) {
            line.accountId = await resolveAccountCached(line.accountId);
        }
        for (const [, line] of taxDebitBucket) {
            line.accountId = await resolveAccountCached(line.accountId);
        }
        for (const [, cogsLine] of cogsBucket) {
            cogsLine.inventoryAccountId = await resolveAccountCached(cogsLine.inventoryAccountId);
            cogsLine.cogsAccountId = await resolveAccountCached(cogsLine.cogsAccountId);
        }
        const resolvedBaseCurrency = (baseCurrency || salesReturn.currency).toUpperCase();
        await this.transactionManager.runTransaction(async (transaction) => {
            for (const [, { movement, updatedLevel }] of inventoryMovements) {
                await this.inventoryService.writeStockMovement(movement, transaction);
                await this.inventoryService.writeStockLevel(updatedLevel, transaction);
            }
            if (shouldPostAccounting && cogsBucket.size > 0) {
                const cogsVoucherLines = [];
                for (const cogsLine of Array.from(cogsBucket.values())) {
                    const amount = (0, SalesPostingHelpers_1.roundMoney)(cogsLine.amountBase);
                    cogsVoucherLines.push({
                        accountId: cogsLine.inventoryAccountId,
                        baseAmount: amount,
                        docAmount: amount,
                    });
                    cogsVoucherLines.push({
                        accountId: cogsLine.cogsAccountId,
                        baseAmount: amount,
                        docAmount: amount,
                    });
                }
                const cogsVoucher = await this.accountingPostingService.postInTransaction({
                    companyId,
                    voucherType: VoucherTypes_1.VoucherType.SALES_RETURN,
                    voucherNo: `SR-COGS-${salesReturn.returnNumber}`,
                    date: salesReturn.returnDate,
                    description: `Sales Return ${salesReturn.returnNumber} COGS Reversal`,
                    currency: resolvedBaseCurrency,
                    exchangeRate: 1,
                    lines: cogsVoucherLines.map((vl, idx) => (Object.assign(Object.assign({}, vl), { side: idx % 2 === 0 ? 'Debit' : 'Credit' }))),
                    metadata: {
                        sourceModule: 'sales',
                        sourceType: 'SALES_RETURN',
                        sourceId: salesReturn.id,
                        referenceType: 'SALES_RETURN',
                        referenceId: salesReturn.id,
                        voucherPart: 'COGS',
                    },
                    createdBy: salesReturn.createdBy,
                    postingLockPolicy: VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED,
                    reference: salesReturn.returnNumber,
                    baseCurrencyOverride: resolvedBaseCurrency,
                    skipAccountValidation: true,
                }, transaction);
                salesReturn.cogsVoucherId = cogsVoucher.id;
            }
            else {
                salesReturn.cogsVoucherId = null;
            }
            if (shouldPostAccounting && (isAfterInvoice || isDirect)) {
                const revenueVoucherLines = [
                    ...Array.from(revenueDebitBucket.values()).map((line) => (Object.assign(Object.assign({}, line), { side: 'Debit' }))),
                    ...Array.from(taxDebitBucket.values()).map((line) => (Object.assign(Object.assign({}, line), { side: 'Debit' }))),
                    {
                        accountId: resolvedARId,
                        side: 'Credit',
                        baseAmount: (0, SalesPostingHelpers_1.roundMoney)(salesReturn.grandTotalBase),
                        docAmount: (0, SalesPostingHelpers_1.roundMoney)(salesReturn.grandTotalDoc),
                    },
                ];
                const revenueVoucher = await this.accountingPostingService.postInTransaction({
                    companyId,
                    voucherType: VoucherTypes_1.VoucherType.SALES_RETURN,
                    voucherNo: `SR-REV-${salesReturn.returnNumber}`,
                    date: salesReturn.returnDate,
                    description: `Sales Return ${salesReturn.returnNumber} Revenue Reversal`,
                    currency: salesReturn.currency,
                    exchangeRate: salesReturn.exchangeRate,
                    lines: revenueVoucherLines,
                    metadata: {
                        sourceModule: 'sales',
                        sourceType: 'SALES_RETURN',
                        sourceId: salesReturn.id,
                        referenceType: 'SALES_RETURN',
                        referenceId: salesReturn.id,
                        voucherPart: 'REVENUE',
                    },
                    createdBy: salesReturn.createdBy,
                    postingLockPolicy: VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED,
                    reference: salesReturn.returnNumber,
                    baseCurrencyOverride: resolvedBaseCurrency,
                    skipAccountValidation: true,
                }, transaction);
                salesReturn.revenueVoucherId = revenueVoucher.id;
                if (isAfterInvoice && salesInvoice) {
                    const invoice = salesInvoice;
                    invoice.outstandingAmountBase = (0, SalesPostingHelpers_1.roundMoney)(invoice.outstandingAmountBase - salesReturn.grandTotalBase);
                    invoice.paymentStatus = recalcPaymentStatus(invoice);
                    invoice.updatedAt = new Date();
                    await this.salesInvoiceRepo.update(invoice, transaction);
                }
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
    resolveARAccount(customer) {
        if (!customer.defaultARAccountId) {
            throw new Error(`Customer ${customer.displayName} has no linked AR account configured.`);
        }
        return customer.defaultARAccountId;
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
    assertPositiveTrackedCost(qty, unitCostBase, itemName, documentLabel) {
        if (qty > 0 && !(unitCostBase > 0)) {
            throw new Error(`Missing positive inventory cost for ${itemName} on ${documentLabel}`);
        }
    }
    resolveReturnUnitCostBase(currentCostBase, level, sourceLineCost) {
        if (sourceLineCost !== undefined && sourceLineCost !== null && sourceLineCost > 0) {
            return (0, SalesPostingHelpers_1.roundMoney)(sourceLineCost);
        }
        const current = (0, SalesPostingHelpers_1.roundMoney)(currentCostBase || 0);
        if (current > 0)
            return current;
        const avg = (0, SalesPostingHelpers_1.roundMoney)(level.avgCostBase || 0);
        if (avg > 0)
            return avg;
        return (0, SalesPostingHelpers_1.roundMoney)(level.lastCostBase || 0);
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