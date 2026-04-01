"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageCategoriesUseCase = void 0;
const crypto_1 = require("crypto");
const ItemCategory_1 = require("../../../domain/inventory/entities/ItemCategory");
class ManageCategoriesUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async create(input) {
        var _a;
        const category = new ItemCategory_1.ItemCategory({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            name: input.name,
            parentId: input.parentId,
            sortOrder: (_a = input.sortOrder) !== null && _a !== void 0 ? _a : 0,
            active: true,
            defaultRevenueAccountId: input.defaultRevenueAccountId,
            defaultCogsAccountId: input.defaultCogsAccountId,
            defaultInventoryAssetAccountId: input.defaultInventoryAssetAccountId,
        });
        await this.repo.createCategory(category);
        return category;
    }
    async update(id, data) {
        await this.repo.updateCategory(id, data);
        const updated = await this.repo.getCategory(id);
        if (!updated)
            throw new Error(`Category not found: ${id}`);
        return updated;
    }
    async list(companyId, parentId) {
        if (parentId !== undefined) {
            return this.repo.getCategoriesByParent(companyId, parentId);
        }
        return this.repo.getCompanyCategories(companyId);
    }
    async get(id) {
        return this.repo.getCategory(id);
    }
    async delete(id) {
        await this.repo.updateCategory(id, { active: false });
    }
}
exports.ManageCategoriesUseCase = ManageCategoriesUseCase;
//# sourceMappingURL=CategoryUseCases.js.map