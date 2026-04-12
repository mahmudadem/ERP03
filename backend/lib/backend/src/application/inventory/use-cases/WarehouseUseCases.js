"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListWarehousesUseCase = exports.UpdateWarehouseUseCase = exports.CreateWarehouseUseCase = void 0;
const Warehouse_1 = require("../../../domain/inventory/entities/Warehouse");
const crypto_1 = require("crypto");
const normalizeParentId = (parentId) => {
    if (parentId === undefined)
        return undefined;
    const trimmed = parentId === null || parentId === void 0 ? void 0 : parentId.trim();
    return trimmed ? trimmed : null;
};
const resolveValidatedParent = async (repo, companyId, currentWarehouseId, candidateParentId) => {
    const normalizedParentId = normalizeParentId(candidateParentId);
    if (normalizedParentId === undefined || normalizedParentId === null) {
        return normalizedParentId;
    }
    if (currentWarehouseId && normalizedParentId === currentWarehouseId) {
        throw new Error('Warehouse cannot be its own parent');
    }
    let cursor = await repo.getWarehouse(normalizedParentId);
    if (!cursor || cursor.companyId !== companyId) {
        throw new Error(`Parent warehouse not found: ${normalizedParentId}`);
    }
    const visited = new Set();
    while (cursor) {
        if (visited.has(cursor.id))
            break;
        if (cursor.companyId !== companyId) {
            throw new Error(`Parent warehouse not found: ${normalizedParentId}`);
        }
        if (currentWarehouseId && cursor.id === currentWarehouseId) {
            throw new Error('Warehouse hierarchy cannot contain cycles');
        }
        visited.add(cursor.id);
        if (!cursor.parentId)
            break;
        cursor = await repo.getWarehouse(cursor.parentId);
    }
    return normalizedParentId;
};
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
        const parentId = await resolveValidatedParent(this.repo, data.companyId, null, data.parentId);
        const now = new Date();
        const wh = new Warehouse_1.Warehouse({
            id: (0, crypto_1.randomUUID)(),
            companyId: data.companyId,
            name: data.name,
            code: data.code,
            parentId,
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
        const updatePayload = Object.assign(Object.assign({}, data), { updatedAt: new Date() });
        if (data.parentId !== undefined) {
            updatePayload.parentId = await resolveValidatedParent(this.repo, current.companyId, id, data.parentId);
        }
        await this.repo.updateWarehouse(id, updatePayload);
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