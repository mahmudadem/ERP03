"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListSalesInvoicesUseCase = exports.GetSalesInvoiceUseCase = exports.UpdateSalesInvoiceUseCase = exports.PostSalesInvoiceUseCase = exports.CreateSalesInvoiceUseCase = void 0;
const crypto_1 = require("crypto");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
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
const addToBucket = (bucket, accountId, baseAmount, docAmount) => {
    if (baseAmount <= 0 && docAmount <= 0)
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
        const sourceLines = this.resolveSourceLines(input.lines, so, settings.salesControlMode);
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
        const si = new SalesInvoice_1.SalesInvoice({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            invoiceNumber: (0, SalesOrderUseCases_1.generateDocumentNumber)(settings, 'SI'),
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
    resolveSourceLines(lines, so, mode) {
        if (Array.isArray(lines) && lines.length > 0) {
            return lines;
        }
        if (!so)
            return [];
        return so.lines
            .map((line) => {
            let ceiling = 0;
            if (mode === 'CONTROLLED' && line.trackInventory) {
                ceiling = line.deliveredQty - line.invoicedQty;
            }
            else if (mode === 'CONTROLLED' && !line.trackInventory) {
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
    constructor(settingsRepo, salesInvoiceRepo, salesOrderRepo, deliveryNoteRepo, partyRepo, taxCodeRepo, itemRepo, itemCategoryRepo, warehouseRepo, uomConversionRepo, companyCurrencyRepo, inventoryService, voucherRepo, ledgerRepo, transactionManager) {
        this.settingsRepo = settingsRepo;
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
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id) {
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings)
            throw new Error('Sales module is not initialized');
        const si = await this.salesInvoiceRepo.getById(companyId, id);
        if (!si)
            throw new Error(`Sales invoice not found: ${id}`);
        if (si.status !== 'DRAFT')
            throw new Error('Only DRAFT sales invoices can be posted');
        const customer = await this.partyRepo.getById(companyId, si.customerId);
        if (!customer)
            throw new Error(`Customer not found: ${si.customerId}`);
        const isSOLinked = !!si.salesOrderId;
        let so = null;
        if (isSOLinked) {
            so = await this.salesOrderRepo.getById(companyId, si.salesOrderId);
            if (!so)
                throw new Error(`Sales order not found: ${si.salesOrderId}`);
            if (so.status === 'CANCELLED') {
                throw new Error('Cannot post invoice for cancelled sales order');
            }
        }
        let postedDNs = [];
        if (so && settings.salesControlMode === 'CONTROLLED' && si.lines.some((line) => line.trackInventory)) {
            postedDNs = await this.deliveryNoteRepo.list(companyId, {
                salesOrderId: so.id,
                status: 'POSTED',
                limit: 500,
            });
        }
        const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || si.currency;
        const revenueCredits = new Map();
        const taxCredits = new Map();
        const cogsBucket = new Map();
        await this.transactionManager.runTransaction(async (transaction) => {
            for (const line of si.lines) {
                const item = await this.itemRepo.getItem(line.itemId);
                if (!item || item.companyId !== companyId) {
                    throw new Error(`Item not found: ${line.itemId}`);
                }
                line.trackInventory = item.trackInventory;
                const soLine = so ? findSOLine(so, line.soLineId, line.itemId) : null;
                if (so && !soLine) {
                    throw new Error(`SO line not found for SI line ${line.lineId}`);
                }
                this.validatePostingQuantity(line, soLine, settings.salesControlMode, settings.overInvoiceTolerancePct, isSOLinked);
                await this.freezeTaxSnapshot(companyId, line, si.exchangeRate);
                line.revenueAccountId = await this.resolveRevenueAccount(companyId, item, settings.defaultRevenueAccountId);
                addToBucket(revenueCredits, line.revenueAccountId, line.lineTotalBase, line.lineTotalDoc);
                if (line.taxAmountBase > 0) {
                    const salesTaxAccountId = await this.resolveSalesTaxAccount(companyId, line.taxCodeId);
                    addToBucket(taxCredits, salesTaxAccountId, line.taxAmountBase, line.taxAmountDoc);
                }
                if (settings.salesControlMode === 'SIMPLE' && line.trackInventory && !hasDNForThisLine(line)) {
                    const warehouseId = line.warehouseId || settings.defaultWarehouseId;
                    if (!warehouseId) {
                        throw new Error(`warehouseId is required for stock item ${line.itemName || item.name}`);
                    }
                    const warehouse = await this.warehouseRepo.getWarehouse(warehouseId);
                    if (!warehouse || warehouse.companyId !== companyId) {
                        throw new Error(`Warehouse not found: ${warehouseId}`);
                    }
                    const qtyInBaseUom = await this.convertToBaseUom(companyId, line.invoicedQty, line.uom, item.baseUom, item.id, item.code);
                    const movement = await this.inventoryService.processOUT({
                        companyId,
                        itemId: line.itemId,
                        warehouseId,
                        qty: qtyInBaseUom,
                        date: si.invoiceDate,
                        movementType: 'SALES_DELIVERY',
                        refs: {
                            type: 'SALES_INVOICE',
                            docId: si.id,
                            lineId: line.lineId,
                        },
                        currentUser: si.createdBy,
                        transaction,
                    });
                    line.stockMovementId = movement.id;
                    line.unitCostBase = (0, SalesPostingHelpers_1.roundMoney)(movement.unitCostBase || 0);
                    line.lineCostBase = (0, SalesPostingHelpers_1.roundMoney)(qtyInBaseUom * line.unitCostBase);
                    const accounts = await this.resolveCOGSAccounts(companyId, item, settings.defaultCOGSAccountId, true);
                    line.cogsAccountId = accounts.cogsAccountId;
                    line.inventoryAccountId = accounts.inventoryAccountId;
                    if (line.lineCostBase > 0) {
                        const key = `${accounts.cogsAccountId}|${accounts.inventoryAccountId}`;
                        const existing = cogsBucket.get(key);
                        if (existing) {
                            existing.amountBase = (0, SalesPostingHelpers_1.roundMoney)(existing.amountBase + line.lineCostBase);
                        }
                        else {
                            cogsBucket.set(key, {
                                cogsAccountId: accounts.cogsAccountId,
                                inventoryAccountId: accounts.inventoryAccountId,
                                amountBase: (0, SalesPostingHelpers_1.roundMoney)(line.lineCostBase),
                            });
                        }
                    }
                }
                if (settings.salesControlMode === 'CONTROLLED' && line.trackInventory) {
                    const unitCostBase = this.resolveControlledUnitCost(line, soLine, postedDNs);
                    line.unitCostBase = (0, SalesPostingHelpers_1.roundMoney)(unitCostBase);
                    line.lineCostBase = (0, SalesPostingHelpers_1.roundMoney)(line.invoicedQty * line.unitCostBase);
                    const accounts = await this.resolveCOGSAccounts(companyId, item, settings.defaultCOGSAccountId, false);
                    if (accounts) {
                        line.cogsAccountId = accounts.cogsAccountId;
                        line.inventoryAccountId = accounts.inventoryAccountId;
                    }
                }
                if (soLine) {
                    soLine.invoicedQty = (0, SalesPostingHelpers_1.roundMoney)(soLine.invoicedQty + line.invoicedQty);
                }
            }
            this.recalcInvoiceTotals(si);
            const arAccountId = this.resolveARAccount(customer, settings.defaultARAccountId);
            const revenueVoucher = await this.createRevenueVoucherInTransaction(transaction, si, baseCurrency, arAccountId, Array.from(revenueCredits.values()), Array.from(taxCredits.values()));
            si.voucherId = revenueVoucher.id;
            if (cogsBucket.size > 0) {
                const cogsVoucher = await this.createCOGSVoucherInTransaction(transaction, si, baseCurrency, Array.from(cogsBucket.values()));
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
        const posted = await this.salesInvoiceRepo.getById(companyId, id);
        if (!posted)
            throw new Error(`Sales invoice not found after posting: ${id}`);
        return posted;
    }
    validatePostingQuantity(line, soLine, mode, overInvoiceTolerancePct, isSOLinked) {
        if (!isSOLinked || !soLine) {
            return;
        }
        if (mode === 'CONTROLLED' && soLine.trackInventory) {
            const ceiling = soLine.deliveredQty - soLine.invoicedQty;
            if (line.invoicedQty > ceiling + 0.000001) {
                throw new Error(`Cannot invoice more than delivered for ${line.itemName}`);
            }
            return;
        }
        if (mode === 'CONTROLLED' && !soLine.trackInventory) {
            const ceiling = soLine.orderedQty - soLine.invoicedQty;
            if (line.invoicedQty > ceiling + 0.000001) {
                throw new Error(`Cannot invoice more than ordered for service ${line.itemName}`);
            }
            return;
        }
        const ceiling = soLine.orderedQty - soLine.invoicedQty;
        const maxAllowed = ceiling * (1 + overInvoiceTolerancePct / 100);
        if (line.invoicedQty > maxAllowed + 0.000001) {
            throw new Error(`Invoice qty exceeds order qty for ${line.itemName}`);
        }
    }
    async freezeTaxSnapshot(companyId, line, exchangeRate) {
        line.lineTotalDoc = (0, SalesPostingHelpers_1.roundMoney)(line.invoicedQty * line.unitPriceDoc);
        line.unitPriceBase = (0, SalesPostingHelpers_1.roundMoney)(line.unitPriceDoc * exchangeRate);
        line.lineTotalBase = (0, SalesPostingHelpers_1.roundMoney)(line.lineTotalDoc * exchangeRate);
        if (!line.taxCodeId) {
            line.taxCode = undefined;
            line.taxRate = 0;
            line.taxAmountDoc = 0;
            line.taxAmountBase = 0;
            return;
        }
        const taxCode = await this.taxCodeRepo.getById(companyId, line.taxCodeId);
        if (!taxCode)
            throw new Error(`Tax code not found: ${line.taxCodeId}`);
        assertValidSalesTaxCode(taxCode, line.taxCodeId);
        line.taxCode = taxCode.code;
        line.taxRate = taxCode.rate;
        line.taxAmountDoc = (0, SalesPostingHelpers_1.roundMoney)(line.lineTotalDoc * line.taxRate);
        line.taxAmountBase = (0, SalesPostingHelpers_1.roundMoney)(line.lineTotalBase * line.taxRate);
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
    resolveARAccount(customer, defaultARAccountId) {
        return customer.defaultARAccountId || defaultARAccountId;
    }
    async resolveSalesTaxAccount(companyId, taxCodeId) {
        if (!taxCodeId) {
            throw new Error('taxCodeId is required for sales tax line');
        }
        const taxCode = await this.taxCodeRepo.getById(companyId, taxCodeId);
        if (!taxCode)
            throw new Error(`Tax code not found: ${taxCodeId}`);
        if (!taxCode.salesTaxAccountId) {
            throw new Error(`Tax code ${taxCode.code} has no sales tax account`);
        }
        return taxCode.salesTaxAccountId;
    }
    resolveControlledUnitCost(line, soLine, postedDNs) {
        if (line.dnLineId) {
            for (const dn of postedDNs) {
                const dnLine = dn.lines.find((entry) => entry.lineId === line.dnLineId);
                if (dnLine && dnLine.unitCostBase > 0) {
                    return dnLine.unitCostBase;
                }
            }
        }
        if (line.soLineId) {
            const matched = postedDNs
                .flatMap((dn) => dn.lines)
                .filter((dnLine) => dnLine.soLineId === line.soLineId && dnLine.unitCostBase > 0);
            if (matched.length > 0) {
                const weightedCost = matched.reduce((sum, dnLine) => sum + (dnLine.unitCostBase * dnLine.deliveredQty), 0);
                const totalQty = matched.reduce((sum, dnLine) => sum + dnLine.deliveredQty, 0);
                if (totalQty > 0) {
                    return weightedCost / totalQty;
                }
            }
        }
        if (soLine) {
            const matchedByItem = postedDNs
                .flatMap((dn) => dn.lines)
                .filter((dnLine) => dnLine.itemId === soLine.itemId && dnLine.unitCostBase > 0);
            if (matchedByItem.length > 0) {
                const weightedCost = matchedByItem.reduce((sum, dnLine) => sum + (dnLine.unitCostBase * dnLine.deliveredQty), 0);
                const totalQty = matchedByItem.reduce((sum, dnLine) => sum + dnLine.deliveredQty, 0);
                if (totalQty > 0) {
                    return weightedCost / totalQty;
                }
            }
        }
        return 0;
    }
    recalcInvoiceTotals(si) {
        si.subtotalDoc = (0, SalesPostingHelpers_1.roundMoney)(si.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
        si.taxTotalDoc = (0, SalesPostingHelpers_1.roundMoney)(si.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
        si.grandTotalDoc = (0, SalesPostingHelpers_1.roundMoney)(si.subtotalDoc + si.taxTotalDoc);
        si.subtotalBase = (0, SalesPostingHelpers_1.roundMoney)(si.lines.reduce((sum, line) => sum + line.lineTotalBase, 0));
        si.taxTotalBase = (0, SalesPostingHelpers_1.roundMoney)(si.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
        si.grandTotalBase = (0, SalesPostingHelpers_1.roundMoney)(si.subtotalBase + si.taxTotalBase);
    }
    async createRevenueVoucherInTransaction(transaction, si, baseCurrency, arAccountId, revenueCredits, taxCredits) {
        const voucherLines = [];
        const isForeignCurrency = si.currency.toUpperCase() !== baseCurrency.toUpperCase();
        let seq = 1;
        voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(seq++, arAccountId, 'Debit', (0, SalesPostingHelpers_1.roundMoney)(si.grandTotalBase), baseCurrency, isForeignCurrency ? (0, SalesPostingHelpers_1.roundMoney)(si.grandTotalDoc) : (0, SalesPostingHelpers_1.roundMoney)(si.grandTotalBase), si.currency, isForeignCurrency ? si.exchangeRate : 1, `AR - ${si.customerName} - ${si.invoiceNumber}`, undefined, {
            sourceModule: 'sales',
            sourceType: 'SALES_INVOICE',
            sourceId: si.id,
            customerId: si.customerId,
        }));
        for (const line of revenueCredits) {
            voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(seq++, line.accountId, 'Credit', (0, SalesPostingHelpers_1.roundMoney)(line.baseAmount), baseCurrency, isForeignCurrency ? (0, SalesPostingHelpers_1.roundMoney)(line.docAmount) : (0, SalesPostingHelpers_1.roundMoney)(line.baseAmount), si.currency, isForeignCurrency ? si.exchangeRate : 1, `Revenue - ${si.invoiceNumber}`, undefined, {
                sourceModule: 'sales',
                sourceType: 'SALES_INVOICE',
                sourceId: si.id,
            }));
        }
        for (const line of taxCredits) {
            voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(seq++, line.accountId, 'Credit', (0, SalesPostingHelpers_1.roundMoney)(line.baseAmount), baseCurrency, isForeignCurrency ? (0, SalesPostingHelpers_1.roundMoney)(line.docAmount) : (0, SalesPostingHelpers_1.roundMoney)(line.baseAmount), si.currency, isForeignCurrency ? si.exchangeRate : 1, `Sales tax - ${si.invoiceNumber}`, undefined, {
                sourceModule: 'sales',
                sourceType: 'SALES_INVOICE',
                sourceId: si.id,
            }));
        }
        const totalDebit = (0, SalesPostingHelpers_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
        const totalCredit = (0, SalesPostingHelpers_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));
        const now = new Date();
        const voucher = new VoucherEntity_1.VoucherEntity((0, crypto_1.randomUUID)(), si.companyId, `SI-${si.invoiceNumber}`, VoucherTypes_1.VoucherType.JOURNAL_ENTRY, si.invoiceDate, `Sales Invoice ${si.invoiceNumber} - ${si.customerName}`, si.currency, baseCurrency, isForeignCurrency ? si.exchangeRate : 1, voucherLines, totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, {
            sourceModule: 'sales',
            sourceType: 'SALES_INVOICE',
            sourceId: si.id,
            referenceType: 'SALES_INVOICE',
            referenceId: si.id,
        }, si.createdBy, now, si.createdBy, now);
        const postedVoucher = voucher.post(si.createdBy, now, VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED);
        await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
        await this.voucherRepo.save(postedVoucher, transaction);
        return postedVoucher;
    }
    async createCOGSVoucherInTransaction(transaction, si, baseCurrency, lines) {
        const voucherLines = [];
        let seq = 1;
        for (const line of lines) {
            const amount = (0, SalesPostingHelpers_1.roundMoney)(line.amountBase);
            voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(seq++, line.cogsAccountId, 'Debit', amount, baseCurrency, amount, baseCurrency, 1, `COGS - ${si.invoiceNumber}`, undefined, {
                sourceModule: 'sales',
                sourceType: 'SALES_INVOICE',
                sourceId: si.id,
            }));
            voucherLines.push(new VoucherLineEntity_1.VoucherLineEntity(seq++, line.inventoryAccountId, 'Credit', amount, baseCurrency, amount, baseCurrency, 1, `Inventory reduction - ${si.invoiceNumber}`, undefined, {
                sourceModule: 'sales',
                sourceType: 'SALES_INVOICE',
                sourceId: si.id,
            }));
        }
        const totalDebit = (0, SalesPostingHelpers_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
        const totalCredit = (0, SalesPostingHelpers_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));
        const now = new Date();
        const voucher = new VoucherEntity_1.VoucherEntity((0, crypto_1.randomUUID)(), si.companyId, `SI-COGS-${si.invoiceNumber}`, VoucherTypes_1.VoucherType.JOURNAL_ENTRY, si.invoiceDate, `Sales Invoice ${si.invoiceNumber} COGS`, baseCurrency, baseCurrency, 1, voucherLines, totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, {
            sourceModule: 'sales',
            sourceType: 'SALES_INVOICE',
            sourceId: si.id,
            referenceType: 'SALES_INVOICE',
            referenceId: si.id,
        }, si.createdBy, now, si.createdBy, now);
        const postedVoucher = voucher.post(si.createdBy, now, VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED);
        await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
        await this.voucherRepo.save(postedVoucher, transaction);
        return postedVoucher;
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