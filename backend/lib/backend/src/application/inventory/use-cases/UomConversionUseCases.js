"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageUomConversionsUseCase = void 0;
const crypto_1 = require("crypto");
const UomConversion_1 = require("../../../domain/inventory/entities/UomConversion");
class ManageUomConversionsUseCase {
    constructor(repo) {
        this.repo = repo;
    }
    async create(input) {
        const conversion = new UomConversion_1.UomConversion({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            itemId: input.itemId,
            fromUom: input.fromUom,
            toUom: input.toUom,
            factor: input.factor,
            active: true,
        });
        await this.repo.createConversion(conversion);
        return conversion;
    }
    async update(id, data) {
        await this.repo.updateConversion(id, data);
        const updated = await this.repo.getConversion(id);
        if (!updated)
            throw new Error(`UoM conversion not found: ${id}`);
        return updated;
    }
    async listForItem(companyId, itemId) {
        return this.repo.getConversionsForItem(companyId, itemId);
    }
    async get(id) {
        return this.repo.getConversion(id);
    }
    async delete(id) {
        await this.repo.updateConversion(id, { active: false });
    }
}
exports.ManageUomConversionsUseCase = ManageUomConversionsUseCase;
//# sourceMappingURL=UomConversionUseCases.js.map