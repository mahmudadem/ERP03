"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListUomsUseCase = exports.GetUomUseCase = exports.UpdateUomUseCase = exports.CreateUomUseCase = void 0;
const crypto_1 = require("crypto");
const Uom_1 = require("../../../domain/inventory/entities/Uom");
class CreateUomUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(input) {
        var _a, _b;
        const existing = await this.repo.getUomByCode(input.companyId, input.code);
        if (existing) {
            throw new Error(`UOM code already exists: ${input.code}`);
        }
        const now = new Date();
        const uom = new Uom_1.Uom({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            code: input.code,
            name: input.name,
            dimension: input.dimension,
            decimalPlaces: (_a = input.decimalPlaces) !== null && _a !== void 0 ? _a : 0,
            active: (_b = input.active) !== null && _b !== void 0 ? _b : true,
            isSystem: false,
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
        });
        await this.repo.createUom(uom);
        return uom;
    }
}
exports.CreateUomUseCase = CreateUomUseCase;
class UpdateUomUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id, data) {
        const current = await this.repo.getUom(id);
        if (!current)
            throw new Error(`UOM not found: ${id}`);
        if (data.code && data.code.toUpperCase().trim() !== current.code) {
            const existing = await this.repo.getUomByCode(current.companyId, data.code);
            if (existing && existing.id !== id) {
                throw new Error(`UOM code already exists: ${data.code}`);
            }
        }
        await this.repo.updateUom(id, Object.assign(Object.assign({}, data), { updatedAt: new Date() }));
        const updated = await this.repo.getUom(id);
        if (!updated)
            throw new Error(`UOM not found after update: ${id}`);
        return updated;
    }
}
exports.UpdateUomUseCase = UpdateUomUseCase;
class GetUomUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(id) {
        return this.repo.getUom(id);
    }
}
exports.GetUomUseCase = GetUomUseCase;
class ListUomsUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async execute(companyId, filters = {}) {
        return this.repo.getCompanyUoms(companyId, filters);
    }
}
exports.ListUomsUseCase = ListUomsUseCase;
//# sourceMappingURL=UomUseCases.js.map