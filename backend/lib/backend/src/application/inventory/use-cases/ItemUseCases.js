"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeactivateItemUseCase = exports.ActivateItemUseCase = exports.UpdateItemUseCase = exports.CreateItemUseCase = void 0;
const Item_1 = require("../../../domain/inventory/entities/Item");
class CreateItemUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(data) {
        const item = new Item_1.Item(`itm_${Date.now()}`, data.companyId, data.name, data.code, data.unit, data.categoryId, true, data.price, data.cost);
        await this.repo.createItem(item);
        return item;
    }
}
exports.CreateItemUseCase = CreateItemUseCase;
class UpdateItemUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id, data) {
        await this.repo.updateItem(id, data);
    }
}
exports.UpdateItemUseCase = UpdateItemUseCase;
class ActivateItemUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id) {
        await this.repo.setItemActive(id, true);
    }
}
exports.ActivateItemUseCase = ActivateItemUseCase;
class DeactivateItemUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id) {
        await this.repo.setItemActive(id, false);
    }
}
exports.DeactivateItemUseCase = DeactivateItemUseCase;
//# sourceMappingURL=ItemUseCases.js.map