"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteItemUseCase = exports.ListItemsUseCase = exports.GetItemUseCase = exports.UpdateItemUseCase = exports.CreateItemUseCase = void 0;
const Item_1 = require("../../../domain/inventory/entities/Item");
const crypto_1 = require("crypto");
const trimOrUndefined = (value) => {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
};
const stripUndefined = (value) => {
    Object.keys(value).forEach((key) => {
        if (value[key] === undefined) {
            delete value[key];
        }
    });
    return value;
};
const resolveManagedUom = async (companyId, repo, fieldName, uomId, uomCode, required = false) => {
    var _a;
    const normalizedId = trimOrUndefined(uomId);
    const normalizedCode = (_a = trimOrUndefined(uomCode)) === null || _a === void 0 ? void 0 : _a.toUpperCase();
    if (repo) {
        if (normalizedId) {
            const selected = await repo.getUom(normalizedId);
            if (!selected || selected.companyId !== companyId) {
                throw new Error(`${fieldName} UOM not found: ${normalizedId}`);
            }
            return { uomId: selected.id, uom: selected.code };
        }
        if (normalizedCode) {
            const selected = await repo.getUomByCode(companyId, normalizedCode);
            if (!selected) {
                throw new Error(`${fieldName} UOM not found: ${normalizedCode}`);
            }
            return { uomId: selected.id, uom: selected.code };
        }
    }
    if (normalizedCode) {
        return { uomId: normalizedId, uom: normalizedCode };
    }
    if (required) {
        throw new Error(`${fieldName} UOM is required`);
    }
    return { uomId: normalizedId };
};
const resolveItemUomFields = async (companyId, data, repo) => {
    const base = await resolveManagedUom(companyId, repo, 'base', data.baseUomId, data.baseUom, true);
    const purchase = await resolveManagedUom(companyId, repo, 'purchase', data.purchaseUomId, data.purchaseUom, false);
    const sales = await resolveManagedUom(companyId, repo, 'sales', data.salesUomId, data.salesUom, false);
    return stripUndefined({
        baseUomId: base.uomId,
        baseUom: base.uom,
        purchaseUomId: purchase.uomId,
        purchaseUom: purchase.uom,
        salesUomId: sales.uomId,
        salesUom: sales.uom,
    });
};
class CreateItemUseCase {
    constructor(itemRepo, categoryRepo, uomRepo) {
        this.itemRepo = itemRepo;
        this.categoryRepo = categoryRepo;
        this.uomRepo = uomRepo;
    }
    async execute(data) {
        const existing = await this.itemRepo.getItemByCode(data.companyId, data.code);
        if (existing) {
            throw new Error(`Item code already exists: ${data.code}`);
        }
        let revenueAccountId = data.revenueAccountId;
        let cogsAccountId = data.cogsAccountId;
        let inventoryAssetAccountId = data.inventoryAssetAccountId;
        if (data.categoryId && this.categoryRepo) {
            const category = await this.categoryRepo.getCategory(data.categoryId);
            if (category) {
                revenueAccountId = revenueAccountId || category.defaultRevenueAccountId;
                cogsAccountId = cogsAccountId || category.defaultCogsAccountId;
                inventoryAssetAccountId = inventoryAssetAccountId || category.defaultInventoryAssetAccountId;
            }
        }
        const uomFields = await resolveItemUomFields(data.companyId, data, this.uomRepo);
        if (!uomFields.baseUom) {
            throw new Error('base UOM is required');
        }
        const now = new Date();
        const item = new Item_1.Item({
            id: (0, crypto_1.randomUUID)(),
            companyId: data.companyId,
            code: data.code,
            name: data.name,
            description: data.description,
            barcode: data.barcode,
            type: data.type,
            categoryId: data.categoryId,
            brand: data.brand,
            tags: data.tags,
            baseUomId: uomFields.baseUomId,
            baseUom: uomFields.baseUom,
            purchaseUomId: uomFields.purchaseUomId,
            purchaseUom: uomFields.purchaseUom,
            salesUomId: uomFields.salesUomId,
            salesUom: uomFields.salesUom,
            costCurrency: data.costCurrency,
            costingMethod: 'MOVING_AVG',
            trackInventory: data.trackInventory,
            revenueAccountId,
            cogsAccountId,
            inventoryAssetAccountId,
            minStockLevel: data.minStockLevel,
            maxStockLevel: data.maxStockLevel,
            reorderPoint: data.reorderPoint,
            active: true,
            createdBy: data.createdBy,
            createdAt: now,
            updatedAt: now,
        });
        await this.itemRepo.createItem(item);
        return item;
    }
}
exports.CreateItemUseCase = CreateItemUseCase;
class UpdateItemUseCase {
    constructor(repo, uomRepo) {
        this.repo = repo;
        this.uomRepo = uomRepo;
    }
    async execute(id, data) {
        const current = await this.repo.getItem(id);
        if (!current) {
            throw new Error(`Item not found: ${id}`);
        }
        if (data.costCurrency && data.costCurrency !== current.costCurrency) {
            const hasMovements = await this.repo.hasMovements(current.companyId, current.id);
            current.assertCostCurrencyChangeAllowed(data.costCurrency, hasMovements);
        }
        const hasAnyUomField = data.baseUom !== undefined
            || data.baseUomId !== undefined
            || data.purchaseUom !== undefined
            || data.purchaseUomId !== undefined
            || data.salesUom !== undefined
            || data.salesUomId !== undefined;
        const uomFields = hasAnyUomField
            ? await resolveItemUomFields(current.companyId, Object.assign(Object.assign({}, current), data), this.uomRepo)
            : {};
        await this.repo.updateItem(id, stripUndefined(Object.assign(Object.assign(Object.assign({}, data), uomFields), { updatedAt: new Date() })));
        const updated = await this.repo.getItem(id);
        if (!updated)
            throw new Error(`Item not found after update: ${id}`);
        return updated;
    }
}
exports.UpdateItemUseCase = UpdateItemUseCase;
class GetItemUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id) {
        return this.repo.getItem(id);
    }
}
exports.GetItemUseCase = GetItemUseCase;
class ListItemsUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(companyId, filters = {}) {
        return this.repo.getCompanyItems(companyId, filters);
    }
}
exports.ListItemsUseCase = ListItemsUseCase;
class DeleteItemUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id) {
        await this.repo.setItemActive(id, false);
    }
}
exports.DeleteItemUseCase = DeleteItemUseCase;
//# sourceMappingURL=ItemUseCases.js.map