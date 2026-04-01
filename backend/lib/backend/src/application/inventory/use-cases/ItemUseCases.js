"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteItemUseCase = exports.ListItemsUseCase = exports.GetItemUseCase = exports.UpdateItemUseCase = exports.CreateItemUseCase = void 0;
const Item_1 = require("../../../domain/inventory/entities/Item");
const crypto_1 = require("crypto");
class CreateItemUseCase {
    constructor(itemRepo, categoryRepo) {
        this.itemRepo = itemRepo;
        this.categoryRepo = categoryRepo;
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
            baseUom: data.baseUom,
            purchaseUom: data.purchaseUom,
            salesUom: data.salesUom,
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
    constructor(repo) {
        this.repo = repo;
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
        await this.repo.updateItem(id, data);
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