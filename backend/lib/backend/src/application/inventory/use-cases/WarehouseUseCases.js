"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateWarehouseUseCase = exports.CreateWarehouseUseCase = void 0;
const Warehouse_1 = require("../../../domain/inventory/entities/Warehouse");
class CreateWarehouseUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(data) {
        const wh = new Warehouse_1.Warehouse(`wh_${Date.now()}`, data.companyId, data.name, data.location);
        await this.repo.createWarehouse(wh);
    }
}
exports.CreateWarehouseUseCase = CreateWarehouseUseCase;
class UpdateWarehouseUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id, data) {
        await this.repo.updateWarehouse(id, data);
    }
}
exports.UpdateWarehouseUseCase = UpdateWarehouseUseCase;
//# sourceMappingURL=WarehouseUseCases.js.map