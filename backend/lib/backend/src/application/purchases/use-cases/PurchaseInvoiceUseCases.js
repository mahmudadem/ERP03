"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UnpostPurchaseInvoiceUseCase = exports.ListPurchaseInvoicesUseCase = exports.GetPurchaseInvoiceUseCase = exports.UpdatePurchaseInvoiceUseCase = exports.PostPurchaseInvoiceUseCase = exports.CreatePurchaseInvoiceUseCase = void 0;
const crypto_1 = require("crypto");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const PurchaseInvoice_1 = require("../../../domain/purchases/entities/PurchaseInvoice");
const PurchasePostingHelpers_1 = require("./PurchasePostingHelpers");
const PurchaseOrderUseCases_1 = require("./PurchaseOrderUseCases");
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
        const settings = await this.settingsRepo.getSettings(input.companyId);
        if (!settings)
            throw new Error('Purchases module is not initialized');
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
    constructor(settingsRepo, inventorySettingsRepo, purchaseInvoiceRepo, purchaseOrderRepo, partyRepo, taxCodeRepo, itemRepo, itemCategoryRepo, warehouseRepo, uomConversionRepo, companyCurrencyRepo, exchangeRateRepo, inventoryService, accountingPostingService, accountRepo, transactionManager) {
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
        this.accountingPostingService = accountingPostingService;
        this.transactionManager = transactionManager;
        this.accountRepo = accountRepo;
    }
    async execute(companyId, id) {
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings)
            throw new Error('Purchases module is not initialized');
        const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
        const isPerpetual = (invSettings === null || invSettings === void 0 ? void 0 : invSettings.inventoryAccountingMethod) === 'PERPETUAL';
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
        const voucherLines = [];
        const apAccountId = this.resolveAPAccount(vendor, settings);
        // PHASE 1: PRE-FETCH (Safety first!)
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
        // PHASE 2: ATOMIC POSTING
        await this.transactionManager.runTransaction(async (transaction) => {
            for (const line of pi.lines) {
                const item = itemsMap.get(line.itemId);
                if (!item)
                    throw new Error(`Item not found: ${line.itemId}`);
                line.trackInventory = item.trackInventory;
                const poLine = po ? findPOLine(po, line.poLineId, line.itemId) : null;
                this.validatePostingQuantity(line, poLine, settings.allowDirectInvoicing, settings.overInvoiceTolerancePct, isPOLinked);
                const taxCode = line.taxCodeId ? taxCodesMap.get(line.taxCodeId) : null;
                this.freezeTaxSnapshotSync(line, pi.exchangeRate, taxCode || undefined);
                line.accountId = this.resolveDebitAccountSync(companyId, item, isPerpetual, categoriesMap, settings.defaultPurchaseExpenseAccountId, invSettings === null || invSettings === void 0 ? void 0 : invSettings.defaultInventoryAssetAccountId);
                if (settings.allowDirectInvoicing && item.trackInventory && !hasGRNForThisLine(line)) {
                    const warehouseId = line.warehouseId || settings.defaultWarehouseId;
                    const warehouse = warehouseId ? warehousesMap.get(warehouseId) : null;
                    if (!warehouse)
                        throw new Error(`Warehouse required for ${item.name}`);
                    const qtyInBaseUom = await this.convertToBaseUom(companyId, line.invoicedQty, line.uom, item.baseUom, item.id, item.code);
                    const fxRateCCYToBase = await this.resolveCCYToBaseRate(companyId, item.costCurrency, baseCurrency, pi.currency, pi.exchangeRate, pi.invoiceDate);
                    const movement = await this.inventoryService.processIN({
                        companyId, itemId: line.itemId, warehouseId, qty: qtyInBaseUom, date: pi.invoiceDate,
                        movementType: 'PURCHASE_RECEIPT',
                        refs: { type: 'PURCHASE_INVOICE', docId: pi.id, lineId: line.lineId },
                        currentUser: pi.createdBy, unitCostInMoveCurrency: line.unitPriceDoc,
                        moveCurrency: pi.currency, fxRateMovToBase: pi.exchangeRate, fxRateCCYToBase,
                        transaction,
                    });
                    line.stockMovementId = movement.id;
                    line.warehouseId = warehouseId;
                }
                // DEBIT RECORDING (UUID Normalization)
                const resolvedDebitId = await this.resolveAccountId(companyId, line.accountId);
                voucherLines.push({
                    accountId: resolvedDebitId, side: 'Debit',
                    baseAmount: line.lineTotalBase, docAmount: line.lineTotalDoc,
                    notes: `${line.itemName} x ${line.invoicedQty}`,
                    metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, lineId: line.lineId, itemId: line.itemId }
                });
                if (line.taxAmountBase > 0 && line.taxCodeId) {
                    const pTaxCode = taxCodesMap.get(line.taxCodeId);
                    if (pTaxCode === null || pTaxCode === void 0 ? void 0 : pTaxCode.purchaseTaxAccountId) {
                        const resolvedTaxId = await this.resolveAccountId(companyId, pTaxCode.purchaseTaxAccountId);
                        voucherLines.push({
                            accountId: resolvedTaxId, side: 'Debit',
                            baseAmount: line.taxAmountBase, docAmount: line.taxAmountDoc,
                            notes: `Tax: ${line.taxCode || line.taxCodeId} on ${line.itemName}`,
                            metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, lineId: line.lineId, taxCodeId: line.taxCodeId }
                        });
                    }
                }
                if (poLine)
                    poLine.invoicedQty = (0, PurchasePostingHelpers_1.roundMoney)(poLine.invoicedQty + line.invoicedQty);
            }
            this.recalcInvoiceTotals(pi);
            // CREDIT RECORDING (UUID Normalization)
            const resolvedAPId = await this.resolveAccountId(companyId, apAccountId);
            voucherLines.push({
                accountId: resolvedAPId, side: 'Credit',
                baseAmount: pi.grandTotalBase,
                docAmount: pi.grandTotalDoc,
                notes: `AP - ${pi.vendorName} - ${pi.invoiceNumber}`,
                metadata: { sourceModule: 'purchases', sourceType: 'PURCHASE_INVOICE', sourceId: pi.id, vendorId: pi.vendorId }
            });
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
            }, transaction);
            pi.voucherId = voucher.id;
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
    resolveDebitAccountSync(companyId, item, isPerpetual, cats, dExp, dInv) {
        var _a;
        if (item.trackInventory) {
            if (!isPerpetual)
                return dExp || '';
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
    async convertToBaseUom(cid, qty, uom, base, itemId, itemCode) {
        if (uom.toUpperCase() === base.toUpperCase())
            return qty;
        const convs = await this.uomConversionRepo.getConversionsForItem(cid, itemId, { active: true });
        const d = convs.find(c => c.fromUom.toUpperCase() === uom.toUpperCase() && c.toUom.toUpperCase() === base.toUpperCase());
        if (d)
            return (0, PurchasePostingHelpers_1.roundMoney)(qty * d.factor);
        const r = convs.find(c => c.fromUom.toUpperCase() === base.toUpperCase() && c.toUom.toUpperCase() === uom.toUpperCase());
        if (r)
            return (0, PurchasePostingHelpers_1.roundMoney)(qty / r.factor);
        throw new Error(`No UOM conversion for ${itemCode}`);
    }
    async resolveCCYToBaseRate(cid, cost, base, move, rate, date) {
        if (cost.toUpperCase() === base.toUpperCase())
            return 1;
        if (cost.toUpperCase() === move.toUpperCase())
            return rate;
        const r = await this.exchangeRateRepo.getMostRecentRateBeforeDate(cid, cost, base, new Date(date));
        return r ? r.rate : rate;
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
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
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
                    uom: line.uom || (existing === null || existing === void 0 ? void 0 : existing.uom) || 'EA',
                    unitPriceDoc: (_g = (_f = line.unitPriceDoc) !== null && _f !== void 0 ? _f : existing === null || existing === void 0 ? void 0 : existing.unitPriceDoc) !== null && _g !== void 0 ? _g : 0,
                    lineTotalDoc: (_h = existing === null || existing === void 0 ? void 0 : existing.lineTotalDoc) !== null && _h !== void 0 ? _h : 0,
                    unitPriceBase: (_j = existing === null || existing === void 0 ? void 0 : existing.unitPriceBase) !== null && _j !== void 0 ? _j : 0,
                    lineTotalBase: (_k = existing === null || existing === void 0 ? void 0 : existing.lineTotalBase) !== null && _k !== void 0 ? _k : 0,
                    taxCodeId: (_l = line.taxCodeId) !== null && _l !== void 0 ? _l : existing === null || existing === void 0 ? void 0 : existing.taxCodeId,
                    taxCode: existing === null || existing === void 0 ? void 0 : existing.taxCode,
                    taxRate: (_m = existing === null || existing === void 0 ? void 0 : existing.taxRate) !== null && _m !== void 0 ? _m : 0,
                    taxAmountDoc: (_o = existing === null || existing === void 0 ? void 0 : existing.taxAmountDoc) !== null && _o !== void 0 ? _o : 0,
                    taxAmountBase: (_p = existing === null || existing === void 0 ? void 0 : existing.taxAmountBase) !== null && _p !== void 0 ? _p : 0,
                    warehouseId: (_q = line.warehouseId) !== null && _q !== void 0 ? _q : existing === null || existing === void 0 ? void 0 : existing.warehouseId,
                    accountId: (existing === null || existing === void 0 ? void 0 : existing.accountId) || '',
                    stockMovementId: (_r = existing === null || existing === void 0 ? void 0 : existing.stockMovementId) !== null && _r !== void 0 ? _r : null,
                    description: (_s = line.description) !== null && _s !== void 0 ? _s : existing === null || existing === void 0 ? void 0 : existing.description,
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
    constructor(purchaseInvoiceRepo, purchaseOrderRepo, inventoryService, accountingPostingService, transactionManager) {
        this.purchaseInvoiceRepo = purchaseInvoiceRepo;
        this.purchaseOrderRepo = purchaseOrderRepo;
        this.inventoryService = inventoryService;
        this.accountingPostingService = accountingPostingService;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id, currentUser) {
        const pi = await this.purchaseInvoiceRepo.getById(companyId, id);
        if (!pi)
            throw new Error(`Purchase invoice not found: ${id}`);
        if (pi.status !== 'POSTED')
            throw new Error('Only POSTED purchase invoices can be unposted');
        if (pi.paidAmountBase > 0) {
            throw new Error('Cannot unpost an invoice that has payments applied. Reverse the payments first.');
        }
        let po = null;
        if (pi.purchaseOrderId) {
            po = await this.purchaseOrderRepo.getById(companyId, pi.purchaseOrderId);
        }
        await this.transactionManager.runTransaction(async (transaction) => {
            // 1. Reverse accounting voucher and ledger
            if (pi.voucherId) {
                await this.accountingPostingService.deleteVoucherInTransaction(companyId, pi.voucherId, transaction);
                pi.voucherId = null;
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
}
exports.UnpostPurchaseInvoiceUseCase = UnpostPurchaseInvoiceUseCase;
//# sourceMappingURL=PurchaseInvoiceUseCases.js.map