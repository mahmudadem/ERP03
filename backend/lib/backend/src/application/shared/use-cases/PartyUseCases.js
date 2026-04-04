"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetPartyUseCase = exports.ListPartiesUseCase = exports.UpdatePartyUseCase = exports.CreatePartyUseCase = void 0;
const crypto_1 = require("crypto");
const Party_1 = require("../../../domain/shared/entities/Party");
class CreatePartyUseCase {
    constructor(partyRepo, companyCurrencyRepo) {
        this.partyRepo = partyRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
    }
    async execute(input) {
        if (!Array.isArray(input.roles) || input.roles.length === 0) {
            throw new Error('Party roles must contain at least one role');
        }
        const existing = await this.partyRepo.getByCode(input.companyId, input.code);
        if (existing) {
            throw new Error(`Party code already exists: ${input.code}`);
        }
        if (input.defaultCurrency) {
            const enabled = await this.companyCurrencyRepo.isEnabled(input.companyId, input.defaultCurrency);
            if (!enabled) {
                throw new Error(`Default currency is not enabled for company: ${input.defaultCurrency}`);
            }
        }
        const now = new Date();
        const party = new Party_1.Party({
            id: (0, crypto_1.randomUUID)(),
            companyId: input.companyId,
            code: input.code,
            legalName: input.legalName,
            displayName: input.displayName,
            roles: input.roles,
            contactPerson: input.contactPerson,
            phone: input.phone,
            email: input.email,
            address: input.address,
            taxId: input.taxId,
            paymentTermsDays: input.paymentTermsDays,
            defaultCurrency: input.defaultCurrency,
            defaultAPAccountId: input.defaultAPAccountId,
            defaultARAccountId: input.defaultARAccountId,
            active: true,
            createdBy: input.createdBy,
            createdAt: now,
            updatedAt: now,
        });
        await this.partyRepo.create(party);
        return party;
    }
}
exports.CreatePartyUseCase = CreatePartyUseCase;
class UpdatePartyUseCase {
    constructor(partyRepo, companyCurrencyRepo) {
        this.partyRepo = partyRepo;
        this.companyCurrencyRepo = companyCurrencyRepo;
    }
    async execute(input) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        const existing = await this.partyRepo.getById(input.companyId, input.id);
        if (!existing) {
            throw new Error(`Party not found: ${input.id}`);
        }
        const nextCode = (_a = input.code) !== null && _a !== void 0 ? _a : existing.code;
        if (nextCode !== existing.code) {
            const duplicate = await this.partyRepo.getByCode(input.companyId, nextCode);
            if (duplicate && duplicate.id !== existing.id) {
                throw new Error(`Party code already exists: ${nextCode}`);
            }
        }
        if (input.roles && input.roles.length === 0) {
            throw new Error('Party roles must contain at least one role');
        }
        if (input.defaultCurrency) {
            const enabled = await this.companyCurrencyRepo.isEnabled(input.companyId, input.defaultCurrency);
            if (!enabled) {
                throw new Error(`Default currency is not enabled for company: ${input.defaultCurrency}`);
            }
        }
        const updated = new Party_1.Party({
            id: existing.id,
            companyId: existing.companyId,
            code: (_b = input.code) !== null && _b !== void 0 ? _b : existing.code,
            legalName: (_c = input.legalName) !== null && _c !== void 0 ? _c : existing.legalName,
            displayName: (_d = input.displayName) !== null && _d !== void 0 ? _d : existing.displayName,
            roles: (_e = input.roles) !== null && _e !== void 0 ? _e : existing.roles,
            contactPerson: (_f = input.contactPerson) !== null && _f !== void 0 ? _f : existing.contactPerson,
            phone: (_g = input.phone) !== null && _g !== void 0 ? _g : existing.phone,
            email: (_h = input.email) !== null && _h !== void 0 ? _h : existing.email,
            address: (_j = input.address) !== null && _j !== void 0 ? _j : existing.address,
            taxId: (_k = input.taxId) !== null && _k !== void 0 ? _k : existing.taxId,
            paymentTermsDays: (_l = input.paymentTermsDays) !== null && _l !== void 0 ? _l : existing.paymentTermsDays,
            defaultCurrency: (_m = input.defaultCurrency) !== null && _m !== void 0 ? _m : existing.defaultCurrency,
            defaultAPAccountId: (_o = input.defaultAPAccountId) !== null && _o !== void 0 ? _o : existing.defaultAPAccountId,
            defaultARAccountId: (_p = input.defaultARAccountId) !== null && _p !== void 0 ? _p : existing.defaultARAccountId,
            active: (_q = input.active) !== null && _q !== void 0 ? _q : existing.active,
            createdBy: existing.createdBy,
            createdAt: existing.createdAt,
            updatedAt: new Date(),
        });
        await this.partyRepo.update(updated);
        return updated;
    }
}
exports.UpdatePartyUseCase = UpdatePartyUseCase;
class ListPartiesUseCase {
    constructor(partyRepo) {
        this.partyRepo = partyRepo;
    }
    async execute(companyId, filters = {}) {
        const parties = await this.partyRepo.list(companyId, {
            role: filters.role,
            active: filters.active,
            limit: filters.limit,
            offset: filters.offset,
        });
        const search = (filters.search || '').trim().toLowerCase();
        if (!search) {
            return parties;
        }
        return parties.filter((party) => party.code.toLowerCase().includes(search) ||
            party.legalName.toLowerCase().includes(search) ||
            party.displayName.toLowerCase().includes(search) ||
            (party.phone || '').toLowerCase().includes(search) ||
            (party.email || '').toLowerCase().includes(search));
    }
}
exports.ListPartiesUseCase = ListPartiesUseCase;
class GetPartyUseCase {
    constructor(partyRepo) {
        this.partyRepo = partyRepo;
    }
    async execute(companyId, id) {
        const party = await this.partyRepo.getById(companyId, id);
        if (!party) {
            throw new Error(`Party not found: ${id}`);
        }
        return party;
    }
}
exports.GetPartyUseCase = GetPartyUseCase;
//# sourceMappingURL=PartyUseCases.js.map