"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateAndPostPurchaseInvoiceUseCase = exports.CreateAndPostPurchaseInvoiceUseCase = exports.UnpostPurchaseInvoiceUseCase = exports.ListPurchaseInvoicesUseCase = exports.GetPurchaseInvoiceUseCase = exports.UpdatePurchaseInvoiceUseCase = exports.PostPurchaseInvoiceUseCase = exports.CreatePurchaseInvoiceUseCase = exports.VALID_PAYMENT_METHODS = exports.SETTLEMENT_MODES = void 0;
const crypto_1 = require("crypto");
const DocumentPolicyResolver_1 = require("../../common/services/DocumentPolicyResolver");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const StockLevel_1 = require("../../../domain/inventory/entities/StockLevel");
const StockMovement_1 = require("../../../domain/inventory/entities/StockMovement");
const PurchaseInvoice_1 = require("../../../domain/purchases/entities/PurchaseInvoice");
const PaymentHistory_1 = require("../../../domain/shared/entities/PaymentHistory");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const UomResolutionService_1 = require("../../inventory/services/UomResolutionService");
const PurchasePostingHelpers_1 = require("./PurchasePostingHelpers");
const PurchaseOrderUseCases_1 = require("./PurchaseOrderUseCases");
exports.SETTLEMENT_MODES = ['DEFERRED', 'CASH_FULL', 'MULTI'];
exports.VALID_PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'OTHER'];
const DOCUMENT_SOURCES = ['native', 'default_form', 'custom_form'];
const PURCHASE_INVOICE_PERSONA_FORM_TYPES = {
    purchase_invoice: 'direct',
    purchase_invoice_direct: 'direct',
    purchase_invoice_linked: 'linked',
    purchase_invoice_service: 'service',
};
const normalizePurchaseInvoiceToken = (value) => String(value || '').trim().toLowerCase();
const resolveDocumentSource = (value) => {
    const source = normalizePurchaseInvoiceToken(value);
    return DOCUMENT_SOURCES.includes(source) ? source : 'default_form';
};
const hasNativeLinkedPurchaseSource = (input) => {
    if (input.purchaseOrderId)
        return true;
    return (input.lines || []).some((line) => !!line.poLineId || !!line.grnLineId);
};
const resolvePurchaseInvoicePersona = (input) => {
    if (resolveDocumentSource(input.source) === 'native') {
        return hasNativeLinkedPurchaseSource(input) ? 'linked' : 'direct';
    }
    const persona = normalizePurchaseInvoiceToken(input.persona);
    if (persona === 'direct' || persona === 'linked' || persona === 'service') {
        return persona;
    }
    const formType = normalizePurchaseInvoiceToken(input.formType || input.voucherType);
    if (PURCHASE_INVOICE_PERSONA_FORM_TYPES[formType]) {
        return PURCHASE_INVOICE_PERSONA_FORM_TYPES[formType];
    }
    if (persona === 'operational' || formType.includes('linked'))
        return 'linked';
    if (formType.includes('service'))
        return 'service';
    return 'direct';
};
const resolvePurchaseInvoiceFormType = (input, persona) => {
    const formType = normalizePurchaseInvoiceToken(input.formType);
    if (formType)
        return formType;
    const voucherType = normalizePurchaseInvoiceToken(input.voucherType);
    if (PURCHASE_INVOICE_PERSONA_FORM_TYPES[voucherType])
        return voucherType;
    return persona === 'direct' ? 'purchase_invoice_direct' : `purchase_invoice_${persona}`;
};
const resolvePurchaseInvoiceVoucherType = (input) => {
    const voucherType = normalizePurchaseInvoiceToken(input.voucherType || input.formType);
    if (!voucherType)
        return 'purchase_invoice';
    return PURCHASE_INVOICE_PERSONA_FORM_TYPES[voucherType] ? 'purchase_invoice' : voucherType;
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
const hasGRNForThisLine = (line) => !!line.grnLineId;
const assertValidPurchaseTaxCode = (taxCode, taxCodeId) => {
    if (!taxCode.active || (taxCode.scope !== 'PURCHASE' && taxCode.scope !== 'BOTH')) {
        throw new Error(`Tax code is not valid for purchase: ${taxCodeId}`);
    }
};
class CreatePurchaseInvoiceUseCase {
    constructor(settingsRepo, purchaseInvoiceRepo, purchaseOrderRepo, partyRepo, itemRepo, taxCodeRepo, companyCurrencyRepo) {
        this.settingsRepo = settingsRepo;
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.partyRepo = partyRepo;
        this.itemRepo = itemRepo;
        this.taxCodeRepo = taxCodeRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f;
        const source = resolveDocumentSource(input.source);
        const persona = resolvePurchaseInvoicePersona(input);
        input = Object.assign(Object.assign({}, input), { source, formType: resolvePurchaseInvoiceFormType(input, persona), voucherType: resolvePurchaseInvoiceVoucherType(input), persona });
        const settings = await this.settingsRepo.getSettings(input.companyId);
        if (!settings)
            throw new Error('Purchases module is not initialized');
        if (!DocumentPolicyResolver_1.DocumentPolicyResolver.isPurchaseInvoicePersonaAllowed(settings, input.persona)) {
            throw new Error(`Purchase invoice persona '${input.persona}' is not allowed by company governance policy`);
        }
        let po = null;
        if (input.purchaseOrderId) {
            po = await this.purchaseOrderRepo.getById(input.companyId, input.purchaseOrderId);
            if (!po)
                throw new Error(`Purchase order not found: ${input.purchaseOrderId}`);
            if (po.status === 'CANCELLED')
                throw new Error('Cannot invoice a cancelled purchase order');
        }
        const vendorId = (po === null || po === void 0 ? void 0 : po.vendorId) || input.vendorId;
        const vendor = await this.partyRepo.getById(input.companyId, vendorId);
        if (!vendor)
            throw new Error(`Vendor not found: ${vendorId}`);
        if (!vendor.roles.includes('VENDOR'))
            throw new Error(`Party is not a vendor: ${vendorId}`);
        const currency = (input.currency || (po === null || po === void 0 ? void 0 : po.currency) || vendor.defaultCurrency || 'USD').toUpperCase();
        const exchangeRate = (_b = (_a = input.exchangeRate) !== null && _a !== void 0 ? _a : po === null || po === void 0 ? void 0 : po.exchangeRate) !== null && _b !== void 0 ? _b : 1;
        const currencyEnabled = await this.companyCurrencyRepo.isEnabled(input.companyId, currency);
        if (!currencyEnabled) {
            throw new Error(`Currency is not enabled for company: ${currency}`);
        }
        const sourceLines = this.resolveSourceLines(input.lines, po, settings.allowDirectInvoicing);
        if (!sourceLines.length) {
            throw new Error('Purchase invoice must contain at least one line');
        }
        const lines = [];
        for (let i = 0; i < sourceLines.length; i += 1) {
            const sourceLine = sourceLines[i];
            const poLine = po ? findPOLine(po, sourceLine.poLineId, sourceLine.itemId) : null;
            const itemId = sourceLine.itemId || (poLine === null || poLine === void 0 ? void 0 : poLine.itemId);
            if (!itemId)
                throw new Error(`Line ${i + 1}: itemId is required`);
            const item = await this.itemRepo.getItem(itemId);
            if (!item || item.companyId !== input.companyId) {
                throw new Error(`Item not found: ${itemId}`);
            }
            const invoicedQty = sourceLine.invoicedQty;
            const unitPriceDoc = (_d = (_c = sourceLine.unitPriceDoc) !== null && _c !== void 0 ? _c : poLine === null || poLine === void 0 ? void 0 : poLine.unitPriceDoc) !== null && _d !== void 0 ? _d : 0;
            const lineTotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(invoicedQty * unitPriceDoc);
            const unitPriceBase = (0, PurchasePostingHelpers_1.roundMoney)(unitPriceDoc * exchangeRate);
            const lineTotalBase = (0, PurchasePostingHelpers_1.roundMoney)(lineTotalDoc * exchangeRate);
            const taxCodeId = await this.resolveTaxCodeId(input.companyId, sourceLine.taxCodeId, item);
            let taxRate = 0;
            if (taxCodeId) {
                const taxCode = await this.taxCodeRepo.getById(input.companyId, taxCodeId);
                if (!taxCode)
                    throw new Error(`Tax code not found: ${taxCodeId}`);
                assertValidPurchaseTaxCode(taxCode, taxCodeId);
                taxRate = taxCode.rate;
            }
            lines.push({
                lineId: sourceLine.lineId || (0, crypto_1.randomUUID)(),
                lineNo: (_e = sourceLine.lineNo) !== null && _e !== void 0 ? _e : i + 1,
                poLineId: sourceLine.poLineId || (poLine === null || poLine === void 0 ? void 0 : poLine.lineId),
                grnLineId: sourceLine.grnLineId,
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                trackInventory: item.trackInventory,
                invoicedQty,
                uomId: sourceLine.uomId || (poLine === null || poLine === void 0 ? void 0 : poLine.uomId) || item.purchaseUomId || item.baseUomId,
                uom: sourceLine.uom || (poLine === null || poLine === void 0 ? void 0 : poLine.uom) || item.purchaseUom || item.baseUom,
                unitPriceDoc,
                lineTotalDoc,
                unitPriceBase,
                lineTotalBase,
                taxCodeId,
                taxCode: undefined,
                taxRate,
                taxAmountDoc: (0, PurchasePostingHelpers_1.roundMoney)(lineTotalDoc * taxRate),
                taxAmountBase: (0, PurchasePostingHelpers_1.roundMoney)(lineTotalBase * taxRate),
                warehouseId: sourceLine.warehouseId || (poLine === null || poLine === void 0 ? void 0 : poLine.warehouseId) || settings.defaultWarehouseId,
                accountId: '',
                stockMovementId: null,
                description: sourceLine.description || (poLine === null || poLine === void 0 ? void 0 : poLine.description),
            });
        }
        const paymentTermsDays = (_f = vendor.paymentTermsDays) !== null && _f !== void 0 ? _f : settings.defaultPaymentTermsDays;
        const dueDate = input.dueDate || (0, PurchasePostingHelpers_1.addDaysToISODate)(input.invoiceDate, paymentTermsDays);
        const now = new Date();
        const invoice = new PurchaseInvoice_1.PurchaseInvoice({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            invoiceNumber: (0, PurchaseOrderUseCases_1.generateDocumentNumber)(settings, 'PI'),
            vendorInvoiceNumber: input.vendorInvoiceNumber,
            formType: input.formType || 'purchase_invoice_direct',
            voucherType: input.voucherType || 'purchase_invoice',
            persona: input.persona || 'direct',
            source: input.source,
            purchaseOrderId: po === null || po === void 0 ? void 0 : po.id,
            vendorId: vendor.id,
            vendorName: vendor.displayName,
            invoiceDate: input.invoiceDate,
            dueDate,
            currency,
            exchangeRate,
            lines,
            subtotalDoc: 0,
            taxTotalDoc: 0,
            grandTotalDoc: 0,
            subtotalBase: 0,
            taxTotalBase: 0,
            grandTotalBase: 0,
            paymentTermsDays,
            paymentStatus: 'UNPAID',
            paidAmountBase: 0,
            outstandingAmountBase: 0,
            status: 'DRAFT',
            voucherId: null,
            notes: input.notes,
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
        });
        invoice.outstandingAmountBase = invoice.grandTotalBase;
        await this.purchaseInvoiceRepo.create(invoice);
        await this.settingsRepo.saveSettings(settings);
        return invoice;
    }
    resolveSourceLines(lines, po, allowDirectInvoicing) {
        if (Array.isArray(lines) && lines.length > 0) {
            return lines;
        }
        if (!po)
            return [];
        return po.lines
            .map((line) => {
            let ceiling = 0;
            if (!allowDirectInvoicing && line.trackInventory) {
                ceiling = line.receivedQty - line.invoicedQty;
            }
            else if (!allowDirectInvoicing && !line.trackInventory) {
                ceiling = line.orderedQty - line.invoicedQty;
            }
            else {
                ceiling = line.orderedQty - line.invoicedQty;
            }
            return {
                poLineId: line.lineId,
                itemId: line.itemId,
                invoicedQty: (0, PurchasePostingHelpers_1.roundMoney)(Math.max(ceiling, 0)),
                uomId: line.uomId,
                uom: line.uom,
                unitPriceDoc: line.unitPriceDoc,
                taxCodeId: line.taxCodeId,
                warehouseId: line.warehouseId,
                description: line.description,
            };
        })
            .filter((line) => line.invoicedQty > 0);
    }
    async resolveTaxCodeId(companyId, requestedTaxCodeId, item) {
        if (requestedTaxCodeId) {
            return requestedTaxCodeId;
        }
        if (!item.defaultPurchaseTaxCodeId)
            return undefined;
        const defaultTax = await this.taxCodeRepo.getById(companyId, item.defaultPurchaseTaxCodeId);
        if (!defaultTax)
            return undefined;
        if (!defaultTax.active || (defaultTax.scope !== 'PURCHASE' && defaultTax.scope !== 'BOTH')) {
            return undefined;
        }
        return defaultTax.id;
    }
}
exports.CreatePurchaseInvoiceUseCase = CreatePurchaseInvoiceUseCase;
class PostPurchaseInvoiceUseCase {
    constructor(settingsRepo, inventorySettingsRepo, purchaseInvoiceRepo, purchaseOrderRepo, partyRepo, taxCodeRepo, itemRepo, itemCategoryRepo, warehouseRepo, uomConversionRepo, companyCurrencyRepo, exchangeRateRepo, inventoryService, companyModuleRepo, accountingPostingService, accountRepo, transactionManager, paymentHistoryRepo, voucherRepo, voucherSequenceRepo, ledgerRepo) {
        this.settingsRepo = settingsRepo;
        this.inventorySettingsRepo = inventorySettingsRepo;
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.partyRepo = partyRepo;
        this.taxCodeRepo = taxCodeRepo;
        this.itemRepo = itemRepo;
        this.itemCategoryRepo = itemCategoryRepo;
        this.warehouseRepo = warehouseRepo;
        this.uomConversionRepo = uomConversionRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
        this.exchangeRateRepo = exchangeRateRepo;
        this.inventoryService = inventoryService;
        this.companyModuleRepo = companyModuleRepo;
        this.accountingPostingService = accountingPostingService;
        this.transactionManager = transactionManager;
        this.paymentHistoryRepo = paymentHistoryRepo;
        this.voucherRepo = voucherRepo;
        this.voucherSequenceRepo = voucherSequenceRepo;
        this.ledgerRepo = ledgerRepo;
        this.accountRepo = accountRepo;
    }
    async execute(companyId, id, createAccountingEffect = true, settlementInput) {
        // ===================================================================
        // FIRESTORE TRANSACTION RULE: All reads must complete before any writes.
        // We pre-fetch ALL data here. The transaction callback only writes.
        // ===================================================================
        var _a, _b;
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings)
            throw new Error('Purchases module is not initialized');
        const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
        const accountingMode = DocumentPolicyResolver_1.DocumentPolicyResolver.resolveAccountingMode(invSettings);
        const shouldPostAccounting = createAccountingEffect && await this.isAccountingEnabled(companyId);
        const pi = await this.purchaseInvoiceRepo.getById(companyId, id);
        if (!pi)
            throw new Error(`Purchase invoice not found: ${id}`);
        if (pi.status !== 'DRAFT')
            throw new Error('Only DRAFT purchase invoices can be posted');
        const vendor = await this.partyRepo.getById(companyId, pi.vendorId);
        if (!vendor)
            throw new Error(`Vendor not found: ${pi.vendorId}`);
        const isPOLinked = !!pi.purchaseOrderId;
        let po = null;
        if (isPOLinked) {
            po = await this.purchaseOrderRepo.getById(companyId, pi.purchaseOrderId);
        }
        const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || pi.currency;
        // PHASE 1A: PRE-FETCH ALL MASTER DATA (bare reads — before transaction)
        const distinctItemIds = [...new Set(pi.lines.map(l => l.itemId))];
        const distinctTaxCodeIds = [...new Set(pi.lines.filter(l => l.taxCodeId).map(l => l.taxCodeId))];
        const distinctWarehouseIds = [...new Set(pi.lines.filter(l => l.warehouseId).map(l => l.warehouseId))];
        if (settings.defaultWarehouseId)
            distinctWarehouseIds.push(settings.defaultWarehouseId);
        const [itemsMap, categoriesMap, taxCodesMap, warehousesMap] = await Promise.all([
            Promise.all(distinctItemIds.map(id => this.itemRepo.getItem(id))).then(results => new Map(results.filter((i) => !!i && i.companyId === companyId).map(i => [i.id, i]))),
            this.itemCategoryRepo.getCompanyCategories(companyId).then(results => new Map(results.map(c => [c.id, c]))),
            Promise.all(distinctTaxCodeIds.map(id => this.taxCodeRepo.getById(companyId, id))).then(results => new Map(results.filter(t => !!t).map(t => [t.id, t]))),
            Promise.all(distinctWarehouseIds.map(id => this.warehouseRepo.getWarehouse(id))).then(results => new Map(results.filter(w => !!w && w.companyId === companyId).map(w => [w.id, w])))
        ]);
        // PHASE 1B: PRE-FETCH STOCK LEVELS (bare reads before transaction)
        const stockLevelMap = new Map();
        for (const line of pi.lines) {
            if (settings.allowDirectInvoicing && line.trackInventory && !hasGRNForThisLine(line)) {
                const warehouseId = line.warehouseId || settings.defaultWarehouseId;
                if (warehouseId && line.itemId) {
                    const key = `${line.itemId}|${warehouseId}`;
                    if (!stockLevelMap.has(key)) {
                        const existing = await this.inventoryService.preFetchStockLevel(companyId, line.itemId, warehouseId);
                        stockLevelMap.set(key, existing !== null && existing !== void 0 ? existing : StockLevel_1.StockLevel.createNew(companyId, line.itemId, warehouseId));
                    }
                }
            }
        }
        // PHASE 1C: PRE-FETCH UOM CONVERSIONS (bare reads before transaction)
        const uomConversionMap = new Map();
        for (const line of pi.lines) {
            if (settings.allowDirectInvoicing && line.trackInventory && !hasGRNForThisLine(line)) {
                const item = itemsMap.get(line.itemId);
                if (item && !uomConversionMap.has(item.id)) {
                    const convs = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
                    uomConversionMap.set(item.id, convs);
                }
            }
        }
        // PHASE 1D: COMPUTE INVENTORY MOVEMENTS OUTSIDE TRANSACTION
        const inventoryMovements = new Map();
        for (const line of pi.lines) {
            line.trackInventory = (_b = (_a = itemsMap.get(line.itemId)) === null || _a === void 0 ? void 0 : _a.trackInventory) !== null && _b !== void 0 ? _b : false;
            const poLine = po ? findPOLine(po, line.poLineId, line.itemId) : null;
            this.validatePostingQuantity(line, poLine, settings.allowDirectInvoicing, settings.overInvoiceTolerancePct, isPOLinked);
            const taxCode = line.taxCodeId ? taxCodesMap.get(line.taxCodeId) : null;
            this.freezeTaxSnapshotSync(line, pi.exchangeRate, taxCode || undefined);
            const hasReceiptBackedFlow = line.trackInventory && (!settings.allowDirectInvoicing || hasGRNForThisLine(line));
            const clearsGRNI = DocumentPolicyResolver_1.DocumentPolicyResolver.shouldPurchaseInvoiceClearGRNI(accountingMode, hasReceiptBackedFlow);
            line.accountId = this.resolveDebitAccountSync(companyId, itemsMap.get(line.itemId), clearsGRNI, categoriesMap, settings.defaultPurchaseExpenseAccountId, invSettings === null || invSettings === void 0 ? void 0 : invSettings.defaultInventoryAssetAccountId, settings.defaultGRNIAccountId);
            if (settings.allowDirectInvoicing && line.trackInventory && !hasGRNForThisLine(line)) {
                const warehouseId = line.warehouseId || settings.defaultWarehouseId;
                const warehouse = warehouseId ? warehousesMap.get(warehouseId) : null;
                if (!warehouse)
                    throw new Error(`Warehouse required for ${line.itemName}`);
                const item = itemsMap.get(line.itemId);
                const convs = uomConversionMap.get(item.id) || [];
                const conversionResult = (0, UomResolutionService_1.convertItemQtyToBaseUomDetailed)({
                    qty: line.invoicedQty,
                    item,
                    conversions: convs,
                    fromUomId: line.uomId,
                    fromUom: line.uom,
                    round: PurchasePostingHelpers_1.roundMoney,
                    itemCode: item.code,
                });
                const qtyInBaseUom = conversionResult.qtyInBaseUom;
                const fxRateCCYToBase = await this.resolveCCYToBaseRate(companyId, item.costCurrency, baseCurrency, pi.currency, pi.exchangeRate, pi.invoiceDate);
                const stockLevelKey = `${item.id}|${warehouseId}`;
                const level = stockLevelMap.get(stockLevelKey);
                if (!level)
                    throw new Error(`Stock level not found for ${item.name} in warehouse ${warehouseId}`);
                const qtyBefore = level.qtyOnHand;
                const oldMaxBusinessDate = level.maxBusinessDate;
                let receiptCostBase = 0;
                let receiptCostCCY = 0;
                let costBasis = 'MISSING';
                if (qtyBefore > 0) {
                    receiptCostBase = level.avgCostBase;
                    receiptCostCCY = level.avgCostCCY;
                    costBasis = 'AVG';
                }
                else if (level.lastCostBase > 0) {
                    receiptCostBase = level.lastCostBase;
                    receiptCostCCY = level.lastCostCCY;
                    costBasis = 'LAST_KNOWN';
                }
                const movementId = `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
                const settlesNegativeQty = Math.min(qtyInBaseUom, Math.max(-qtyBefore, 0));
                const newPositiveQty = qtyInBaseUom - settlesNegativeQty;
                const qtyAfter = qtyBefore + qtyInBaseUom;
                const movement = new StockMovement_1.StockMovement({
                    id: movementId,
                    companyId,
                    date: pi.invoiceDate,
                    postingSeq: level.postingSeq + 1,
                    createdAt: new Date(),
                    createdBy: pi.createdBy,
                    postedAt: new Date(),
                    itemId: item.id,
                    warehouseId,
                    direction: 'IN',
                    movementType: 'PURCHASE_RECEIPT',
                    qty: qtyInBaseUom,
                    uom: item.baseUom,
                    referenceType: 'PURCHASE_INVOICE',
                    referenceId: pi.id,
                    referenceLineId: line.lineId,
                    reversesMovementId: undefined,
                    transferPairId: undefined,
                    unitCostBase: line.unitPriceBase,
                    totalCostBase: (0, PurchasePostingHelpers_1.roundMoney)(line.unitPriceBase * qtyInBaseUom),
                    unitCostCCY: line.unitPriceDoc,
                    totalCostCCY: (0, PurchasePostingHelpers_1.roundMoney)(line.unitPriceDoc * qtyInBaseUom),
                    movementCurrency: pi.currency,
                    fxRateMovToBase: pi.exchangeRate,
                    fxRateCCYToBase,
                    fxRateKind: 'EFFECTIVE',
                    avgCostBaseAfter: (0, PurchasePostingHelpers_1.roundMoney)((level.avgCostBase * Math.max(qtyBefore, 0) + line.unitPriceBase * newPositiveQty) / Math.max(qtyAfter, 1)),
                    avgCostCCYAfter: level.avgCostCCY,
                    qtyBefore,
                    qtyAfter,
                    settlesNegativeQty,
                    newPositiveQty,
                    negativeQtyAtPosting: qtyAfter < 0,
                    costSettled: true,
                    isBackdated: pi.invoiceDate < oldMaxBusinessDate,
                    costSource: 'PURCHASE',
                    notes: undefined,
                    metadata: {
                        uomConversion: {
                            conversionId: conversionResult.trace.conversionId,
                            mode: conversionResult.trace.mode,
                            appliedFactor: conversionResult.trace.factor,
                            sourceQty: line.invoicedQty,
                            sourceUomId: line.uomId,
                            sourceUom: line.uom,
                            baseUomId: item.baseUomId,
                            baseUom: item.baseUom,
                        },
                    },
                });
                level.qtyOnHand += qtyInBaseUom;
                level.postingSeq += 1;
                level.version += 1;
                level.totalMovements += 1;
                level.maxBusinessDate = pi.invoiceDate > oldMaxBusinessDate ? pi.invoiceDate : oldMaxBusinessDate;
                level.updatedAt = new Date();
                level.lastMovementId = movement.id;
                line.stockMovementId = movement.id;
                line.warehouseId = warehouseId;
                inventoryMovements.set(line.lineId, { movement, updatedLevel: level, qtyInBaseUom });
            }
            if (poLine)
                poLine.invoicedQty = (0, PurchasePostingHelpers_1.roundMoney)(poLine.invoicedQty + line.invoicedQty);
        }
        this.recalcInvoiceTotals(pi);
        // PHASE 1E: PRE-RESOLVE ALL ACCOUNT IDS (bare reads before transaction)
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
        const resolvedDebitAccounts = new Map();
        const resolvedTaxAccounts = new Map();
        for (const line of pi.lines) {
            resolvedDebitAccounts.set(line.lineId, await resolveAccountCached(line.accountId));
            if (line.taxAmountBase > 0 && line.taxCodeId) {
                const pTaxCode = taxCodesMap.get(line.taxCodeId);
                if (pTaxCode === null || pTaxCode === void 0 ? void 0 : pTaxCode.purchaseTaxAccountId) {
                    resolvedTaxAccounts.set(line.lineId, await resolveAccountCached(pTaxCode.purchaseTaxAccountId));
                }
            }
        }
        const apAccountId = this.resolveAPAccount(vendor, settings);
        const resolvedAPId = await resolveAccountCached(apAccountId);
        // PHASE 2: TRANSACTION CALLBACK — WRITES ONLY
        await this.transactionManager.runTransaction(async (transaction) => {
            // Write inventory movements and stock levels
            for (const [lineId, { movement, updatedLevel }] of inventoryMovements) {
                await this.inventoryService.writeStockMovement(movement, transaction);
                await this.inventoryService.writeStockLevel(updatedLevel, transaction);
            }
            // Accumulate voucher lines using pre-resolved accounts
            const voucherLines = [];
            for (const line of pi.lines) {
                const resolvedDebitId = resolvedDebitAccounts.get(line.lineId) || '';
                voucherLines.push({
                    accountId: resolvedDebitId,
                    side: 'Debit',
                    baseAmount: line.lineTotalBase,
                    docAmount: line.lineTotalDoc,
                    notes: `${line.itemName} x ${line.invoicedQty}`,
                    metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, lineId: line.lineId, itemId: line.itemId }
                });
                if (line.taxAmountBase > 0 && line.taxCodeId) {
                    const resolvedTaxId = resolvedTaxAccounts.get(line.lineId);
                    if (resolvedTaxId) {
                        voucherLines.push({
                            accountId: resolvedTaxId,
                            side: 'Debit',
                            baseAmount: line.taxAmountBase,
                            docAmount: line.taxAmountDoc,
                            notes: `Tax: ${line.taxCode || line.taxCodeId} on ${line.itemName}`,
                            metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, lineId: line.lineId, taxCodeId: line.taxCodeId }
                        });
                    }
                }
            }
            voucherLines.push({
                accountId: resolvedAPId,
                side: 'Credit',
                baseAmount: pi.grandTotalBase,
                docAmount: pi.grandTotalDoc,
                notes: `AP - ${pi.vendorName} - ${pi.invoiceNumber}`,
                metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, vendorId: pi.vendorId }
            });
            if (shouldPostAccounting) {
                const voucher = await this.accountingPostingService.postInTransaction({
                    companyId,
                    voucherType: VoucherTypes_1.VoucherType.PURCHASE_INVOICE,
                    voucherNo: `PI-${pi.invoiceNumber}`,
                    date: pi.invoiceDate,
                    description: `PI ${pi.invoiceNumber} - ${pi.vendorName}`,
                    currency: pi.currency,
                    exchangeRate: pi.exchangeRate,
                    lines: voucherLines,
                    metadata: {
                        sourceModule: 'purchases',
                        sourceType: 'PURCHASE_INVOICE',
                        sourceId: pi.id,
                    },
                    createdBy: pi.createdBy,
                    postingLockPolicy: VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED,
                    reference: pi.invoiceNumber,
                    baseCurrencyOverride: baseCurrency,
                    skipAccountValidation: true,
                }, transaction);
                pi.voucherId = voucher.id;
            }
            // --- Process settlements inside the same transaction (atomic) ---
            if (settlementInput && settlementInput.settlementMode !== 'DEFERRED') {
                await this.processSettlementsInTransaction(companyId, pi, settlementInput, baseCurrency, transaction);
            }
            else {
                // DEFERRED: ensure payment fields reflect unpaid state
                pi.paymentStatus = 'UNPAID';
                pi.paidAmountBase = 0;
                pi.outstandingAmountBase = pi.grandTotalBase;
            }
            pi.status = 'POSTED';
            pi.postedAt = new Date();
            pi.updatedAt = new Date();
            await this.purchaseInvoiceRepo.update(pi, transaction);
            if (po) {
                po.status = (0, PurchasePostingHelpers_1.updatePOStatus)(po);
                po.updatedAt = new Date();
                await this.purchaseOrderRepo.update(po, transaction);
            }
        });
        return (await this.purchaseInvoiceRepo.getById(companyId, id));
    }
    async resolveAccountId(companyId, idOrCode) {
        if (!idOrCode)
            return '';
        if (!this.accountRepo)
            return idOrCode;
        const acc = (await this.accountRepo.getById(companyId, idOrCode)) || (await this.accountRepo.getByUserCode(companyId, idOrCode));
        return acc ? acc.id : idOrCode;
    }
    validatePostingQuantity(line, poLine, allowDirect, tolerance, isPOLinked) {
        if (!isPOLinked || !poLine)
            return;
        const toleranceFactor = 1 + (tolerance / 100);
        const eps = 0.000001;
        if (!allowDirect && line.trackInventory) {
            const maxByReceived = (poLine.receivedQty * toleranceFactor) - poLine.invoicedQty;
            if (line.invoicedQty > maxByReceived + eps) {
                throw new Error(`Invoiced qty exceeds received qty for ${line.itemName}`);
            }
            return;
        }
        const maxByOrdered = (poLine.orderedQty * toleranceFactor) - poLine.invoicedQty;
        if (line.invoicedQty > maxByOrdered + eps) {
            throw new Error(`Invoiced qty exceeds ordered qty for ${line.itemName}`);
        }
    }
    freezeTaxSnapshotSync(line, rate, tax) {
        line.lineTotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(line.invoicedQty * line.unitPriceDoc);
        line.unitPriceBase = (0, PurchasePostingHelpers_1.roundMoney)(line.unitPriceDoc * rate);
        line.lineTotalBase = (0, PurchasePostingHelpers_1.roundMoney)(line.lineTotalDoc * rate);
        line.taxCode = tax === null || tax === void 0 ? void 0 : tax.code;
        line.taxRate = (tax === null || tax === void 0 ? void 0 : tax.rate) || 0;
        line.taxAmountDoc = (0, PurchasePostingHelpers_1.roundMoney)(line.lineTotalDoc * line.taxRate);
        line.taxAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(line.lineTotalBase * line.taxRate);
    }
    recalcInvoiceTotals(pi) {
        pi.subtotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(pi.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
        pi.taxTotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(pi.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
        pi.grandTotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(pi.subtotalDoc + pi.taxTotalDoc);
        pi.subtotalBase = (0, PurchasePostingHelpers_1.roundMoney)(pi.lines.reduce((sum, line) => sum + line.lineTotalBase, 0));
        pi.taxTotalBase = (0, PurchasePostingHelpers_1.roundMoney)(pi.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
        pi.grandTotalBase = (0, PurchasePostingHelpers_1.roundMoney)(pi.subtotalBase + pi.taxTotalBase);
        pi.outstandingAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(Math.max(pi.grandTotalBase - (pi.paidAmountBase || 0), 0));
    }
    resolveDebitAccountSync(companyId, item, clearsGRNI, cats, dExp, dInv, dGRNI) {
        var _a;
        if (item.trackInventory) {
            if (clearsGRNI) {
                if (!dGRNI)
                    throw new Error(`No GRNI account configured for item ${item.name}`);
                return dGRNI;
            }
            return item.inventoryAssetAccountId || (item.categoryId ? (_a = cats.get(item.categoryId)) === null || _a === void 0 ? void 0 : _a.defaultInventoryAssetAccountId : null) || dInv || '';
        }
        if (item.cogsAccountId)
            return item.cogsAccountId;
        const category = item.categoryId ? cats.get(item.categoryId) : null;
        const resolved = (category === null || category === void 0 ? void 0 : category.defaultPurchaseExpenseAccountId) || dExp;
        if (!resolved)
            throw new Error(`No purchase expense account for item ${item.name}`);
        return resolved;
    }
    resolveAPAccount(vendor, settings) {
        const aid = vendor.defaultAPAccountId || settings.defaultAPAccountId;
        if (!aid)
            throw new Error(`No AP account for ${vendor.displayName}`);
        return aid;
    }
    async processSettlementsInTransaction(companyId, pi, settlementInput, baseCurrency, transaction) {
        var _a;
        const { settlementMode, receivablePayableAccountId, settlements } = settlementInput;
        const now = new Date();
        if (!this.paymentHistoryRepo || !this.voucherRepo || !this.voucherSequenceRepo || !this.ledgerRepo) {
            throw new Error('Payment settlement requires payment history, voucher, sequence, and ledger repositories');
        }
        if (!(receivablePayableAccountId === null || receivablePayableAccountId === void 0 ? void 0 : receivablePayableAccountId.trim())) {
            throw new Error('receivablePayableAccountId is required for settlement');
        }
        const settlementTotal = settlements.reduce((sum, s) => sum + (0, PurchasePostingHelpers_1.roundMoney)(s.amountBase), 0);
        if (settlementMode === 'CASH_FULL') {
            const outstanding = (0, PurchasePostingHelpers_1.roundMoney)(pi.grandTotalBase - (pi.paidAmountBase || 0));
            if (Math.abs(settlementTotal - outstanding) > 0.01) {
                throw new Error(`CASH_FULL settlement total (${settlementTotal}) must equal outstanding amount (${outstanding})`);
            }
            if (settlements.length !== 1) {
                throw new Error('CASH_FULL mode requires exactly one settlement row');
            }
        }
        if (settlementMode === 'MULTI') {
            const outstanding = (0, PurchasePostingHelpers_1.roundMoney)(pi.grandTotalBase - (pi.paidAmountBase || 0));
            if (settlementTotal > outstanding + 0.01) {
                throw new Error(`MULTI settlement total (${settlementTotal}) exceeds outstanding amount (${outstanding})`);
            }
            if (settlements.length === 0) {
                throw new Error('MULTI mode requires at least one settlement row');
            }
            for (const s of settlements) {
                if (!((_a = s.settlementAccountId) === null || _a === void 0 ? void 0 : _a.trim())) {
                    throw new Error('Each settlement row requires a settlementAccountId');
                }
                if (s.amountBase <= 0 || Number.isNaN(s.amountBase)) {
                    throw new Error('Each settlement row amount must be positive');
                }
                if (s.paymentMethod && !exports.VALID_PAYMENT_METHODS.includes(s.paymentMethod)) {
                    throw new Error(`Invalid paymentMethod: ${s.paymentMethod}`);
                }
            }
        }
        const baseCurrencyUpper = baseCurrency.toUpperCase();
        for (const settlement of settlements) {
            const settlementAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(settlement.amountBase);
            const settlementDate = settlement.paymentDate || now.toISOString().split('T')[0];
            const settlementMethod = settlement.paymentMethod || 'CASH';
            const voucherNo = await this.voucherSequenceRepo.getNextNumber(companyId, 'PV');
            const voucherId = `vch_${(0, crypto_1.randomUUID)()}`;
            const docAmount = (0, PurchasePostingHelpers_1.roundMoney)(settlementAmountBase / pi.exchangeRate);
            const drLine = new VoucherLineEntity_1.VoucherLineEntity(1, receivablePayableAccountId, 'Debit', settlementAmountBase, baseCurrencyUpper, docAmount, pi.currency, pi.exchangeRate, `Payment for ${pi.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`);
            const crLine = new VoucherLineEntity_1.VoucherLineEntity(2, settlement.settlementAccountId, 'Credit', settlementAmountBase, baseCurrencyUpper, docAmount, pi.currency, pi.exchangeRate, `Payment for ${pi.invoiceNumber}${settlement.reference ? ` (${settlement.reference})` : ''}`);
            const totalDebit = (0, PurchasePostingHelpers_1.roundMoney)(drLine.debitAmount);
            const totalCredit = (0, PurchasePostingHelpers_1.roundMoney)(crLine.creditAmount);
            const approvedVoucher = new VoucherEntity_1.VoucherEntity(voucherId, companyId, voucherNo, VoucherTypes_1.VoucherType.PAYMENT, settlementDate, `Payment for Purchase Invoice ${pi.invoiceNumber}`, pi.currency.toUpperCase(), baseCurrencyUpper, pi.exchangeRate, [drLine, crLine], totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, { sourceModule: 'purchases', sourceInvoiceId: pi.id, settlementMode }, pi.createdBy, now, pi.createdBy, now, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, settlement.reference || null);
            const postedVoucher = approvedVoucher.post(pi.createdBy, now, VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED);
            await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
            await this.voucherRepo.save(postedVoucher, transaction);
            const paymentId = `pay_${(0, crypto_1.randomUUID)()}`;
            const payment = new PaymentHistory_1.PaymentHistory({
                id: paymentId,
                companyId,
                sourceType: 'PURCHASE_INVOICE',
                sourceId: pi.id,
                sourceNumber: pi.invoiceNumber,
                amountBase: settlementAmountBase,
                currency: pi.currency,
                exchangeRate: pi.exchangeRate,
                amountDoc: docAmount,
                paymentDate: settlementDate,
                paymentMethod: settlementMethod,
                reference: settlement.reference || undefined,
                notes: settlement.notes || undefined,
                voucherId,
                createdBy: pi.createdBy,
                createdAt: now,
            });
            await this.paymentHistoryRepo.create(payment, transaction);
            pi.paidAmountBase = (0, PurchasePostingHelpers_1.roundMoney)((pi.paidAmountBase || 0) + settlementAmountBase);
            pi.outstandingAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(Math.max(pi.grandTotalBase - pi.paidAmountBase, 0));
            if (pi.outstandingAmountBase <= 0) {
                pi.paymentStatus = 'PAID';
            }
            else if (pi.paidAmountBase > 0) {
                pi.paymentStatus = 'PARTIALLY_PAID';
            }
            else {
                pi.paymentStatus = 'UNPAID';
            }
        }
    }
    async convertToBaseUom(cid, qty, uomId, uom, item) {
        const convs = await this.uomConversionRepo.getConversionsForItem(cid, item.id, { active: true });
        return (0, UomResolutionService_1.convertItemQtyToBaseUomDetailed)({
            qty,
            item,
            conversions: convs,
            fromUomId: uomId,
            fromUom: uom,
            round: PurchasePostingHelpers_1.roundMoney,
            itemCode: item.code,
        });
    }
    async resolveCCYToBaseRate(cid, cost, base, move, rate, date) {
        if (cost.toUpperCase() === base.toUpperCase())
            return 1;
        if (cost.toUpperCase() === move.toUpperCase())
            return rate;
        const r = await this.exchangeRateRepo.getMostRecentRateBeforeDate(cid, cost, base, new Date(date));
        return r ? r.rate : rate;
    }
    async isAccountingEnabled(companyId) {
        const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
        return !!(accountingModule === null || accountingModule === void 0 ? void 0 : accountingModule.initialized);
    }
}
exports.PostPurchaseInvoiceUseCase = PostPurchaseInvoiceUseCase;
class UpdatePurchaseInvoiceUseCase {
    constructor(purchaseInvoiceRepo, partyRepo) {
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.partyRepo = partyRepo;
    }
    async execute(input) {
        const current = await this.purchaseInvoiceRepo.getById(input.companyId, input.id);
        if (!current)
            throw new Error(`Purchase invoice not found: ${input.id}`);
        if (current.status !== 'DRAFT') {
            throw new Error('Only draft purchase invoices can be updated');
        }
        if (input.vendorId) {
            const vendor = await this.partyRepo.getById(input.companyId, input.vendorId);
            if (!vendor)
                throw new Error(`Vendor not found: ${input.vendorId}`);
            if (!vendor.roles.includes('VENDOR'))
                throw new Error(`Party is not a vendor: ${input.vendorId}`);
            current.vendorId = vendor.id;
            current.vendorName = vendor.displayName;
        }
        if (input.vendorInvoiceNumber !== undefined)
            current.vendorInvoiceNumber = input.vendorInvoiceNumber;
        if (input.invoiceDate !== undefined)
            current.invoiceDate = input.invoiceDate;
        if (input.dueDate !== undefined)
            current.dueDate = input.dueDate;
        if (input.currency !== undefined)
            current.currency = input.currency.toUpperCase();
        if (input.exchangeRate !== undefined)
            current.exchangeRate = input.exchangeRate;
        if (input.notes !== undefined)
            current.notes = input.notes;
        if (input.lines) {
            const existingById = new Map(current.lines.map((line) => [line.lineId, line]));
            const mappedLines = input.lines.map((line, index) => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
                const existing = line.lineId ? existingById.get(line.lineId) : undefined;
                return {
                    lineId: line.lineId || (0, crypto_1.randomUUID)(),
                    lineNo: (_b = (_a = line.lineNo) !== null && _a !== void 0 ? _a : existing === null || existing === void 0 ? void 0 : existing.lineNo) !== null && _b !== void 0 ? _b : index + 1,
                    poLineId: (_c = line.poLineId) !== null && _c !== void 0 ? _c : existing === null || existing === void 0 ? void 0 : existing.poLineId,
                    grnLineId: (_d = line.grnLineId) !== null && _d !== void 0 ? _d : existing === null || existing === void 0 ? void 0 : existing.grnLineId,
                    itemId: line.itemId || (existing === null || existing === void 0 ? void 0 : existing.itemId) || '',
                    itemCode: (existing === null || existing === void 0 ? void 0 : existing.itemCode) || '',
                    itemName: (existing === null || existing === void 0 ? void 0 : existing.itemName) || '',
                    trackInventory: (_e = existing === null || existing === void 0 ? void 0 : existing.trackInventory) !== null && _e !== void 0 ? _e : false,
                    invoicedQty: line.invoicedQty,
                    uomId: (_f = line.uomId) !== null && _f !== void 0 ? _f : existing === null || existing === void 0 ? void 0 : existing.uomId,
                    uom: line.uom || (existing === null || existing === void 0 ? void 0 : existing.uom) || 'EA',
                    unitPriceDoc: (_h = (_g = line.unitPriceDoc) !== null && _g !== void 0 ? _g : existing === null || existing === void 0 ? void 0 : existing.unitPriceDoc) !== null && _h !== void 0 ? _h : 0,
                    lineTotalDoc: (_j = existing === null || existing === void 0 ? void 0 : existing.lineTotalDoc) !== null && _j !== void 0 ? _j : 0,
                    unitPriceBase: (_k = existing === null || existing === void 0 ? void 0 : existing.unitPriceBase) !== null && _k !== void 0 ? _k : 0,
                    lineTotalBase: (_l = existing === null || existing === void 0 ? void 0 : existing.lineTotalBase) !== null && _l !== void 0 ? _l : 0,
                    taxCodeId: (_m = line.taxCodeId) !== null && _m !== void 0 ? _m : existing === null || existing === void 0 ? void 0 : existing.taxCodeId,
                    taxCode: existing === null || existing === void 0 ? void 0 : existing.taxCode,
                    taxRate: (_o = existing === null || existing === void 0 ? void 0 : existing.taxRate) !== null && _o !== void 0 ? _o : 0,
                    taxAmountDoc: (_p = existing === null || existing === void 0 ? void 0 : existing.taxAmountDoc) !== null && _p !== void 0 ? _p : 0,
                    taxAmountBase: (_q = existing === null || existing === void 0 ? void 0 : existing.taxAmountBase) !== null && _q !== void 0 ? _q : 0,
                    warehouseId: (_r = line.warehouseId) !== null && _r !== void 0 ? _r : existing === null || existing === void 0 ? void 0 : existing.warehouseId,
                    accountId: (existing === null || existing === void 0 ? void 0 : existing.accountId) || '',
                    stockMovementId: (_s = existing === null || existing === void 0 ? void 0 : existing.stockMovementId) !== null && _s !== void 0 ? _s : null,
                    description: (_t = line.description) !== null && _t !== void 0 ? _t : existing === null || existing === void 0 ? void 0 : existing.description,
                };
            });
            current.lines = mappedLines;
        }
        current.updatedAt = new Date();
        const updated = new PurchaseInvoice_1.PurchaseInvoice(current.toJSON());
        await this.purchaseInvoiceRepo.update(updated);
        return updated;
    }
}
exports.UpdatePurchaseInvoiceUseCase = UpdatePurchaseInvoiceUseCase;
class GetPurchaseInvoiceUseCase {
    constructor(purchaseInvoiceRepo) {
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
    }
    async execute(companyId, id) {
        const pi = await this.purchaseInvoiceRepo.getById(companyId, id);
        if (!pi)
            throw new Error(`Purchase invoice not found: ${id}`);
        return pi;
    }
}
exports.GetPurchaseInvoiceUseCase = GetPurchaseInvoiceUseCase;
class ListPurchaseInvoicesUseCase {
    constructor(purchaseInvoiceRepo) {
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
    }
    async execute(companyId, filters = {}) {
        return this.purchaseInvoiceRepo.list(companyId, {
            vendorId: filters.vendorId,
            purchaseOrderId: filters.purchaseOrderId,
            status: filters.status,
            paymentStatus: filters.paymentStatus,
            limit: filters.limit,
        });
    }
}
exports.ListPurchaseInvoicesUseCase = ListPurchaseInvoicesUseCase;
class UnpostPurchaseInvoiceUseCase {
    constructor(purchaseInvoiceRepo, purchaseOrderRepo, inventoryService, companyModuleRepo, accountingPostingService, transactionManager) {
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.inventoryService = inventoryService;
        this.companyModuleRepo = companyModuleRepo;
        this.accountingPostingService = accountingPostingService;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id, currentUser, createAccountingEffect = true) {
        const pi = await this.purchaseInvoiceRepo.getById(companyId, id);
        if (!pi)
            throw new Error(`Purchase invoice not found: ${id}`);
        if (pi.status !== 'POSTED')
            throw new Error('Only POSTED purchase invoices can be unposted');
        if (pi.paidAmountBase > 0) {
            throw new Error('Cannot unpost an invoice that has payments applied. Reverse the payments first.');
        }
        const shouldPostAccounting = createAccountingEffect && await this.isAccountingEnabled(companyId);
        let po = null;
        if (pi.purchaseOrderId) {
            po = await this.purchaseOrderRepo.getById(companyId, pi.purchaseOrderId);
        }
        await this.transactionManager.runTransaction(async (transaction) => {
            if (shouldPostAccounting) {
                if (pi.voucherId) {
                    await this.accountingPostingService.deleteVoucherInTransaction(companyId, pi.voucherId, transaction);
                    pi.voucherId = null;
                }
            }
            // 2. Reverse inventory movements (direct invoicing lines)
            for (const line of pi.lines) {
                if (line.stockMovementId) {
                    await this.inventoryService.deleteMovement(companyId, line.stockMovementId, transaction);
                    line.stockMovementId = null;
                }
                // 3. Reverse PO invoicedQty
                if (po) {
                    const poLine = findPOLine(po, line.poLineId, line.itemId);
                    if (poLine) {
                        poLine.invoicedQty = (0, PurchasePostingHelpers_1.roundMoney)(Math.max(0, poLine.invoicedQty - line.invoicedQty));
                    }
                }
            }
            // 4. Update PO status
            if (po) {
                po.status = (0, PurchasePostingHelpers_1.updatePOStatus)(po);
                po.updatedAt = new Date();
                await this.purchaseOrderRepo.update(po, transaction);
            }
            // 5. Revert PI to DRAFT
            pi.status = 'DRAFT';
            pi.postedAt = undefined;
            pi.updatedAt = new Date();
            await this.purchaseInvoiceRepo.update(pi, transaction);
        });
        const unposted = await this.purchaseInvoiceRepo.getById(companyId, id);
        if (!unposted)
            throw new Error('Failed to retrieve invoice after unposting');
        return unposted;
    }
    async isAccountingEnabled(companyId) {
        const accountingModule = await this.companyModuleRepo.get(companyId, 'accounting');
        return !!(accountingModule === null || accountingModule === void 0 ? void 0 : accountingModule.initialized);
    }
}
exports.UnpostPurchaseInvoiceUseCase = UnpostPurchaseInvoiceUseCase;
class CreateAndPostPurchaseInvoiceUseCase {
    constructor(createUseCase, postUseCase) {
        this.createUseCase = createUseCase;
        this.postUseCase = postUseCase;
    }
    async execute(input, settlementInput) {
        const pi = await this.createUseCase.execute(input);
        return this.postUseCase.execute(input.companyId, pi.id, true, settlementInput);
    }
}
exports.CreateAndPostPurchaseInvoiceUseCase = CreateAndPostPurchaseInvoiceUseCase;
class UpdateAndPostPurchaseInvoiceUseCase {
    constructor(updateUseCase, postUseCase) {
        this.updateUseCase = updateUseCase;
        this.postUseCase = postUseCase;
    }
    async execute(input, settlementInput) {
        const pi = await this.updateUseCase.execute(input);
        return this.postUseCase.execute(input.companyId, pi.id, true, settlementInput);
    }
}
exports.UpdateAndPostPurchaseInvoiceUseCase = UpdateAndPostPurchaseInvoiceUseCase;
//# sourceMappingURL=PurchaseInvoiceUseCases.js.map