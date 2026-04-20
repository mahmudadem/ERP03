"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ManageUomConversionsUseCase = void 0;
const crypto_1 = require("crypto");
const UomConversion_1 = require("../../../domain/inventory/entities/UomConversion");
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
const resolveConversionUom = async (companyId, repo, fieldName, uomId, uomCode) => {
    var _a;
    const normalizedId = trimOrUndefined(uomId);
    const normalizedCode = (_a = trimOrUndefined(uomCode)) === null || _a === void 0 ? void 0 : _a.toUpperCase();
    if (repo) {
        if (normalizedId) {
            const uom = await repo.getUom(normalizedId);
            if (!uom || uom.companyId !== companyId) {
                throw new Error(`${fieldName} UOM not found: ${normalizedId}`);
            }
            return { uomId: uom.id, uom: uom.code };
        }
        if (normalizedCode) {
            const uom = await repo.getUomByCode(companyId, normalizedCode);
            if (!uom) {
                throw new Error(`${fieldName} UOM not found: ${normalizedCode}`);
            }
            return { uomId: uom.id, uom: uom.code };
        }
    }
    if (!normalizedCode) {
        throw new Error(`${fieldName} UOM is required`);
    }
    return { uomId: normalizedId, uom: normalizedCode };
};
class ManageUomConversionsUseCase {
    constructor(repo, uomRepo) {
        this.repo = repo;
        this.uomRepo = uomRepo;
    }
    async create(input) {
        const from = await resolveConversionUom(input.companyId, this.uomRepo, 'from', input.fromUomId, input.fromUom);
        const to = await resolveConversionUom(input.companyId, this.uomRepo, 'to', input.toUomId, input.toUom);
        const conversion = new UomConversion_1.UomConversion({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            itemId: input.itemId,
            fromUomId: from.uomId,
            fromUom: from.uom,
            toUomId: to.uomId,
            toUom: to.uom,
            factor: input.factor,
            active: true,
        });
        await this.repo.createConversion(conversion);
        return conversion;
    }
    async update(id, data) {
        const current = await this.repo.getConversion(id);
        if (!current)
            throw new Error(`UoM conversion not found: ${id}`);
        const from = (data.fromUom !== undefined || data.fromUomId !== undefined)
            ? await resolveConversionUom(current.companyId, this.uomRepo, 'from', data.fromUomId, data.fromUom)
            : { uomId: current.fromUomId, uom: current.fromUom };
        const to = (data.toUom !== undefined || data.toUomId !== undefined)
            ? await resolveConversionUom(current.companyId, this.uomRepo, 'to', data.toUomId, data.toUom)
            : { uomId: current.toUomId, uom: current.toUom };
        await this.repo.updateConversion(id, stripUndefined(Object.assign(Object.assign({}, data), { fromUomId: from.uomId, fromUom: from.uom, toUomId: to.uomId, toUom: to.uom })));
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