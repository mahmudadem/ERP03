"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListWarehousesUseCase = exports.UpdateWarehouseUseCase = exports.CreateWarehouseUseCase = void 0;
const Warehouse_1 = require("../../../domain/inventory/entities/Warehouse");
const crypto_1 = require("crypto");
class CreateWarehouseUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(data) {
        var _a;
        const byCode = await this.repo.getWarehouseByCode(data.companyId, data.code);
        if (byCode) {
            throw new Error(`Warehouse code already exists: ${data.code}`);
        }
        const now = new Date();
        const wh = new Warehouse_1.Warehouse({
            id: (0, crypto_1.randomUUID)(),
            companyId: data.companyId,
            name: data.name,
            code: data.code,
            address: data.address,
            active: true,
            isDefault: (_a = data.isDefault) !== null && _a !== void 0 ? _a : false,
            createdAt: now,
            updatedAt: now,
        });
        await this.repo.createWarehouse(wh);
        return wh;
    }
}
exports.CreateWarehouseUseCase = CreateWarehouseUseCase;
class UpdateWarehouseUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id, data) {
        const current = await this.repo.getWarehouse(id);
        if (!current)
            throw new Error(`Warehouse not found: ${id}`);
        if (data.code && data.code !== current.code) {
            const duplicate = await this.repo.getWarehouseByCode(current.companyId, data.code);
            if (duplicate && duplicate.id !== id) {
                throw new Error(`Warehouse code already exists: ${data.code}`);
            }
        }
        await this.repo.updateWarehouse(id, data);
        const updated = await this.repo.getWarehouse(id);
        if (!updated)
            throw new Error(`Warehouse not found after update: ${id}`);
        return updated;
    }
}
exports.UpdateWarehouseUseCase = UpdateWarehouseUseCase;
class ListWarehousesUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(companyId, filters = {}) {
        return this.repo.getCompanyWarehouses(companyId, filters);
    }
}
exports.ListWarehousesUseCase = ListWarehousesUseCase;
//# sourceMappingURL=WarehouseUseCases.js.map