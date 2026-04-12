"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PostOpeningStockDocumentUseCase = exports.DeleteOpeningStockDocumentUseCase = exports.ListOpeningStockDocumentsUseCase = exports.UpdateOpeningStockDocumentUseCase = exports.CreateOpeningStockDocumentUseCase = void 0;
const crypto_1 = require("crypto");
const VoucherLineEntity_1 = require("../../../domain/accounting/entities/VoucherLineEntity");
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
const OpeningStockDocument_1 = require("../../../domain/inventory/entities/OpeningStockDocument");
const isStockEligibleItem = (item) => !!item &&
    item.active !== false &&
    item.trackInventory === true &&
    item.type !== 'SERVICE';
const computeUnitCostBase = (unitCostInMoveCurrency, moveCurrency, baseCurrency, itemCostCurrency, fxRateMovToBase, fxRateCCYToBase) => {
    const move = (moveCurrency || '').toUpperCase();
    const base = (baseCurrency || '').toUpperCase();
    const cost = (itemCostCurrency || '').toUpperCase();
    if (move === base) {
        return (0, VoucherLineEntity_1.roundMoney)(unitCostInMoveCurrency);
    }
    if (move === cost) {
        return (0, VoucherLineEntity_1.roundMoney)(unitCostInMoveCurrency * fxRateCCYToBase);
    }
    return (0, VoucherLineEntity_1.roundMoney)(unitCostInMoveCurrency * fxRateMovToBase);
};
const prepareDraftDocumentState = async (deps, input) => {
    var _a, _b, _c;
    const createAccountingEffect = (_a = input.createAccountingEffect) !== null && _a !== void 0 ? _a : false;
    const [company, warehouse, accountingModule] = await Promise.all([
        deps.companyRepo.findById(input.companyId),
        deps.warehouseRepo.getWarehouse(input.warehouseId),
        createAccountingEffect
            ? deps.companyModuleRepo.get(input.companyId, 'accounting')
            : Promise.resolve(null),
    ]);
    if (!company)
        throw new Error(`Company not found: ${input.companyId}`);
    if (!warehouse || warehouse.companyId !== input.companyId) {
        throw new Error(`Warehouse not found: ${input.warehouseId}`);
    }
    if (warehouse.active === false) {
        throw new Error(`Warehouse is inactive: ${warehouse.code || warehouse.id}`);
    }
    if (createAccountingEffect) {
        if (!(accountingModule === null || accountingModule === void 0 ? void 0 : accountingModule.initialized)) {
            throw new Error('Accounting module is not enabled. Opening Stock Documents can only be posted as inventory-only until Accounting is initialized.');
        }
        if (!((_b = input.openingBalanceAccountId) === null || _b === void 0 ? void 0 : _b.trim())) {
            throw new Error('openingBalanceAccountId is required when createAccountingEffect is enabled');
        }
        const account = await deps.accountRepo.getById(input.companyId, input.openingBalanceAccountId);
        if (!account) {
            throw new Error('Opening Stock Clearing / Opening Balance account does not exist');
        }
        if (account.accountRole !== 'POSTING') {
            throw new Error('Opening Stock Clearing / Opening Balance account must be a POSTING account');
        }
        if (account.status !== 'ACTIVE') {
            throw new Error('Opening Stock Clearing / Opening Balance account must be ACTIVE');
        }
    }
    const itemIds = [...new Set((input.lines || []).map((line) => line.itemId))];
    const itemEntries = await Promise.all(itemIds.map((itemId) => deps.itemRepo.getItem(itemId)));
    const itemsById = new Map(itemEntries
        .filter((item) => !!item && item.companyId === input.companyId)
        .map((item) => [item.id, item]));
    const lines = input.lines.map((line, index) => {
        const item = itemsById.get(line.itemId);
        if (!item) {
            throw new Error(`Line ${index + 1}: item not found (${line.itemId})`);
        }
        if (!isStockEligibleItem(item)) {
            throw new Error(`Line ${index + 1}: item "${item.code} - ${item.name}" is not eligible for Opening Stock. Only active stock-tracked items are allowed.`);
        }
        const unitCostBase = computeUnitCostBase(line.unitCostInMoveCurrency, line.moveCurrency, company.baseCurrency, item.costCurrency, line.fxRateMovToBase, line.fxRateCCYToBase);
        return {
            lineId: (0, crypto_1.randomUUID)(),
            itemId: line.itemId,
            quantity: line.quantity,
            unitCostInMoveCurrency: line.unitCostInMoveCurrency,
            moveCurrency: line.moveCurrency.toUpperCase(),
            fxRateMovToBase: line.fxRateMovToBase,
            fxRateCCYToBase: line.fxRateCCYToBase,
            unitCostBase,
            totalValueBase: (0, VoucherLineEntity_1.roundMoney)(line.quantity * unitCostBase),
        };
    });
    return {
        createAccountingEffect,
        openingBalanceAccountId: createAccountingEffect ? (_c = input.openingBalanceAccountId) === null || _c === void 0 ? void 0 : _c.trim() : undefined,
        lines,
        totalValueBase: (0, VoucherLineEntity_1.roundMoney)(lines.reduce((sum, line) => sum + line.totalValueBase, 0)),
    };
};
class CreateOpeningStockDocumentUseCase {
    constructor(documentRepo, itemRepo, warehouseRepo, companyRepo, companyModuleRepo, accountRepo) {
        this.documentRepo = documentRepo;
        this.itemRepo = itemRepo;
        this.warehouseRepo = warehouseRepo;
        this.companyRepo = companyRepo;
        this.companyModuleRepo = companyModuleRepo;
        this.accountRepo = accountRepo;
    }
    async execute(input) {
        const prepared = await prepareDraftDocumentState({
            itemRepo: this.itemRepo,
            warehouseRepo: this.warehouseRepo,
            companyRepo: this.companyRepo,
            companyModuleRepo: this.companyModuleRepo,
            accountRepo: this.accountRepo,
        }, input);
        const document = new OpeningStockDocument_1.OpeningStockDocument({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            warehouseId: input.warehouseId,
            date: input.date,
            notes: input.notes,
            lines: prepared.lines,
            status: 'DRAFT',
            createAccountingEffect: prepared.createAccountingEffect,
            openingBalanceAccountId: prepared.openingBalanceAccountId,
            totalValueBase: prepared.totalValueBase,
            createdBy: input.createdBy,
            createdAt: new Date(),
        });
        await this.documentRepo.createDocument(document);
        return document;
    }
}
exports.CreateOpeningStockDocumentUseCase = CreateOpeningStockDocumentUseCase;
class UpdateOpeningStockDocumentUseCase {
    constructor(documentRepo, itemRepo, warehouseRepo, companyRepo, companyModuleRepo, accountRepo) {
        this.documentRepo = documentRepo;
        this.itemRepo = itemRepo;
        this.warehouseRepo = warehouseRepo;
        this.companyRepo = companyRepo;
        this.companyModuleRepo = companyModuleRepo;
        this.accountRepo = accountRepo;
    }
    async execute(input) {
        const existing = await this.documentRepo.getDocument(input.documentId);
        if (!existing || existing.companyId !== input.companyId) {
            throw new Error(`Opening Stock Document not found: ${input.documentId}`);
        }
        if (existing.status !== 'DRAFT') {
            throw new Error('Only DRAFT Opening Stock Documents can be edited');
        }
        const prepared = await prepareDraftDocumentState({
            itemRepo: this.itemRepo,
            warehouseRepo: this.warehouseRepo,
            companyRepo: this.companyRepo,
            companyModuleRepo: this.companyModuleRepo,
            accountRepo: this.accountRepo,
        }, {
            companyId: input.companyId,
            warehouseId: input.warehouseId,
            date: input.date,
            notes: input.notes,
            createAccountingEffect: input.createAccountingEffect,
            openingBalanceAccountId: input.openingBalanceAccountId,
            lines: input.lines,
        });
        await this.documentRepo.updateDocument(input.companyId, input.documentId, {
            warehouseId: input.warehouseId,
            date: input.date,
            notes: input.notes,
            lines: prepared.lines,
            createAccountingEffect: prepared.createAccountingEffect,
            openingBalanceAccountId: prepared.openingBalanceAccountId,
            totalValueBase: prepared.totalValueBase,
        });
        const updated = await this.documentRepo.getDocument(input.documentId);
        if (!updated) {
            throw new Error(`Opening Stock Document not found after update: ${input.documentId}`);
        }
        return updated;
    }
}
exports.UpdateOpeningStockDocumentUseCase = UpdateOpeningStockDocumentUseCase;
class ListOpeningStockDocumentsUseCase {
    constructor(documentRepo) {
        this.documentRepo = documentRepo;
    }
    async execute(companyId, status) {
        if (status) {
            return this.documentRepo.getByStatus(companyId, status);
        }
        return this.documentRepo.getCompanyDocuments(companyId);
    }
}
exports.ListOpeningStockDocumentsUseCase = ListOpeningStockDocumentsUseCase;
class DeleteOpeningStockDocumentUseCase {
    constructor(documentRepo) {
        this.documentRepo = documentRepo;
    }
    async execute(companyId, documentId) {
        const existing = await this.documentRepo.getDocument(documentId);
        if (!existing || existing.companyId !== companyId) {
            throw new Error(`Opening Stock Document not found: ${documentId}`);
        }
        if (existing.status !== 'DRAFT') {
            throw new Error('Only DRAFT Opening Stock Documents can be deleted');
        }
        await this.documentRepo.deleteDocument(documentId);
    }
}
exports.DeleteOpeningStockDocumentUseCase = DeleteOpeningStockDocumentUseCase;
class PostOpeningStockDocumentUseCase {
    constructor(documentRepo, itemRepo, itemCategoryRepo, warehouseRepo, inventorySettingsRepo, companyRepo, companyModuleRepo, accountRepo, movementUseCase, accountingPostingService, transactionManager) {
        this.documentRepo = documentRepo;
        this.itemRepo = itemRepo;
        this.itemCategoryRepo = itemCategoryRepo;
        this.warehouseRepo = warehouseRepo;
        this.inventorySettingsRepo = inventorySettingsRepo;
        this.companyRepo = companyRepo;
        this.companyModuleRepo = companyModuleRepo;
        this.accountRepo = accountRepo;
        this.movementUseCase = movementUseCase;
        this.accountingPostingService = accountingPostingService;
        this.transactionManager = transactionManager;
    }
    async execute(companyId, documentId, userId) {
        var _a, _b;
        const document = await this.documentRepo.getDocument(documentId);
        if (!document || document.companyId !== companyId) {
            throw new Error(`Opening Stock Document not found: ${documentId}`);
        }
        if (document.status !== 'DRAFT') {
            throw new Error('Only DRAFT Opening Stock Documents can be posted');
        }
        const [company, warehouse, inventorySettings, accountingModule] = await Promise.all([
            this.companyRepo.findById(companyId),
            this.warehouseRepo.getWarehouse(document.warehouseId),
            this.inventorySettingsRepo.getSettings(companyId),
            this.companyModuleRepo.get(companyId, 'accounting'),
        ]);
        if (!company)
            throw new Error(`Company not found: ${companyId}`);
        if (!warehouse || warehouse.companyId !== companyId) {
            throw new Error(`Warehouse not found: ${document.warehouseId}`);
        }
        if (warehouse.active === false) {
            throw new Error(`Warehouse is inactive: ${warehouse.code || warehouse.id}`);
        }
        const distinctItemIds = [...new Set(document.lines.map((line) => line.itemId))];
        const [items, categories] = await Promise.all([
            Promise.all(distinctItemIds.map((itemId) => this.itemRepo.getItem(itemId))),
            this.itemCategoryRepo.getCompanyCategories(companyId),
        ]);
        const itemsById = new Map(items
            .filter((item) => !!item && item.companyId === companyId)
            .map((item) => [item.id, item]));
        const categoriesById = new Map(categories.map((category) => [category.id, category]));
        const accountBuckets = new Map();
        if (document.createAccountingEffect) {
            if (!(accountingModule === null || accountingModule === void 0 ? void 0 : accountingModule.initialized)) {
                throw new Error('Accounting module is not enabled. This Opening Stock Document can only be posted as inventory-only.');
            }
            if (!((_a = document.openingBalanceAccountId) === null || _a === void 0 ? void 0 : _a.trim())) {
                throw new Error('Opening Stock Clearing / Opening Balance account is required when createAccountingEffect is enabled');
            }
            await this.assertPostingAccount(companyId, document.openingBalanceAccountId, 'Opening Stock Clearing / Opening Balance account');
            for (const [index, line] of document.lines.entries()) {
                const item = itemsById.get(line.itemId);
                if (!item) {
                    throw new Error(`Line ${index + 1}: item not found (${line.itemId})`);
                }
                if (!isStockEligibleItem(item)) {
                    throw new Error(`Line ${index + 1}: item "${item.code} - ${item.name}" is not eligible for Opening Stock posting`);
                }
                const inventoryAssetAccountId = item.inventoryAssetAccountId ||
                    (item.categoryId ? (_b = categoriesById.get(item.categoryId)) === null || _b === void 0 ? void 0 : _b.defaultInventoryAssetAccountId : undefined) ||
                    (inventorySettings === null || inventorySettings === void 0 ? void 0 : inventorySettings.defaultInventoryAssetAccountId);
                if (!inventoryAssetAccountId) {
                    throw new Error(`Line ${index + 1}: item "${item.code} - ${item.name}" is missing an Inventory Asset account. Configure it on the item, category, or Inventory Settings before posting accounting effect.`);
                }
                await this.assertPostingAccount(companyId, inventoryAssetAccountId, `Inventory Asset account for item "${item.code} - ${item.name}"`);
                if (line.totalValueBase > 0) {
                    const existing = accountBuckets.get(inventoryAssetAccountId) || 0;
                    accountBuckets.set(inventoryAssetAccountId, (0, VoucherLineEntity_1.roundMoney)(existing + line.totalValueBase));
                }
            }
            if (accountBuckets.size === 0) {
                throw new Error('Accounting effect requires a positive opening stock value. At least one line must have a positive total value.');
            }
        }
        await this.transactionManager.runTransaction(async (transaction) => {
            for (const line of document.lines) {
                const inInput = {
                    companyId,
                    itemId: line.itemId,
                    warehouseId: document.warehouseId,
                    qty: line.quantity,
                    date: document.date,
                    movementType: 'OPENING_STOCK',
                    refs: {
                        type: 'OPENING',
                        docId: document.id,
                        lineId: line.lineId,
                    },
                    currentUser: userId,
                    notes: document.notes,
                    metadata: {
                        source: 'opening-stock-document',
                        openingStockDocumentId: document.id,
                        createAccountingEffect: document.createAccountingEffect,
                    },
                    unitCostInMoveCurrency: line.unitCostInMoveCurrency,
                    moveCurrency: line.moveCurrency,
                    fxRateMovToBase: line.fxRateMovToBase,
                    fxRateCCYToBase: line.fxRateCCYToBase,
                    transaction,
                };
                await this.movementUseCase.processIN(inInput);
            }
            let voucherId;
            if (document.createAccountingEffect) {
                const balances = Array.from(accountBuckets.entries()).map(([accountId, amount]) => ({
                    accountId,
                    debitBalance: (0, VoucherLineEntity_1.roundMoney)(amount),
                    creditBalance: 0,
                    currency: company.baseCurrency,
                    exchangeRate: 1,
                    metadata: {
                        source: 'opening-stock-document',
                        openingStockDocumentId: document.id,
                    },
                }));
                balances.push({
                    accountId: document.openingBalanceAccountId,
                    debitBalance: 0,
                    creditBalance: (0, VoucherLineEntity_1.roundMoney)(document.totalValueBase),
                    currency: company.baseCurrency,
                    exchangeRate: 1,
                    metadata: {
                        source: 'opening-stock-document',
                        openingStockDocumentId: document.id,
                        role: 'opening-balance-offset',
                    },
                });
                const voucher = await this.accountingPostingService.postInTransaction({
                    companyId,
                    voucherType: VoucherTypes_1.VoucherType.OPENING_BALANCE,
                    voucherNo: `OS-${document.id}`,
                    date: document.date,
                    description: `Opening Stock Document ${document.id}`,
                    currency: company.baseCurrency,
                    exchangeRate: 1,
                    lines: [],
                    strategyPayload: {
                        balances,
                    },
                    metadata: {
                        sourceModule: 'inventory',
                        sourceType: 'OPENING_STOCK_DOCUMENT',
                        sourceId: document.id,
                        warehouseId: document.warehouseId,
                    },
                    createdBy: userId,
                    postingLockPolicy: VoucherTypes_1.PostingLockPolicy.FLEXIBLE_LOCKED,
                    reference: document.id,
                }, transaction);
                voucherId = voucher.id;
            }
            const updatePatch = {
                status: 'POSTED',
                postedAt: new Date(),
            };
            if (voucherId) {
                updatePatch.voucherId = voucherId;
            }
            await this.documentRepo.updateDocument(companyId, document.id, updatePatch, transaction);
        });
        const posted = await this.documentRepo.getDocument(document.id);
        if (!posted) {
            throw new Error(`Opening Stock Document not found after posting: ${document.id}`);
        }
        return posted;
    }
    async assertPostingAccount(companyId, accountId, label) {
        const account = await this.accountRepo.getById(companyId, accountId);
        if (!account) {
            throw new Error(`${label} does not exist`);
        }
        if (account.accountRole !== 'POSTING') {
            throw new Error(`${label} must be a POSTING account`);
        }
        if (account.status !== 'ACTIVE') {
            throw new Error(`${label} must be ACTIVE`);
        }
    }
}
exports.PostOpeningStockDocumentUseCase = PostOpeningStockDocumentUseCase;
//# sourceMappingURL=OpeningStockDocumentUseCases.js.map