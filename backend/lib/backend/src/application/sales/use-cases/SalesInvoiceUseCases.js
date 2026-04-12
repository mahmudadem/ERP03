"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListSalesInvoicesUseCase = exports.GetSalesInvoiceUseCase = exports.UpdateSalesInvoiceUseCase = exports.PostSalesInvoiceUseCase = exports.CreateSalesInvoiceUseCase = void 0;
const crypto_1 = require("crypto");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const SalesInvoice_1 = require("../../../domain/sales/entities/SalesInvoice");
const SalesPostingHelpers_1 = require("./SalesPostingHelpers");
const SalesOrderUseCases_1 = require("./SalesOrderUseCases");
const findSOLine = (so, soLineId, itemId) => {
    if (soLineId) {
        return so.lines.find((line) => line.lineId === soLineId) || null;
    }
    if (itemId) {
        return so.lines.find((line) => line.itemId === itemId) || null;
    }
    return null;
};
const hasDNForThisLine = (line) => !!line.dnLineId;
const assertValidSalesTaxCode = (taxCode, taxCodeId) => {
    if (!taxCode.active || (taxCode.scope !== 'SALES' && taxCode.scope !== 'BOTH')) {
        throw new Error(`Tax code is not valid for sales: ${taxCodeId}`);
    }
};
class CreateSalesInvoiceUseCase {
    constructor(settingsRepo, salesInvoiceRepo, salesOrderRepo, partyRepo, itemRepo, itemCategoryRepo, taxCodeRepo, companyCurrencyRepo) {
        this.settingsRepo = settingsRepo;
        this.salesInvoiceRepo = salesInvoiceRepo;
        this.salesOrderRepo = salesOrderRepo;
        this.partyRepo = partyRepo;
        this.itemRepo = itemRepo;
        this.itemCategoryRepo = itemCategoryRepo;
        this.taxCodeRepo = taxCodeRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f;
        const settings = await this.settingsRepo.getSettings(input.companyId);
        if (!settings)
            throw new Error('Sales module is not initialized');
        let so = null;
        if (input.salesOrderId) {
            so = await this.salesOrderRepo.getById(input.companyId, input.salesOrderId);
            if (!so)
                throw new Error(`Sales order not found: ${input.salesOrderId}`);
            if (so.status === 'CANCELLED') {
                throw new Error('Cannot create invoice from a cancelled sales order');
            }
        }
        const customerId = (so === null || so === void 0 ? void 0 : so.customerId) || input.customerId;
        const customer = await this.partyRepo.getById(input.companyId, customerId);
        this.assertCustomer(customer, customerId);
        const currency = (input.currency || (so === null || so === void 0 ? void 0 : so.currency) || (customer === null || customer === void 0 ? void 0 : customer.defaultCurrency) || 'USD').toUpperCase();
        const exchangeRate = (_b = (_a = input.exchangeRate) !== null && _a !== void 0 ? _a : so === null || so === void 0 ? void 0 : so.exchangeRate) !== null && _b !== void 0 ? _b : 1;
        if (exchangeRate <= 0 || Number.isNaN(exchangeRate)) {
            throw new Error('exchangeRate must be greater than 0');
        }
        const currencyEnabled = await this.companyCurrencyRepo.isEnabled(input.companyId, currency);
        if (!currencyEnabled) {
            throw new Error(`Currency is not enabled for company: ${currency}`);
        }
        const sourceLines = this.resolveSourceLines(input.lines, so, settings.allowDirectInvoicing);
        if (!sourceLines.length) {
            throw new Error('Sales invoice must contain at least one line');
        }
        const lines = [];
        for (let i = 0; i < sourceLines.length; i += 1) {
            const sourceLine = sourceLines[i];
            const soLine = so ? findSOLine(so, sourceLine.soLineId, sourceLine.itemId) : null;
            const itemId = sourceLine.itemId || (soLine === null || soLine === void 0 ? void 0 : soLine.itemId);
            if (!itemId)
                throw new Error(`Line ${i + 1}: itemId is required`);
            const item = await this.itemRepo.getItem(itemId);
            if (!item || item.companyId !== input.companyId) {
                throw new Error(`Item not found: ${itemId}`);
            }
            const invoicedQty = sourceLine.invoicedQty;
            const unitPriceDoc = (_d = (_c = sourceLine.unitPriceDoc) !== null && _c !== void 0 ? _c : soLine === null || soLine === void 0 ? void 0 : soLine.unitPriceDoc) !== null && _d !== void 0 ? _d : 0;
            const lineTotalDoc = (0, SalesPostingHelpers_1.roundMoney)(invoicedQty * unitPriceDoc);
            const unitPriceBase = (0, SalesPostingHelpers_1.roundMoney)(unitPriceDoc * exchangeRate);
            const lineTotalBase = (0, SalesPostingHelpers_1.roundMoney)(lineTotalDoc * exchangeRate);
            const taxCodeId = await this.resolveTaxCodeId(input.companyId, sourceLine.taxCodeId || (soLine === null || soLine === void 0 ? void 0 : soLine.taxCodeId), item.defaultSalesTaxCodeId);
            let taxRate = 0;
            let taxCode;
            if (taxCodeId) {
                const selectedTaxCode = await this.taxCodeRepo.getById(input.companyId, taxCodeId);
                if (!selectedTaxCode)
                    throw new Error(`Tax code not found: ${taxCodeId}`);
                assertValidSalesTaxCode(selectedTaxCode, taxCodeId);
                taxRate = selectedTaxCode.rate;
                taxCode = selectedTaxCode.code;
            }
            const revenueAccountId = await this.resolveRevenueAccount(input.companyId, item.id, settings.defaultRevenueAccountId);
            lines.push({
                lineId: sourceLine.lineId || (0, crypto_1.randomUUID)(),
                lineNo: (_e = sourceLine.lineNo) !== null && _e !== void 0 ? _e : i + 1,
                soLineId: sourceLine.soLineId || (soLine === null || soLine === void 0 ? void 0 : soLine.lineId),
                dnLineId: sourceLine.dnLineId,
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                trackInventory: item.trackInventory,
                invoicedQty,
                uom: sourceLine.uom || (soLine === null || soLine === void 0 ? void 0 : soLine.uom) || item.salesUom || item.baseUom,
                unitPriceDoc,
                lineTotalDoc,
                unitPriceBase,
                lineTotalBase,
                taxCodeId,
                taxCode,
                taxRate,
                taxAmountDoc: (0, SalesPostingHelpers_1.roundMoney)(lineTotalDoc * taxRate),
                taxAmountBase: (0, SalesPostingHelpers_1.roundMoney)(lineTotalBase * taxRate),
                warehouseId: sourceLine.warehouseId || (soLine === null || soLine === void 0 ? void 0 : soLine.warehouseId) || settings.defaultWarehouseId,
                revenueAccountId,
                cogsAccountId: item.cogsAccountId,
                inventoryAccountId: item.inventoryAssetAccountId,
                unitCostBase: undefined,
                lineCostBase: undefined,
                stockMovementId: null,
                description: sourceLine.description || (soLine === null || soLine === void 0 ? void 0 : soLine.description),
            });
        }
        const paymentTermsDays = (_f = customer.paymentTermsDays) !== null && _f !== void 0 ? _f : settings.defaultPaymentTermsDays;
        const dueDate = input.dueDate || (0, SalesPostingHelpers_1.addDaysToISODate)(input.invoiceDate, paymentTermsDays);
        const now = new Date();
        const invoiceNumber = await (0, SalesOrderUseCases_1.generateUniqueDocumentNumber)(settings, 'SI', async (candidate) => !!(await this.salesInvoiceRepo.getByNumber(input.companyId, candidate)));
        const si = new SalesInvoice_1.SalesInvoice({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            invoiceNumber,
            customerInvoiceNumber: input.customerInvoiceNumber,
            salesOrderId: so === null || so === void 0 ? void 0 : so.id,
            customerId: customer.id,
            customerName: customer.displayName,
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
            cogsVoucherId: null,
            notes: input.notes,
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
        });
        si.outstandingAmountBase = si.grandTotalBase;
        await this.salesInvoiceRepo.create(si);
        await this.settingsRepo.saveSettings(settings);
        return si;
    }
    assertCustomer(customer, customerId) {
        if (!customer)
            throw new Error(`Customer not found: ${customerId}`);
        if (!customer.roles.includes('CUSTOMER')) {
            throw new Error(`Party is not a customer: ${customerId}`);
        }
    }
    resolveSourceLines(lines, so, allowDirectInvoicing) {
        if (Array.isArray(lines) && lines.length > 0) {
            return lines;
        }
        if (!so)
            return [];
        return so.lines
            .map((line) => {
            let ceiling = 0;
            if (!allowDirectInvoicing && line.trackInventory) {
                ceiling = line.deliveredQty - line.invoicedQty;
            }
            else if (!allowDirectInvoicing && !line.trackInventory) {
                ceiling = line.orderedQty - line.invoicedQty;
            }
            else {
                ceiling = line.orderedQty - line.invoicedQty;
            }
            return {
                soLineId: line.lineId,
                itemId: line.itemId,
                dnLineId: undefined,
                invoicedQty: (0, SalesPostingHelpers_1.roundMoney)(Math.max(ceiling, 0)),
                uom: line.uom,
                unitPriceDoc: line.unitPriceDoc,
                taxCodeId: line.taxCodeId,
                warehouseId: line.warehouseId,
                description: line.description,
            };
        })
            .filter((line) => line.invoicedQty > 0);
    }
    async resolveTaxCodeId(companyId, requestedTaxCodeId, defaultItemTaxCodeId) {
        if (requestedTaxCodeId)
            return requestedTaxCodeId;
        if (!defaultItemTaxCodeId)
            return undefined;
        const taxCode = await this.taxCodeRepo.getById(companyId, defaultItemTaxCodeId);
        if (!taxCode)
            return undefined;
        if (!taxCode.active || (taxCode.scope !== 'SALES' && taxCode.scope !== 'BOTH')) {
            return undefined;
        }
        return taxCode.id;
    }
    async resolveRevenueAccount(companyId, itemId, defaultRevenueAccountId) {
        const item = await this.itemRepo.getItem(itemId);
        if (!item)
            throw new Error(`Item not found while resolving revenue account: ${itemId}`);
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
}
exports.CreateSalesInvoiceUseCase = CreateSalesInvoiceUseCase;
class PostSalesInvoiceUseCase {
    constructor(settingsRepo, inventorySettingsRepo, salesInvoiceRepo, salesOrderRepo, deliveryNoteRepo, partyRepo, taxCodeRepo, itemRepo, itemCategoryRepo, warehouseRepo, uomConversionRepo, companyCurrencyRepo, inventoryService, accountingPostingService, accountRepo, transactionManager) {
        this.settingsRepo = settingsRepo;
        this.inventorySettingsRepo = inventorySettingsRepo;
        this.salesInvoiceRepo = salesInvoiceRepo;
        this.salesOrderRepo = salesOrderRepo;
        this.deliveryNoteRepo = deliveryNoteRepo;
        this.partyRepo = partyRepo;
        this.taxCodeRepo = taxCodeRepo;
        this.itemRepo = itemRepo;
        this.itemCategoryRepo = itemCategoryRepo;
        this.warehouseRepo = warehouseRepo;
        this.uomConversionRepo = uomConversionRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
        this.inventoryService = inventoryService;
        this.transactionManager = transactionManager;
        this.accountingPostingService = accountingPostingService;
        this.accountRepo = accountRepo;
    }
    async execute(companyId, id) {
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings)
            throw new Error('Sales module not initialized');
        const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
        const isPerpetual = (invSettings === null || invSettings === void 0 ? void 0 : invSettings.inventoryAccountingMethod) === 'PERPETUAL';
        const si = await this.salesInvoiceRepo.getById(companyId, id);
        if (!si || si.status !== 'DRAFT')
            throw new Error('Invalid sales invoice state');
        const customer = await this.partyRepo.getById(companyId, si.customerId);
        if (!customer)
            throw new Error(`Customer not found: ${si.customerId}`);
        let so = null;
        if (si.salesOrderId) {
            so = await this.salesOrderRepo.getById(companyId, si.salesOrderId);
        }
        // PHASE 1: PRE-FETCH ALL DATA (Thunder-Fast)
        const distinctItemIds = [...new Set(si.lines.map(l => l.itemId))];
        const distinctTaxCodeIds = [...new Set(si.lines.filter(l => l.taxCodeId).map(l => l.taxCodeId))];
        const distinctWarehouseIds = [...new Set(si.lines.filter(l => l.warehouseId).map(l => l.warehouseId))];
        if (settings.defaultWarehouseId)
            distinctWarehouseIds.push(settings.defaultWarehouseId);
        const [itemsMap, categoriesMap, taxCodesMap, warehousesMap, baseCurrency, postedDNs] = await Promise.all([
            Promise.all(distinctItemIds.map(id => this.itemRepo.getItem(id))).then(res => new Map(res.filter((i) => !!i && i.companyId === companyId).map(i => [i.id, i]))),
            this.itemCategoryRepo.getCompanyCategories(companyId).then(res => new Map(res.map(c => [c.id, c]))),
            Promise.all(distinctTaxCodeIds.map(id => this.taxCodeRepo.getById(companyId, id))).then(res => new Map(res.filter(t => !!t).map(t => [t.id, t]))),
            Promise.all(distinctWarehouseIds.map(id => this.warehouseRepo.getWarehouse(id))).then(res => new Map(res.filter(w => !!w && w.companyId === companyId).map(w => [w.id, w]))),
            this.companyCurrencyRepo.getBaseCurrency(companyId),
            so ? this.deliveryNoteRepo.list(companyId, { salesOrderId: so.id, status: 'POSTED', limit: 200 }) : Promise.resolve([])
        ]);
        const arAccountId = this.resolveARAccount(customer, settings);
        const revenueCredits = new Map();
        const taxCredits = new Map();
        const cogsBucket = new Map();
        // PHASE 2: ATOMIC POSTING (Writes Only)
        await this.transactionManager.runTransaction(async (transaction) => {
            for (const line of si.lines) {
                const item = itemsMap.get(line.itemId);
                if (!item)
                    throw new Error(`Item not found: ${line.itemId}`);
                line.trackInventory = item.trackInventory;
                const soLine = so ? findSOLine(so, line.soLineId, line.itemId) : null;
                this.validatePostingQuantity(line, soLine, settings.allowDirectInvoicing, settings.overInvoiceTolerancePct, !!so);
                const taxCode = line.taxCodeId ? taxCodesMap.get(line.taxCodeId) : null;
                this.freezeTaxSnapshotSync(line, si.exchangeRate, taxCode || undefined);
                line.revenueAccountId = this.resolveRevenueAccountSync(companyId, item, categoriesMap, settings.defaultRevenueAccountId);
                const resolvedRevId = await this.resolveAccountId(companyId, line.revenueAccountId);
                this.addToBucket(revenueCredits, resolvedRevId, line.lineTotalBase, line.lineTotalDoc);
                if (line.taxAmountBase > 0 && line.taxCodeId) {
                    const sTaxCode = taxCodesMap.get(line.taxCodeId);
                    if (sTaxCode === null || sTaxCode === void 0 ? void 0 : sTaxCode.salesTaxAccountId) {
                        const resolvedTaxId = await this.resolveAccountId(companyId, sTaxCode.salesTaxAccountId);
                        this.addToBucket(taxCredits, resolvedTaxId, line.taxAmountBase, line.taxAmountDoc);
                    }
                }
                // Inventory movement logic
                if (settings.allowDirectInvoicing && line.trackInventory && !hasDNForThisLine(line)) {
                    const warehouseId = line.warehouseId || settings.defaultWarehouseId;
                    if (!warehouseId || !warehousesMap.has(warehouseId))
                        throw new Error(`Warehouse required for ${item.name}`);
                    const qtyInBaseUom = await this.convertToBaseUom(companyId, line.invoicedQty, line.uom, item.baseUom, item.id, item.code);
                    const movement = await this.inventoryService.processOUT({
                        companyId, itemId: line.itemId, warehouseId: warehouseId, qty: qtyInBaseUom, date: si.invoiceDate,
                        movementType: 'SALES_DELIVERY',
                        refs: { type: 'SALES_INVOICE', docId: si.id, lineId: line.lineId },
                        currentUser: si.createdBy,
                        transaction
                    });
                    line.stockMovementId = movement.id;
                    line.unitCostBase = (0, SalesPostingHelpers_1.roundMoney)(movement.unitCostBase || 0);
                    line.lineCostBase = (0, SalesPostingHelpers_1.roundMoney)(qtyInBaseUom * line.unitCostBase);
                    this.assertPositiveTrackedCost(qtyInBaseUom, line.unitCostBase, line.itemName || item.name, `sales invoice ${si.invoiceNumber}`);
                    if (isPerpetual && line.lineCostBase > 0) {
                        const accounts = this.resolveCOGSAccountsSync(companyId, item, categoriesMap, invSettings === null || invSettings === void 0 ? void 0 : invSettings.defaultCOGSAccountId, invSettings === null || invSettings === void 0 ? void 0 : invSettings.defaultInventoryAssetAccountId);
                        if (accounts) {
                            const resCOGSId = await this.resolveAccountId(companyId, accounts.cogsAccountId);
                            const resInvId = await this.resolveAccountId(companyId, accounts.inventoryAccountId);
                            this.addToCOGSBucket(cogsBucket, resCOGSId, resInvId, line.lineCostBase);
                        }
                    }
                }
                else if (!settings.allowDirectInvoicing && line.trackInventory) {
                    line.unitCostBase = (0, SalesPostingHelpers_1.roundMoney)(this.resolveControlledUnitCost(line, soLine, postedDNs));
                    line.lineCostBase = (0, SalesPostingHelpers_1.roundMoney)(line.invoicedQty * line.unitCostBase);
                    this.assertPositiveTrackedCost(line.invoicedQty, line.unitCostBase, line.itemName || item.name, `sales invoice ${si.invoiceNumber}`);
                    if (isPerpetual && line.lineCostBase > 0) {
                        const accounts = this.resolveCOGSAccountsSync(companyId, item, categoriesMap, invSettings === null || invSettings === void 0 ? void 0 : invSettings.defaultCOGSAccountId, invSettings === null || invSettings === void 0 ? void 0 : invSettings.defaultInventoryAssetAccountId);
                        if (accounts) {
                            const resCOGSId = await this.resolveAccountId(companyId, accounts.cogsAccountId);
                            const resInvId = await this.resolveAccountId(companyId, accounts.inventoryAccountId);
                            this.addToCOGSBucket(cogsBucket, resCOGSId, resInvId, line.lineCostBase);
                        }
                    }
                }
                if (soLine)
                    soLine.invoicedQty = (0, SalesPostingHelpers_1.roundMoney)(soLine.invoicedQty + line.invoicedQty);
            }
            this.recalcInvoiceTotals(si);
            const resolvedARId = await this.resolveAccountId(companyId, arAccountId);
            // Create main invoice voucher (AR vs Revenue + Tax)
            const revenueVoucherLines = [
                {
                    accountId: resolvedARId,
                    side: 'Debit',
                    baseAmount: (0, SalesPostingHelpers_1.roundMoney)(si.grandTotalBase),
                    docAmount: (0, SalesPostingHelpers_1.roundMoney)(si.grandTotalDoc),
                },
                ...Array.from(revenueCredits.values()).map((line) => (Object.assign(Object.assign({}, line), { side: 'Credit' }))),
                ...Array.from(taxCredits.values()).map((line) => (Object.assign(Object.assign({}, line), { side: 'Credit' }))),
            ];
            const revVoucher = await this.accountingPostingService.postInTransaction({
                companyId,
                voucherType: VoucherTypes_1.VoucherType.SALES_INVOICE,
                voucherNo: `SI-${si.invoiceNumber}`,
                date: si.invoiceDate,
                description: `Sales Invoice ${si.invoiceNumber} - ${si.customerName}`,
                currency: si.currency,
                exchangeRate: si.exchangeRate,
                lines: revenueVoucherLines,
                metadata: {
                    sourceModule: 'sales',
                    sourceType: 'SALES_INVOICE',
                    sourceId: si.id,
                    voucherPart: 'REVENUE',
                },
                createdBy: si.createdBy,
                postingLockPolicy: VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED,
                reference: si.invoiceNumber,
            }, transaction);
            si.voucherId = revVoucher.id;
            // Create COGS voucher (COGS vs Inventory) - Perpetual only
            if (isPerpetual && cogsBucket.size > 0) {
                const cogsVoucherLines = [];
                for (const line of Array.from(cogsBucket.values())) {
                    const amount = (0, SalesPostingHelpers_1.roundMoney)(line.amountBase);
                    cogsVoucherLines.push({
                        accountId: line.cogsAccountId,
                        side: 'Debit',
                        baseAmount: amount,
                        docAmount: amount,
                    });
                    cogsVoucherLines.push({
                        accountId: line.inventoryAccountId,
                        side: 'Credit',
                        baseAmount: amount,
                        docAmount: amount,
                    });
                }
                const cogsVoucher = await this.accountingPostingService.postInTransaction({
                    companyId,
                    voucherType: VoucherTypes_1.VoucherType.SALES_INVOICE,
                    voucherNo: `SI-COGS-${si.invoiceNumber}`,
                    date: si.invoiceDate,
                    description: `Sales Invoice ${si.invoiceNumber} COGS`,
                    currency: (baseCurrency || si.currency).toUpperCase(),
                    exchangeRate: 1,
                    lines: cogsVoucherLines,
                    metadata: {
                        sourceModule: 'sales',
                        sourceType: 'SALES_INVOICE',
                        sourceId: si.id,
                        voucherPart: 'COGS',
                    },
                    createdBy: si.createdBy,
                    postingLockPolicy: VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED,
                    reference: si.invoiceNumber,
                }, transaction);
                si.cogsVoucherId = cogsVoucher.id;
            }
            if (so) {
                so.updatedAt = new Date();
                await this.salesOrderRepo.update(so, transaction);
            }
            si.status = 'POSTED';
            si.postedAt = new Date();
            si.updatedAt = new Date();
            si.paymentStatus = 'UNPAID';
            si.paidAmountBase = 0;
            si.outstandingAmountBase = si.grandTotalBase;
            await this.salesInvoiceRepo.update(si, transaction);
        });
        return (await this.salesInvoiceRepo.getById(companyId, id));
    }
    async resolveAccountId(companyId, idOrCode) {
        if (!idOrCode)
            return '';
        if (!this.accountRepo)
            return idOrCode;
        const acc = (await this.accountRepo.getById(companyId, idOrCode)) || (await this.accountRepo.getByUserCode(companyId, idOrCode));
        return acc ? acc.id : idOrCode;
    }
    validatePostingQuantity(line, soLine, allowDirect, tolerance, isSOLinked) {
        if (!isSOLinked || !soLine)
            return;
        const toleranceFactor = 1 + (tolerance / 100);
        const eps = 0.000001;
        if (!allowDirect && line.trackInventory) {
            const maxByDelivered = (soLine.deliveredQty * toleranceFactor) - soLine.invoicedQty;
            if (line.invoicedQty > maxByDelivered + eps) {
                throw new Error(`Invoiced qty exceeds delivered qty for ${line.itemName}`);
            }
            return;
        }
        const maxByOrdered = (soLine.orderedQty * toleranceFactor) - soLine.invoicedQty;
        if (line.invoicedQty > maxByOrdered + eps) {
            throw new Error(`Invoiced qty exceeds ordered qty for ${line.itemName}`);
        }
    }
    freezeTaxSnapshotSync(line, rate, tax) {
        line.lineTotalDoc = (0, SalesPostingHelpers_1.roundMoney)(line.invoicedQty * line.unitPriceDoc);
        line.unitPriceBase = (0, SalesPostingHelpers_1.roundMoney)(line.unitPriceDoc * rate);
        line.lineTotalBase = (0, SalesPostingHelpers_1.roundMoney)(line.lineTotalDoc * rate);
        line.taxCode = tax === null || tax === void 0 ? void 0 : tax.code;
        line.taxRate = (tax === null || tax === void 0 ? void 0 : tax.rate) || 0;
        line.taxAmountDoc = (0, SalesPostingHelpers_1.roundMoney)(line.lineTotalDoc * line.taxRate);
        line.taxAmountBase = (0, SalesPostingHelpers_1.roundMoney)(line.lineTotalBase * line.taxRate);
    }
    resolveRevenueAccountSync(cid, item, cats, dRev) {
        var _a;
        return item.revenueAccountId || (item.categoryId ? (_a = cats.get(item.categoryId)) === null || _a === void 0 ? void 0 : _a.defaultRevenueAccountId : null) || dRev;
    }
    resolveCOGSAccountsSync(cid, item, cats, dCOGS, dInv) {
        const c = item.categoryId ? cats.get(item.categoryId) : null;
        const cogsId = item.cogsAccountId || (c === null || c === void 0 ? void 0 : c.defaultCogsAccountId) || dCOGS;
        const invId = item.inventoryAssetAccountId || (c === null || c === void 0 ? void 0 : c.defaultInventoryAssetAccountId) || dInv;
        return (cogsId && invId) ? { cogsAccountId: cogsId, inventoryAccountId: invId } : null;
    }
    resolveARAccount(customer, settings) {
        const aid = customer.defaultARAccountId || settings.defaultARAccountId;
        if (!aid)
            throw new Error(`No AR account resolved for ${customer.displayName}`);
        return aid;
    }
    addToBucket(bucket, aid, base, doc) {
        const existing = bucket.get(aid);
        if (existing) {
            existing.baseAmount = (0, SalesPostingHelpers_1.roundMoney)(existing.baseAmount + base);
            existing.docAmount = (0, SalesPostingHelpers_1.roundMoney)(existing.docAmount + doc);
        }
        else {
            bucket.set(aid, { accountId: aid, baseAmount: (0, SalesPostingHelpers_1.roundMoney)(base), docAmount: (0, SalesPostingHelpers_1.roundMoney)(doc), side: 'Credit' });
        }
    }
    addToCOGSBucket(bucket, cogsId, invId, amount) {
        const key = `${cogsId}|${invId}`;
        const existing = bucket.get(key);
        if (existing) {
            existing.amountBase = (0, SalesPostingHelpers_1.roundMoney)(existing.amountBase + amount);
        }
        else {
            bucket.set(key, { cogsAccountId: cogsId, inventoryAccountId: invId, amountBase: (0, SalesPostingHelpers_1.roundMoney)(amount) });
        }
    }
    resolveControlledUnitCost(line, soLine, postedDNs) {
        const matched = postedDNs.flatMap(dn => dn.lines).filter(l => (l.lineId === line.dnLineId || l.soLineId === line.soLineId || (l.itemId === (soLine === null || soLine === void 0 ? void 0 : soLine.itemId))) && l.unitCostBase > 0);
        if (!matched.length)
            return 0;
        const totalV = matched.reduce((s, l) => s + (l.unitCostBase * l.deliveredQty), 0);
        const totalQ = matched.reduce((s, l) => s + l.deliveredQty, 0);
        return totalQ > 0 ? (totalV / totalQ) : 0;
    }
    recalcInvoiceTotals(si) {
        si.subtotalDoc = (0, SalesPostingHelpers_1.roundMoney)(si.lines.reduce((s, l) => s + l.lineTotalDoc, 0));
        si.taxTotalDoc = (0, SalesPostingHelpers_1.roundMoney)(si.lines.reduce((s, l) => s + l.taxAmountDoc, 0));
        si.grandTotalDoc = (0, SalesPostingHelpers_1.roundMoney)(si.subtotalDoc + si.taxTotalDoc);
        si.subtotalBase = (0, SalesPostingHelpers_1.roundMoney)(si.lines.reduce((s, l) => s + l.lineTotalBase, 0));
        si.taxTotalBase = (0, SalesPostingHelpers_1.roundMoney)(si.lines.reduce((s, l) => s + l.taxAmountBase, 0));
        si.grandTotalBase = (0, SalesPostingHelpers_1.roundMoney)(si.subtotalBase + si.taxTotalBase);
    }
    async convertToBaseUom(cid, qty, uom, base, itemId, itemCode) {
        if (uom.toUpperCase() === base.toUpperCase())
            return qty;
        const convs = await this.uomConversionRepo.getConversionsForItem(cid, itemId, { active: true });
        const d = convs.find(c => c.fromUom.toUpperCase() === uom.toUpperCase() && c.toUom.toUpperCase() === base.toUpperCase());
        if (d)
            return (0, SalesPostingHelpers_1.roundMoney)(qty * d.factor);
        const r = convs.find(c => c.fromUom.toUpperCase() === base.toUpperCase() && c.toUom.toUpperCase() === uom.toUpperCase());
        if (r)
            return (0, SalesPostingHelpers_1.roundMoney)(qty / r.factor);
        throw new Error(`No UOM conversion for ${itemCode}`);
    }
    assertPositiveTrackedCost(qty, unitCostBase, itemName, documentLabel) {
        if (qty > 0 && !(unitCostBase > 0)) {
            throw new Error(`Missing positive inventory cost for ${itemName} on ${documentLabel}`);
        }
    }
}
exports.PostSalesInvoiceUseCase = PostSalesInvoiceUseCase;
class UpdateSalesInvoiceUseCase {
    constructor(salesInvoiceRepo, partyRepo) {
        this.salesInvoiceRepo = salesInvoiceRepo;
        this.partyRepo = partyRepo;
    }
    async execute(input) {
        const current = await this.salesInvoiceRepo.getById(input.companyId, input.id);
        if (!current)
            throw new Error(`Sales invoice not found: ${input.id}`);
        if (current.status !== 'DRAFT') {
            throw new Error('Only draft sales invoices can be updated');
        }
        if (input.customerId) {
            const customer = await this.partyRepo.getById(input.companyId, input.customerId);
            if (!customer)
                throw new Error(`Customer not found: ${input.customerId}`);
            if (!customer.roles.includes('CUSTOMER')) {
                throw new Error(`Party is not a customer: ${input.customerId}`);
            }
            current.customerId = customer.id;
            current.customerName = customer.displayName;
        }
        if (input.customerInvoiceNumber !== undefined)
            current.customerInvoiceNumber = input.customerInvoiceNumber;
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
                const itemId = line.itemId || (existing === null || existing === void 0 ? void 0 : existing.itemId);
                if (!itemId) {
                    throw new Error(`Line ${index + 1}: itemId is required`);
                }
                return {
                    lineId: line.lineId || (0, crypto_1.randomUUID)(),
                    lineNo: (_b = (_a = line.lineNo) !== null && _a !== void 0 ? _a : existing === null || existing === void 0 ? void 0 : existing.lineNo) !== null && _b !== void 0 ? _b : index + 1,
                    soLineId: (_c = line.soLineId) !== null && _c !== void 0 ? _c : existing === null || existing === void 0 ? void 0 : existing.soLineId,
                    dnLineId: (_d = line.dnLineId) !== null && _d !== void 0 ? _d : existing === null || existing === void 0 ? void 0 : existing.dnLineId,
                    itemId,
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
                    revenueAccountId: (existing === null || existing === void 0 ? void 0 : existing.revenueAccountId) || '',
                    cogsAccountId: existing === null || existing === void 0 ? void 0 : existing.cogsAccountId,
                    inventoryAccountId: existing === null || existing === void 0 ? void 0 : existing.inventoryAccountId,
                    unitCostBase: existing === null || existing === void 0 ? void 0 : existing.unitCostBase,
                    lineCostBase: existing === null || existing === void 0 ? void 0 : existing.lineCostBase,
                    stockMovementId: (_r = existing === null || existing === void 0 ? void 0 : existing.stockMovementId) !== null && _r !== void 0 ? _r : null,
                    description: (_s = line.description) !== null && _s !== void 0 ? _s : existing === null || existing === void 0 ? void 0 : existing.description,
                };
            });
            current.lines = mappedLines;
        }
        current.updatedAt = new Date();
        const updated = new SalesInvoice_1.SalesInvoice(current.toJSON());
        await this.salesInvoiceRepo.update(updated);
        return updated;
    }
}
exports.UpdateSalesInvoiceUseCase = UpdateSalesInvoiceUseCase;
class GetSalesInvoiceUseCase {
    constructor(salesInvoiceRepo) {
        this.salesInvoiceRepo = salesInvoiceRepo;
    }
    async execute(companyId, id) {
        const si = await this.salesInvoiceRepo.getById(companyId, id);
        if (!si)
            throw new Error(`Sales invoice not found: ${id}`);
        return si;
    }
}
exports.GetSalesInvoiceUseCase = GetSalesInvoiceUseCase;
class ListSalesInvoicesUseCase {
    constructor(salesInvoiceRepo) {
        this.salesInvoiceRepo = salesInvoiceRepo;
    }
    async execute(companyId, filters = {}) {
        return this.salesInvoiceRepo.list(companyId, {
            customerId: filters.customerId,
            salesOrderId: filters.salesOrderId,
            status: filters.status,
            paymentStatus: filters.paymentStatus,
            limit: filters.limit,
        });
    }
}
exports.ListSalesInvoicesUseCase = ListSalesInvoicesUseCase;
//# sourceMappingURL=SalesInvoiceUseCases.js.map