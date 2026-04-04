"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListPurchaseInvoicesUseCase = exports.GetPurchaseInvoiceUseCase = exports.UpdatePurchaseInvoiceUseCase = exports.PostPurchaseInvoiceUseCase = exports.CreatePurchaseInvoiceUseCase = void 0;
const crypto_1 = require("crypto");
const VoucherEntity_1 = require("../../../domain/accounting/entities/VoucherEntity");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
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
        const sourceLines = this.resolveSourceLines(input.lines, po, settings.procurementControlMode);
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
    resolveSourceLines(lines, po, mode) {
        if (Array.isArray(lines) && lines.length > 0) {
            return lines;
        }
        if (!po)
            return [];
        return po.lines
            .map((line) => {
            let ceiling = 0;
            if (mode === 'CONTROLLED' && line.trackInventory) {
                ceiling = line.receivedQty - line.invoicedQty;
            }
            else if (mode === 'CONTROLLED' && !line.trackInventory) {
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
    constructor(settingsRepo, purchaseInvoiceRepo, purchaseOrderRepo, partyRepo, taxCodeRepo, itemRepo, itemCategoryRepo, warehouseRepo, uomConversionRepo, companyCurrencyRepo, exchangeRateRepo, inventoryService, voucherRepo, ledgerRepo, transactionManager) {
        this.settingsRepo = settingsRepo;
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
        this.voucherRepo = voucherRepo;
        this.ledgerRepo = ledgerRepo;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id) {
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings)
            throw new Error('Purchases module is not initialized');
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
            if (!po)
                throw new Error(`Purchase order not found: ${pi.purchaseOrderId}`);
            if (po.status === 'CANCELLED')
                throw new Error('Cannot post invoice for cancelled purchase order');
        }
        const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || pi.currency;
        const voucherLines = [];
        const apAccountId = this.resolveAPAccount(vendor, settings.defaultAPAccountId);
        await this.transactionManager.runTransaction(async (transaction) => {
            for (const line of pi.lines) {
                const item = await this.itemRepo.getItem(line.itemId);
                if (!item || item.companyId !== companyId) {
                    throw new Error(`Item not found: ${line.itemId}`);
                }
                line.trackInventory = item.trackInventory;
                const poLine = po ? findPOLine(po, line.poLineId, line.itemId) : null;
                if (isPOLinked && !poLine) {
                    throw new Error(`PO line not found for invoice line ${line.lineId}`);
                }
                this.validatePostingQuantity(line, poLine, settings.procurementControlMode, settings.overInvoiceTolerancePct, isPOLinked);
                // Step 2: Freeze tax snapshot at posting time.
                await this.freezeTaxSnapshot(companyId, line, pi.exchangeRate);
                // Step 3: Resolve accounts with hierarchy.
                line.accountId = await this.resolveDebitAccount(companyId, item, settings.defaultPurchaseExpenseAccountId);
                // Step 4: Inventory movement for SIMPLE stock lines without GRN.
                if (settings.procurementControlMode === 'SIMPLE' && item.trackInventory && !hasGRNForThisLine(line)) {
                    const warehouseId = line.warehouseId || settings.defaultWarehouseId;
                    if (!warehouseId) {
                        throw new Error(`Warehouse required for stock item ${line.itemName || item.name}`);
                    }
                    const warehouse = await this.warehouseRepo.getWarehouse(warehouseId);
                    if (!warehouse || warehouse.companyId !== companyId) {
                        throw new Error(`Warehouse not found: ${warehouseId}`);
                    }
                    const qtyInBaseUom = await this.convertToBaseUom(companyId, line.invoicedQty, line.uom, item.baseUom, item.id, item.code);
                    const fxRateCCYToBase = await this.resolveCCYToBaseRate(companyId, item.costCurrency, baseCurrency, pi.currency, pi.exchangeRate, pi.invoiceDate);
                    const movement = await this.inventoryService.processIN({
                        companyId,
                        itemId: line.itemId,
                        warehouseId,
                        qty: qtyInBaseUom,
                        date: pi.invoiceDate,
                        movementType: 'PURCHASE_RECEIPT',
                        refs: {
                            type: 'PURCHASE_INVOICE',
                            docId: pi.id,
                            lineId: line.lineId,
                        },
                        currentUser: pi.createdBy,
                        unitCostInMoveCurrency: line.unitPriceDoc,
                        moveCurrency: pi.currency,
                        fxRateMovToBase: pi.exchangeRate,
                        fxRateCCYToBase,
                        transaction,
                    });
                    line.stockMovementId = movement.id;
                    line.warehouseId = warehouseId;
                }
                if (settings.procurementControlMode === 'CONTROLLED' && !isPOLinked && item.trackInventory) {
                    throw new Error(`CONTROLLED mode stock invoices require PO/GRN: ${line.itemName || item.name}`);
                }
                // Step 5: Debit line amount and tax.
                voucherLines.push({
                    accountId: line.accountId,
                    side: 'Debit',
                    baseAmount: line.lineTotalBase,
                    docAmount: line.lineTotalDoc,
                    notes: `${line.itemName} x ${line.invoicedQty}`,
                    metadata: {
                        sourceModule: 'purchases',
                        sourceType: 'PURCHASE_INVOICE',
                        sourceId: pi.id,
                        lineId: line.lineId,
                        itemId: line.itemId,
                    },
                });
                if (line.taxAmountBase > 0) {
                    const taxAccountId = await this.resolvePurchaseTaxAccount(companyId, line.taxCodeId);
                    voucherLines.push({
                        accountId: taxAccountId,
                        side: 'Debit',
                        baseAmount: line.taxAmountBase,
                        docAmount: line.taxAmountDoc,
                        notes: `Tax: ${line.taxCode || line.taxCodeId || ''} on ${line.itemName}`,
                        metadata: {
                            sourceModule: 'purchases',
                            sourceType: 'PURCHASE_INVOICE',
                            sourceId: pi.id,
                            lineId: line.lineId,
                            taxCodeId: line.taxCodeId,
                        },
                    });
                }
                if (poLine) {
                    poLine.invoicedQty = (0, PurchasePostingHelpers_1.roundMoney)(poLine.invoicedQty + line.invoicedQty);
                }
            }
            // Step 8 (part 1): freeze totals.
            pi.subtotalBase = (0, PurchasePostingHelpers_1.roundMoney)(pi.lines.reduce((sum, line) => sum + line.lineTotalBase, 0));
            pi.taxTotalBase = (0, PurchasePostingHelpers_1.roundMoney)(pi.lines.reduce((sum, line) => sum + line.taxAmountBase, 0));
            pi.grandTotalBase = (0, PurchasePostingHelpers_1.roundMoney)(pi.subtotalBase + pi.taxTotalBase);
            pi.subtotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(pi.lines.reduce((sum, line) => sum + line.lineTotalDoc, 0));
            pi.taxTotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(pi.lines.reduce((sum, line) => sum + line.taxAmountDoc, 0));
            pi.grandTotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(pi.subtotalDoc + pi.taxTotalDoc);
            // Step 6: Credit AP total.
            voucherLines.push({
                accountId: apAccountId,
                side: 'Credit',
                baseAmount: pi.grandTotalBase,
                docAmount: pi.grandTotalDoc,
                notes: `AP - ${pi.vendorName} - ${pi.invoiceNumber}`,
                metadata: {
                    sourceModule: 'purchases',
                    sourceType: 'PURCHASE_INVOICE',
                    sourceId: pi.id,
                    vendorId: pi.vendorId,
                },
            });
            // Step 7: Create voucher.
            const voucher = await this.createAccountingVoucherInTransaction(transaction, pi, baseCurrency, voucherLines);
            // Step 8 (part 2): finalize.
            pi.voucherId = voucher.id;
            pi.paidAmountBase = 0;
            pi.outstandingAmountBase = pi.grandTotalBase;
            pi.paymentStatus = 'UNPAID';
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
        const posted = await this.purchaseInvoiceRepo.getById(companyId, id);
        if (!posted)
            throw new Error(`Purchase invoice not found after posting: ${id}`);
        return posted;
    }
    validatePostingQuantity(line, poLine, mode, overInvoiceTolerancePct, isPOLinked) {
        if (!isPOLinked || !poLine) {
            return;
        }
        if (mode === 'CONTROLLED' && line.trackInventory) {
            const openInvoiceQty = poLine.receivedQty - poLine.invoicedQty;
            if (line.invoicedQty > openInvoiceQty + 0.000001) {
                throw new Error(`Invoiced qty exceeds received qty for item ${line.itemName}`);
            }
            return;
        }
        if (mode === 'CONTROLLED' && !line.trackInventory) {
            const openInvoiceQty = poLine.orderedQty - poLine.invoicedQty;
            if (line.invoicedQty > openInvoiceQty + 0.000001) {
                throw new Error(`Invoiced qty exceeds ordered qty for service ${line.itemName}`);
            }
            return;
        }
        const maxQty = poLine.orderedQty * (1 + overInvoiceTolerancePct / 100);
        const remaining = maxQty - poLine.invoicedQty;
        if (line.invoicedQty > remaining + 0.000001) {
            throw new Error(`Invoiced qty exceeds ordered qty for item ${line.itemName}`);
        }
    }
    async freezeTaxSnapshot(companyId, line, exchangeRate) {
        line.lineTotalDoc = (0, PurchasePostingHelpers_1.roundMoney)(line.invoicedQty * line.unitPriceDoc);
        line.unitPriceBase = (0, PurchasePostingHelpers_1.roundMoney)(line.unitPriceDoc * exchangeRate);
        line.lineTotalBase = (0, PurchasePostingHelpers_1.roundMoney)(line.lineTotalDoc * exchangeRate);
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
        assertValidPurchaseTaxCode(taxCode, line.taxCodeId);
        line.taxCode = taxCode.code;
        line.taxRate = taxCode.rate;
        line.taxAmountDoc = (0, PurchasePostingHelpers_1.roundMoney)(line.lineTotalDoc * line.taxRate);
        line.taxAmountBase = (0, PurchasePostingHelpers_1.roundMoney)(line.lineTotalBase * line.taxRate);
    }
    async resolveDebitAccount(companyId, item, defaultExpenseAccountId) {
        if (item.trackInventory) {
            if (item.inventoryAssetAccountId)
                return item.inventoryAssetAccountId;
            if (item.categoryId) {
                const category = await this.itemCategoryRepo.getCategory(item.categoryId);
                if (category && category.companyId === companyId && category.defaultInventoryAssetAccountId) {
                    return category.defaultInventoryAssetAccountId;
                }
            }
            if (!defaultExpenseAccountId) {
                throw new Error(`No inventory/expense account resolved for item ${item.code}`);
            }
            return defaultExpenseAccountId;
        }
        if (item.cogsAccountId)
            return item.cogsAccountId;
        if (item.categoryId) {
            const category = await this.itemCategoryRepo.getCategory(item.categoryId);
            if (category && category.companyId === companyId && category.defaultCogsAccountId) {
                return category.defaultCogsAccountId;
            }
        }
        if (!defaultExpenseAccountId) {
            throw new Error(`No expense account resolved for item ${item.code}`);
        }
        return defaultExpenseAccountId;
    }
    resolveAPAccount(vendor, defaultAPAccountId) {
        return vendor.defaultAPAccountId || defaultAPAccountId;
    }
    async resolvePurchaseTaxAccount(companyId, taxCodeId) {
        if (!taxCodeId) {
            throw new Error('taxCodeId is required for tax line');
        }
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
        const direct = conversions.find((conversion) => conversion.active &&
            conversion.fromUom.toUpperCase() === normalizedFrom &&
            conversion.toUom.toUpperCase() === normalizedTo);
        if (direct)
            return (0, PurchasePostingHelpers_1.roundMoney)(qty * direct.factor);
        const reverse = conversions.find((conversion) => conversion.active &&
            conversion.fromUom.toUpperCase() === normalizedTo &&
            conversion.toUom.toUpperCase() === normalizedFrom);
        if (reverse)
            return (0, PurchasePostingHelpers_1.roundMoney)(qty / reverse.factor);
        throw new Error(`No UOM conversion from ${uom} to ${baseUom} for item ${itemCode}`);
    }
    async resolveCCYToBaseRate(companyId, costCurrency, baseCurrency, moveCurrency, fxRateMovToBase, invoiceDate) {
        if (costCurrency.toUpperCase() === baseCurrency.toUpperCase()) {
            return 1;
        }
        if (costCurrency.toUpperCase() === moveCurrency.toUpperCase()) {
            return fxRateMovToBase;
        }
        const rate = await this.exchangeRateRepo.getMostRecentRateBeforeDate(companyId, costCurrency, baseCurrency, new Date(invoiceDate));
        if (rate)
            return rate.rate;
        return fxRateMovToBase;
    }
    async createAccountingVoucherInTransaction(transaction, pi, baseCurrency, lines) {
        const isForeignCurrency = pi.currency.toUpperCase() !== baseCurrency.toUpperCase();
        const voucherLines = lines.map((line, index) => {
            const baseAmount = (0, PurchasePostingHelpers_1.roundMoney)(line.baseAmount);
            const amount = isForeignCurrency ? (0, PurchasePostingHelpers_1.roundMoney)(line.docAmount) : baseAmount;
            const rate = isForeignCurrency ? pi.exchangeRate : 1;
            return new VoucherLineEntity_1.VoucherLineEntity(index + 1, line.accountId, line.side, baseAmount, baseCurrency, amount, pi.currency, rate, line.notes, undefined, line.metadata || {});
        });
        const totalDebit = (0, PurchasePostingHelpers_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.debitAmount, 0));
        const totalCredit = (0, PurchasePostingHelpers_1.roundMoney)(voucherLines.reduce((sum, line) => sum + line.creditAmount, 0));
        const now = new Date();
        const voucher = new VoucherEntity_1.VoucherEntity((0, crypto_1.randomUUID)(), pi.companyId, `PI-${pi.invoiceNumber}`, VoucherTypes_1.VoucherType.JOURNAL_ENTRY, pi.invoiceDate, `Purchase Invoice ${pi.invoiceNumber} - ${pi.vendorName}`, pi.currency, baseCurrency, isForeignCurrency ? pi.exchangeRate : 1, voucherLines, totalDebit, totalCredit, VoucherTypes_1.VoucherStatus.APPROVED, {
            sourceModule: 'purchases',
            sourceType: 'PURCHASE_INVOICE',
            sourceId: pi.id,
            referenceType: 'PURCHASE_INVOICE',
            referenceId: pi.id,
        }, pi.createdBy, now, pi.createdBy, now);
        const postedVoucher = voucher.post(pi.createdBy, now, VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED);
        await this.ledgerRepo.recordForVoucher(postedVoucher, transaction);
        await this.voucherRepo.save(postedVoucher, transaction);
        return postedVoucher;
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
//# sourceMappingURL=PurchaseInvoiceUseCases.js.map