"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetTaxCodeUseCase = exports.ListTaxCodesUseCase = exports.UpdateTaxCodeUseCase = exports.CreateTaxCodeUseCase = void 0;
const crypto_1 = require("crypto");
const TaxCode_1 = require("../../../domain/shared/entities/TaxCode");
const validateRateConsistency = (taxType, rate) => {
    if (rate < 0 || Number.isNaN(rate)) {
        throw new Error('TaxCode rate must be greater than or equal to 0');
    }
    if ((taxType === 'EXEMPT' || taxType === 'ZERO_RATED') && rate !== 0) {
        throw new Error(`TaxCode rate must be 0 when taxType is ${taxType}`);
    }
};
const applyOffsetLimit = (list, offset, limit) => {
    const from = Math.max(0, offset || 0);
    const sliced = list.slice(from);
    if (!limit || limit < 0)
        return sliced;
    return sliced.slice(0, limit);
};
class CreateTaxCodeUseCase {
    constructor(taxCodeRepo, accountRepo) {
        this.taxCodeRepo = taxCodeRepo;
        this.accountRepo = accountRepo;
    }
    async execute(input) {
        const existing = await this.taxCodeRepo.getByCode(input.companyId, input.code);
        if (existing) {
            throw new Error(`TaxCode code already exists: ${input.code}`);
        }
        validateRateConsistency(input.taxType, input.rate);
        if (input.purchaseTaxAccountId) {
            const purchaseTaxAccount = await this.accountRepo.getById(input.companyId, input.purchaseTaxAccountId);
            if (!purchaseTaxAccount) {
                throw new Error(`Purchase tax account not found: ${input.purchaseTaxAccountId}`);
            }
        }
        if (input.salesTaxAccountId) {
            const salesTaxAccount = await this.accountRepo.getById(input.companyId, input.salesTaxAccountId);
            if (!salesTaxAccount) {
                throw new Error(`Sales tax account not found: ${input.salesTaxAccountId}`);
            }
        }
        const now = new Date();
        const taxCode = new TaxCode_1.TaxCode({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            code: input.code,
            name: input.name,
            rate: input.rate,
            taxType: input.taxType,
            scope: input.scope,
            purchaseTaxAccountId: input.purchaseTaxAccountId,
            salesTaxAccountId: input.salesTaxAccountId,
            active: true,
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
        });
        await this.taxCodeRepo.create(taxCode);
        return taxCode;
    }
}
exports.CreateTaxCodeUseCase = CreateTaxCodeUseCase;
class UpdateTaxCodeUseCase {
    constructor(taxCodeRepo) {
        this.taxCodeRepo = taxCodeRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h;
        const existing = await this.taxCodeRepo.getById(input.companyId, input.id);
        if (!existing) {
            throw new Error(`TaxCode not found: ${input.id}`);
        }
        const taxType = (_a = input.taxType) !== null && _a !== void 0 ? _a : existing.taxType;
        const rate = (_b = input.rate) !== null && _b !== void 0 ? _b : existing.rate;
        validateRateConsistency(taxType, rate);
        const updated = new TaxCode_1.TaxCode({
            id: existing.id,
            companyId: existing.companyId,
            code: (_c = input.code) !== null && _c !== void 0 ? _c : existing.code,
            name: (_d = input.name) !== null && _d !== void 0 ? _d : existing.name,
            rate,
            taxType,
            scope: (_e = input.scope) !== null && _e !== void 0 ? _e : existing.scope,
            purchaseTaxAccountId: (_f = input.purchaseTaxAccountId) !== null && _f !== void 0 ? _f : existing.purchaseTaxAccountId,
            salesTaxAccountId: (_g = input.salesTaxAccountId) !== null && _g !== void 0 ? _g : existing.salesTaxAccountId,
            active: (_h = input.active) !== null && _h !== void 0 ? _h : existing.active,
            createdBy: existing.createdBy,
            createdAt: existing.createdAt,
            updatedAt: new Date(),
        });
        await this.taxCodeRepo.update(updated);
        return updated;
    }
}
exports.UpdateTaxCodeUseCase = UpdateTaxCodeUseCase;
class ListTaxCodesUseCase {
    constructor(taxCodeRepo) {
        this.taxCodeRepo = taxCodeRepo;
    }
    async execute(companyId, filters = {}) {
        if (filters.scope === 'PURCHASE') {
            const all = await this.taxCodeRepo.list(companyId, { active: filters.active });
            const filtered = all.filter((taxCode) => taxCode.scope === 'PURCHASE' || taxCode.scope === 'BOTH');
            return applyOffsetLimit(filtered, filters.offset, filters.limit);
        }
        if (filters.scope === 'SALES') {
            const all = await this.taxCodeRepo.list(companyId, { active: filters.active });
            const filtered = all.filter((taxCode) => taxCode.scope === 'SALES' || taxCode.scope === 'BOTH');
            return applyOffsetLimit(filtered, filters.offset, filters.limit);
        }
        return this.taxCodeRepo.list(companyId, {
            scope: filters.scope,
            active: filters.active,
            limit: filters.limit,
            offset: filters.offset,
        });
    }
}
exports.ListTaxCodesUseCase = ListTaxCodesUseCase;
class GetTaxCodeUseCase {
    constructor(taxCodeRepo) {
        this.taxCodeRepo = taxCodeRepo;
    }
    async execute(companyId, id) {
        const taxCode = await this.taxCodeRepo.getById(companyId, id);
        if (!taxCode) {
            throw new Error(`TaxCode not found: ${id}`);
        }
        return taxCode;
    }
}
exports.GetTaxCodeUseCase = GetTaxCodeUseCase;
//# sourceMappingURL=TaxCodeUseCases.js.map