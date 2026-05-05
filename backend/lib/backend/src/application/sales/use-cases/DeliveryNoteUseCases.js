"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListDeliveryNotesUseCase = exports.GetDeliveryNoteUseCase = exports.PostDeliveryNoteUseCase = exports.CreateDeliveryNoteUseCase = void 0;
const crypto_1 = require("crypto");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const DocumentPolicyResolver_1 = require("../../common/services/DocumentPolicyResolver");
const DeliveryNote_1 = require("../../../domain/sales/entities/DeliveryNote");
const StockLevel_1 = require("../../../domain/inventory/entities/StockLevel");
const StockMovement_1 = require("../../../domain/inventory/entities/StockMovement");
const UomResolutionService_1 = require("../../inventory/services/UomResolutionService");
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
                uomId: line.uomId || (soLine === null || soLine === void 0 ? void 0 : soLine.uomId) || item.salesUomId || item.baseUomId,
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
            uomId: line.uomId,
            uom: line.uom,
            description: line.description,
        }));
    }
}
exports.CreateDeliveryNoteUseCase = CreateDeliveryNoteUseCase;
class PostDeliveryNoteUseCase {
    constructor(settingsRepo, inventorySettingsRepo, deliveryNoteRepo, salesOrderRepo, itemRepo, itemCategoryRepo, warehouseRepo, uomConversionRepo, companyCurrencyRepo, inventoryService, companyModuleRepo, accountingPostingService, accountRepo, transactionManager) {
        this.settingsRepo = settingsRepo;
        this.inventorySettingsRepo = inventorySettingsRepo;
        this.deliveryNoteRepo = deliveryNoteRepo;
        this.salesOrderRepo = salesOrderRepo;
        this.itemRepo = itemRepo;
        this.itemCategoryRepo = itemCategoryRepo;
        this.warehouseRepo = warehouseRepo;
        this.uomConversionRepo = uomConversionRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
        this.inventoryService = inventoryService;
        this.companyModuleRepo = companyModuleRepo;
        this.accountingPostingService = accountingPostingService;
        this.accountRepo = accountRepo;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, id, createAccountingEffect = true) {
        // ===================================================================
        // FIRESTORE TRANSACTION RULE: All reads must complete before any writes.
        // We pre-fetch ALL data here. The postingLogic callback only writes.
        // ===================================================================
        var _a, _b, _c, _d;
        const settings = await this.settingsRepo.getSettings(companyId);
        if (!settings)
            throw new Error('Sales module is not initialized');
        const invSettings = await this.inventorySettingsRepo.getSettings(companyId);
        const accountingMode = DocumentPolicyResolver_1.DocumentPolicyResolver.resolveAccountingMode(invSettings);
        const shouldPostAccounting = createAccountingEffect && await this.isAccountingEnabled(companyId);
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
        // PHASE 1A: PRE-FETCH ALL MASTER DATA (bare reads before transaction)
        const distinctItemIds = [...new Set(dn.lines.map(l => l.itemId))];
        const [itemsMap, categoriesMap] = await Promise.all([
            Promise.all(distinctItemIds.map(id => this.itemRepo.getItem(id))).then(res => new Map(res.filter((i) => !!i && i.companyId === companyId).map(i => [i.id, i]))),
            this.itemCategoryRepo.getCompanyCategories(companyId).then(res => new Map(res.map(c => [c.id, c]))),
        ]);
        // Validate all items and track inventory requirement
        for (const line of dn.lines) {
            const item = itemsMap.get(line.itemId);
            if (!item || item.companyId !== companyId)
                throw new Error(`Item not found: ${line.itemId}`);
            if (!item.trackInventory)
                throw new Error(`Delivery note line item must track inventory: ${item.code}`);
        }
        // PHASE 1B: PRE-FETCH STOCK LEVELS (bare reads before transaction)
        const stockLevelMap = new Map();
        for (const line of dn.lines) {
            const key = `${line.itemId}|${dn.warehouseId}`;
            if (!stockLevelMap.has(key)) {
                const existing = await this.inventoryService.preFetchStockLevel(companyId, line.itemId, dn.warehouseId);
                stockLevelMap.set(key, existing !== null && existing !== void 0 ? existing : StockLevel_1.StockLevel.createNew(companyId, line.itemId, dn.warehouseId));
            }
        }
        // PHASE 1C: PRE-FETCH UOM CONVERSIONS (bare reads before transaction)
        const uomConversionMap = new Map();
        for (const itemId of distinctItemIds) {
            const item = itemsMap.get(itemId);
            if (item && !uomConversionMap.has(item.id)) {
                const convs = await this.uomConversionRepo.getConversionsForItem(companyId, item.id, { active: true });
                uomConversionMap.set(item.id, convs);
            }
        }
        // PHASE 1D: COMPUTE INVENTORY MOVEMENTS OUTSIDE TRANSACTION (pure computation)
        const inventoryMovements = new Map();
        const cogsBucket = new Map();
        for (const line of dn.lines) {
            const item = itemsMap.get(line.itemId);
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
            const convs = uomConversionMap.get(item.id) || [];
            const conversionResult = (0, UomResolutionService_1.convertItemQtyToBaseUomDetailed)({
                qty: line.deliveredQty,
                item,
                conversions: convs,
                fromUomId: line.uomId,
                fromUom: line.uom,
                round: SalesPostingHelpers_1.roundMoney,
                itemCode: item.code,
            });
            const qtyInBaseUom = conversionResult.qtyInBaseUom;
            const stockLevelKey = `${item.id}|${dn.warehouseId}`;
            const level = stockLevelMap.get(stockLevelKey);
            if (!level)
                throw new Error(`Stock level not pre-fetched for item ${item.code}`);
            const qtyBefore = level.qtyOnHand;
            const oldMaxBusinessDate = level.maxBusinessDate;
            let issueCostBase = 0;
            let issueCostCCY = 0;
            let costBasis = 'MISSING';
            if (qtyBefore > 0) {
                issueCostBase = level.avgCostBase;
                issueCostCCY = level.avgCostCCY;
                costBasis = 'AVG';
            }
            else if (level.lastCostBase > 0) {
                issueCostBase = level.lastCostBase;
                issueCostCCY = level.lastCostCCY;
                costBasis = 'LAST_KNOWN';
            }
            const settledQty = Math.min(qtyInBaseUom, Math.max(qtyBefore, 0));
            const unsettledQty = qtyInBaseUom - settledQty;
            const effectiveFxCCYToBase = issueCostCCY > 0 ? issueCostBase / issueCostCCY : 1.0;
            const movement = new StockMovement_1.StockMovement({
                id: `sm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                companyId,
                date: dn.deliveryDate,
                postingSeq: level.postingSeq + 1,
                createdAt: new Date(),
                createdBy: dn.createdBy,
                postedAt: new Date(),
                itemId: item.id,
                warehouseId: dn.warehouseId,
                direction: 'OUT',
                movementType: 'SALES_DELIVERY',
                qty: qtyInBaseUom,
                uom: item.baseUom,
                referenceType: 'DELIVERY_NOTE',
                referenceId: dn.id,
                referenceLineId: line.lineId,
                reversesMovementId: undefined,
                transferPairId: undefined,
                unitCostBase: issueCostBase,
                totalCostBase: (0, SalesPostingHelpers_1.roundMoney)(issueCostBase * qtyInBaseUom),
                unitCostCCY: issueCostCCY,
                totalCostCCY: (0, SalesPostingHelpers_1.roundMoney)(issueCostCCY * qtyInBaseUom),
                movementCurrency: item.costCurrency,
                fxRateMovToBase: effectiveFxCCYToBase,
                fxRateCCYToBase: effectiveFxCCYToBase,
                fxRateKind: 'EFFECTIVE',
                avgCostBaseAfter: level.avgCostBase,
                avgCostCCYAfter: level.avgCostCCY,
                qtyBefore,
                qtyAfter: qtyBefore - qtyInBaseUom,
                settledQty,
                unsettledQty,
                unsettledCostBasis: unsettledQty > 0 ? costBasis : undefined,
                negativeQtyAtPosting: (qtyBefore - qtyInBaseUom) < 0,
                costSettled: unsettledQty === 0,
                isBackdated: dn.deliveryDate < oldMaxBusinessDate,
                costSource: 'PURCHASE',
                metadata: {
                    uomConversion: {
                        conversionId: conversionResult.trace.conversionId,
                        mode: conversionResult.trace.mode,
                        appliedFactor: conversionResult.trace.factor,
                        sourceQty: line.deliveredQty,
                        sourceUomId: line.uomId,
                        sourceUom: line.uom,
                        baseUomId: item.baseUomId,
                        baseUom: item.baseUom,
                    },
                },
            });
            level.qtyOnHand -= qtyInBaseUom;
            level.postingSeq += 1;
            level.version += 1;
            level.totalMovements += 1;
            level.maxBusinessDate = dn.deliveryDate > oldMaxBusinessDate ? dn.deliveryDate : oldMaxBusinessDate;
            level.updatedAt = new Date();
            level.lastMovementId = movement.id;
            line.stockMovementId = movement.id;
            line.unitCostBase = (0, SalesPostingHelpers_1.roundMoney)(movement.unitCostBase || 0);
            line.lineCostBase = (0, SalesPostingHelpers_1.roundMoney)(qtyInBaseUom * line.unitCostBase);
            this.assertPositiveTrackedCost(qtyInBaseUom, line.unitCostBase, line.itemName || item.name, `delivery note ${dn.dnNumber}`);
            line.moveCurrency = movement.movementCurrency;
            line.fxRateMovToBase = movement.fxRateMovToBase;
            line.fxRateCCYToBase = movement.fxRateCCYToBase;
            inventoryMovements.set(line.lineId, { movement, updatedLevel: level, qtyInBaseUom });
            // PHASE 1E: PRE-RESOLVE COGS ACCOUNTS (bare reads before transaction)
            const cogsAccountId = item.cogsAccountId
                || (item.categoryId ? (_b = categoriesMap.get(item.categoryId)) === null || _b === void 0 ? void 0 : _b.defaultCogsAccountId : null)
                || settings.defaultCOGSAccountId;
            const inventoryAccountId = item.inventoryAssetAccountId
                || (item.categoryId ? (_c = categoriesMap.get(item.categoryId)) === null || _c === void 0 ? void 0 : _c.defaultInventoryAssetAccountId : null)
                || settings.defaultInventoryAccountId;
            if (!cogsAccountId)
                throw new Error(`No COGS account configured for item ${item.code}`);
            if (!inventoryAccountId)
                throw new Error(`No inventory account configured for item ${item.code}`);
            // Resolve account IDs through account repo (cache for duplicates)
            const resolvedCogsId = await this.resolveAccountId(companyId, cogsAccountId);
            const resolvedInventoryId = await this.resolveAccountId(companyId, inventoryAccountId);
            if (resolvedCogsId && resolvedInventoryId && line.lineCostBase > 0) {
                const key = `${resolvedCogsId}|${resolvedInventoryId}`;
                const existing = cogsBucket.get(key);
                if (existing) {
                    existing.amountBase = (0, SalesPostingHelpers_1.roundMoney)(existing.amountBase + line.lineCostBase);
                }
                else {
                    cogsBucket.set(key, {
                        cogsAccountId: resolvedCogsId,
                        inventoryAccountId: resolvedInventoryId,
                        amountBase: (0, SalesPostingHelpers_1.roundMoney)(line.lineCostBase),
                    });
                }
            }
            if (soLine) {
                soLine.deliveredQty = (0, SalesPostingHelpers_1.roundMoney)(soLine.deliveredQty + line.deliveredQty);
            }
        }
        // Pre-resolve base currency for voucher
        const resolvedBaseCurrency = (baseCurrency || ((_d = dn.lines[0]) === null || _d === void 0 ? void 0 : _d.moveCurrency) || 'USD').toUpperCase();
        // PHASE 2: TRANSACTION CALLBACK — WRITES ONLY
        await this.transactionManager.runTransaction(async (transaction) => {
            // Write inventory movements and stock levels
            for (const [, { movement, updatedLevel }] of inventoryMovements) {
                await this.inventoryService.writeStockMovement(movement, transaction);
                await this.inventoryService.writeStockLevel(updatedLevel, transaction);
            }
            // Create COGS voucher if needed
            if (shouldPostAccounting && DocumentPolicyResolver_1.DocumentPolicyResolver.shouldPostDeliveryNoteAccounting(accountingMode) && cogsBucket.size > 0) {
                const cogsVoucherLines = [];
                for (const entry of Array.from(cogsBucket.values())) {
                    const amount = (0, SalesPostingHelpers_1.roundMoney)(entry.amountBase);
                    cogsVoucherLines.push({
                        accountId: entry.cogsAccountId,
                        side: 'Debit',
                        amount,
                        baseAmount: amount,
                        docAmount: amount,
                    });
                    cogsVoucherLines.push({
                        accountId: entry.inventoryAccountId,
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
                    currency: resolvedBaseCurrency,
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
                    baseCurrencyOverride: resolvedBaseCurrency,
                    skipAccountValidation: true,
                }, transaction);
                dn.cogsVoucherId = voucher.id;
            }
            else {
                dn.cogsVoucherId = null;
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