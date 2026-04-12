"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListDeliveryNotesUseCase = exports.GetDeliveryNoteUseCase = exports.PostDeliveryNoteUseCase = exports.CreateDeliveryNoteUseCase = void 0;
const crypto_1 = require("crypto");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const DeliveryNote_1 = require("../../../domain/sales/entities/DeliveryNote");
const SalesOrderUseCases_1 = require("./SalesOrderUseCases");
const SalesPostingHelpers_1 = require("./SalesPostingHelpers");
const findSOLine = (so, soLineId, itemId) => {
    if (soLineId) {
        return so.lines.find((line) => line.lineId === soLineId) || null;
    }
    if (itemId) {
        return so.lines.find((line) => line.itemId === itemId) || null;
    }
    return null;
};
class CreateDeliveryNoteUseCase {
    constructor(settingsRepo, deliveryNoteRepo, salesOrderRepo, partyRepo, itemRepo) {
        this.settingsRepo = settingsRepo;
        this.deliveryNoteRepo = deliveryNoteRepo;
        this.salesOrderRepo = salesOrderRepo;
        this.partyRepo = partyRepo;
        this.itemRepo = itemRepo;
    }
    async execute(input) {
        var _a, _b;
        const settings = await this.settingsRepo.getSettings(input.companyId);
        if (!settings) {
            throw new Error('Sales module is not initialized');
        }
        if (settings.requireSOForStockItems && !input.salesOrderId) {
            throw new Error('A Sales Order reference is required to create a delivery note.');
        }
        let so = null;
        if (input.salesOrderId) {
            so = await this.salesOrderRepo.getById(input.companyId, input.salesOrderId);
            if (!so)
                throw new Error(`Sales order not found: ${input.salesOrderId}`);
            if (!['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(so.status)) {
                throw new Error(`Sales order must be CONFIRMED or PARTIALLY_DELIVERED. Current: ${so.status}`);
            }
        }
        let customerId = input.customerId || '';
        let customerName = '';
        if (so) {
            customerId = so.customerId;
            customerName = so.customerName;
        }
        else {
            if (!customerId)
                throw new Error('customerId is required for standalone delivery note');
            const customer = await this.partyRepo.getById(input.companyId, customerId);
            if (!customer)
                throw new Error(`Customer not found: ${customerId}`);
            if (!customer.roles.includes('CUSTOMER'))
                throw new Error(`Party is not a customer: ${customerId}`);
            customerName = customer.displayName;
        }
        const sourceLines = this.resolveSourceLines(input.lines, so);
        const lines = [];
        for (let i = 0; i < sourceLines.length; i += 1) {
            const line = sourceLines[i];
            const soLine = so ? findSOLine(so, line.soLineId, line.itemId) : null;
            const itemId = line.itemId || (soLine === null || soLine === void 0 ? void 0 : soLine.itemId);
            if (!itemId) {
                throw new Error(`Line ${i + 1}: itemId is required`);
            }
            const item = await this.itemRepo.getItem(itemId);
            if (!item || item.companyId !== input.companyId) {
                throw new Error(`Item not found: ${itemId}`);
            }
            const deliveredQty = (_a = line.deliveredQty) !== null && _a !== void 0 ? _a : (soLine ? Math.max(soLine.orderedQty - soLine.deliveredQty, 0) : 0);
            lines.push({
                lineId: line.lineId || (0, crypto_1.randomUUID)(),
                lineNo: (_b = line.lineNo) !== null && _b !== void 0 ? _b : i + 1,
                soLineId: line.soLineId || (soLine === null || soLine === void 0 ? void 0 : soLine.lineId),
                itemId: item.id,
                itemCode: item.code,
                itemName: item.name,
                deliveredQty,
                uom: line.uom || (soLine === null || soLine === void 0 ? void 0 : soLine.uom) || item.salesUom || item.baseUom,
                unitCostBase: 0,
                lineCostBase: 0,
                moveCurrency: (so === null || so === void 0 ? void 0 : so.currency) || 'USD',
                fxRateMovToBase: (so === null || so === void 0 ? void 0 : so.exchangeRate) || 1,
                fxRateCCYToBase: (so === null || so === void 0 ? void 0 : so.exchangeRate) || 1,
                stockMovementId: null,
                description: line.description,
            });
        }
        const now = new Date();
        const dnNumber = await (0, SalesOrderUseCases_1.generateUniqueDocumentNumber)(settings, 'DN', async (candidate) => !!(await this.deliveryNoteRepo.getByNumber(input.companyId, candidate)));
        const dn = new DeliveryNote_1.DeliveryNote({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            dnNumber,
            salesOrderId: so === null || so === void 0 ? void 0 : so.id,
            customerId,
            customerName,
            deliveryDate: input.deliveryDate,
            warehouseId: input.warehouseId,
            lines,
            status: 'DRAFT',
            notes: input.notes,
            cogsVoucherId: null,
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
        });
        await this.deliveryNoteRepo.create(dn);
        await this.settingsRepo.saveSettings(settings);
        return dn;
    }
    resolveSourceLines(lines, so) {
        if (Array.isArray(lines) && lines.length > 0) {
            return lines;
        }
        if (!so) {
            throw new Error('At least one line is required');
        }
        return so.lines
            .filter((line) => line.trackInventory && line.orderedQty - line.deliveredQty > 0)
            .map((line) => ({
            soLineId: line.lineId,
            itemId: line.itemId,
            deliveredQty: (0, SalesPostingHelpers_1.roundMoney)(line.orderedQty - line.deliveredQty),
            uom: line.uom,
            description: line.description,
        }));
    }
}
exports.CreateDeliveryNoteUseCase = CreateDeliveryNoteUseCase;
class PostDeliveryNoteUseCase {
    constructor(settingsRepo, deliveryNoteRepo, salesOrderRepo, itemRepo, itemCategoryRepo, warehouseRepo, uomConversionRepo, companyCurrencyRepo, inventoryService, accountingPostingService, transactionManager) {
        this.settingsRepo = settingsRepo;
        this.deliveryNoteRepo = deliveryNoteRepo;
        this.salesOrderRepo = salesOrderRepo;
        this.itemRepo = itemRepo;
        this.itemCategoryRepo = itemCategoryRepo;
        this.warehouseRepo = warehouseRepo;
        this.uomConversionRepo = uomConversionRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
        this.inventoryService = inventoryService;
        this.accountingPostingService = accountingPostingService;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id) {
        var _a;
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings)
            throw new Error('Sales module is not initialized');
        const dn = await this.deliveryNoteRepo.getById(companyId, id);
        if (!dn)
            throw new Error(`Delivery note not found: ${id}`);
        if (dn.status !== 'DRAFT')
            throw new Error('Only DRAFT delivery notes can be posted');
        const warehouse = await this.warehouseRepo.getWarehouse(dn.warehouseId);
        if (!warehouse || warehouse.companyId !== companyId) {
            throw new Error(`Warehouse not found: ${dn.warehouseId}`);
        }
        let so = null;
        if (dn.salesOrderId) {
            so = await this.salesOrderRepo.getById(companyId, dn.salesOrderId);
            if (!so)
                throw new Error(`Sales order not found: ${dn.salesOrderId}`);
            if (!['CONFIRMED', 'PARTIALLY_DELIVERED'].includes(so.status)) {
                throw new Error(`Sales order must be CONFIRMED or PARTIALLY_DELIVERED. Current: ${so.status}`);
            }
        }
        const baseCurrency = (await this.companyCurrencyRepo.getBaseCurrency(companyId)) || ((_a = dn.lines[0]) === null || _a === void 0 ? void 0 : _a.moveCurrency) || 'USD';
        const cogsBucket = new Map();
        await this.transactionManager.runTransaction(async (transaction) => {
            for (const line of dn.lines) {
                const item = await this.itemRepo.getItem(line.itemId);
                if (!item || item.companyId !== companyId) {
                    throw new Error(`Item not found: ${line.itemId}`);
                }
                if (!item.trackInventory) {
                    throw new Error(`Delivery note line item must track inventory: ${item.code}`);
                }
                const soLine = so ? findSOLine(so, line.soLineId, line.itemId) : null;
                if (so && !soLine) {
                    throw new Error(`SO line not found for DN line ${line.lineId}`);
                }
                if (soLine) {
                    const openQty = soLine.orderedQty - soLine.deliveredQty;
                    if (!settings.allowOverDelivery) {
                        if (line.deliveredQty > openQty + 0.000001) {
                            throw new Error(`Delivered qty exceeds open qty for item ${line.itemName || soLine.itemName}`);
                        }
                    }
                    else {
                        const maxQty = openQty * (1 + settings.overDeliveryTolerancePct / 100);
                        if (line.deliveredQty > maxQty + 0.000001) {
                            throw new Error(`Delivered qty exceeds tolerance for item ${line.itemName || soLine.itemName}`);
                        }
                    }
                }
                const qtyInBaseUom = await this.convertToBaseUom(companyId, line.deliveredQty, line.uom, item.baseUom, item.id, item.code);
                const movement = await this.inventoryService.processOUT({
                    companyId,
                    itemId: line.itemId,
                    warehouseId: dn.warehouseId,
                    qty: qtyInBaseUom,
                    date: dn.deliveryDate,
                    movementType: 'SALES_DELIVERY',
                    refs: {
                        type: 'DELIVERY_NOTE',
                        docId: dn.id,
                        lineId: line.lineId,
                    },
                    currentUser: dn.createdBy,
                    transaction,
                });
                line.stockMovementId = movement.id;
                line.unitCostBase = (0, SalesPostingHelpers_1.roundMoney)(movement.unitCostBase || 0);
                line.lineCostBase = (0, SalesPostingHelpers_1.roundMoney)(qtyInBaseUom * line.unitCostBase);
                this.assertPositiveTrackedCost(qtyInBaseUom, line.unitCostBase, line.itemName || item.name, `delivery note ${dn.dnNumber}`);
                line.moveCurrency = movement.movementCurrency;
                line.fxRateMovToBase = movement.fxRateMovToBase;
                line.fxRateCCYToBase = movement.fxRateCCYToBase;
                const accounts = await this.resolveCOGSAccounts(companyId, item.id, settings.defaultCOGSAccountId, settings.defaultInventoryAccountId);
                if (accounts.cogsAccountId && accounts.inventoryAccountId && line.lineCostBase > 0) {
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
                if (soLine) {
                    soLine.deliveredQty = (0, SalesPostingHelpers_1.roundMoney)(soLine.deliveredQty + line.deliveredQty);
                }
            }
            if (cogsBucket.size > 0) {
                const cogsVoucherLines = [];
                for (const line of Array.from(cogsBucket.values())) {
                    const amount = (0, SalesPostingHelpers_1.roundMoney)(line.amountBase);
                    cogsVoucherLines.push({
                        accountId: line.cogsAccountId,
                        side: 'Debit',
                        amount,
                        baseAmount: amount,
                        docAmount: amount,
                    });
                    cogsVoucherLines.push({
                        accountId: line.inventoryAccountId,
                        side: 'Credit',
                        amount,
                        baseAmount: amount,
                        docAmount: amount,
                    });
                }
                const voucher = await this.accountingPostingService.postInTransaction({
                    companyId,
                    voucherType: VoucherTypes_1.VoucherType.JOURNAL_ENTRY,
                    voucherNo: `DN-${dn.dnNumber}`,
                    date: dn.deliveryDate,
                    description: `Delivery Note ${dn.dnNumber} COGS`,
                    currency: baseCurrency,
                    exchangeRate: 1,
                    lines: cogsVoucherLines,
                    metadata: {
                        sourceModule: 'sales',
                        sourceType: 'DELIVERY_NOTE',
                        sourceId: dn.id,
                        referenceType: 'DELIVERY_NOTE',
                        referenceId: dn.id,
                    },
                    createdBy: dn.createdBy,
                    postingLockPolicy: VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED,
                    reference: dn.dnNumber,
                }, transaction);
                dn.cogsVoucherId = voucher.id;
            }
            if (so) {
                so.status = (0, SalesPostingHelpers_1.updateSOStatus)(so);
                so.updatedAt = new Date();
                await this.salesOrderRepo.update(so, transaction);
            }
            dn.status = 'POSTED';
            dn.postedAt = new Date();
            dn.updatedAt = new Date();
            await this.deliveryNoteRepo.update(dn, transaction);
        });
        const posted = await this.deliveryNoteRepo.getById(companyId, id);
        if (!posted)
            throw new Error(`Delivery note not found after posting: ${id}`);
        return posted;
    }
    async resolveCOGSAccounts(companyId, itemId, defaultCOGSAccountId, defaultInventoryAccountId) {
        const item = await this.itemRepo.getItem(itemId);
        if (!item)
            throw new Error(`Item not found while resolving COGS accounts: ${itemId}`);
        let category = null;
        if (item.categoryId) {
            category = await this.itemCategoryRepo.getCategory(item.categoryId);
            if ((category === null || category === void 0 ? void 0 : category.companyId) !== companyId) {
                category = null;
            }
        }
        const cogsAccountId = item.cogsAccountId
            || (category === null || category === void 0 ? void 0 : category.defaultCogsAccountId)
            || defaultCOGSAccountId;
        const inventoryAccountId = item.inventoryAssetAccountId
            || (category === null || category === void 0 ? void 0 : category.defaultInventoryAssetAccountId)
            || defaultInventoryAccountId;
        if (!cogsAccountId) {
            throw new Error(`No COGS account configured for item ${item.code}`);
        }
        if (!inventoryAccountId) {
            throw new Error(`No inventory account configured for item ${item.code}`);
        }
        return { cogsAccountId, inventoryAccountId };
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
            return (0, SalesPostingHelpers_1.roundMoney)(qty * direct.factor);
        const reverse = conversions.find((conversion) => conversion.active &&
            conversion.fromUom.toUpperCase() === normalizedTo &&
            conversion.toUom.toUpperCase() === normalizedFrom);
        if (reverse)
            return (0, SalesPostingHelpers_1.roundMoney)(qty / reverse.factor);
        throw new Error(`No UOM conversion from ${uom} to ${baseUom} for item ${itemCode}`);
    }
    assertPositiveTrackedCost(qty, unitCostBase, itemName, documentLabel) {
        if (qty > 0 && !(unitCostBase > 0)) {
            throw new Error(`Missing positive inventory cost for ${itemName} on ${documentLabel}`);
        }
    }
}
exports.PostDeliveryNoteUseCase = PostDeliveryNoteUseCase;
class GetDeliveryNoteUseCase {
    constructor(deliveryNoteRepo) {
        this.deliveryNoteRepo = deliveryNoteRepo;
    }
    async execute(companyId, id) {
        const dn = await this.deliveryNoteRepo.getById(companyId, id);
        if (!dn)
            throw new Error(`Delivery note not found: ${id}`);
        return dn;
    }
}
exports.GetDeliveryNoteUseCase = GetDeliveryNoteUseCase;
class ListDeliveryNotesUseCase {
    constructor(deliveryNoteRepo) {
        this.deliveryNoteRepo = deliveryNoteRepo;
    }
    async execute(companyId, filters = {}) {
        return this.deliveryNoteRepo.list(companyId, {
            salesOrderId: filters.salesOrderId,
            status: filters.status,
            limit: filters.limit,
        });
    }
}
exports.ListDeliveryNotesUseCase = ListDeliveryNotesUseCase;
//# sourceMappingURL=DeliveryNoteUseCases.js.map