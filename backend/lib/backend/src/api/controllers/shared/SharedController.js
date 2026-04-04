"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharedController = void 0;
const PartyUseCases_1 = require("../../../application/shared/use-cases/PartyUseCases");
const TaxCodeUseCases_1 = require("../../../application/shared/use-cases/TaxCodeUseCases");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const PARTY_ROLES = ['VENDOR', 'CUSTOMER'];
const TAX_SCOPES = ['PURCHASE', 'SALES', 'BOTH'];
class SharedController {
    static getCompanyId(req) {
        var _a;
        const companyId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId;
        if (!companyId) {
            throw new Error('Company context not found');
        }
        return companyId;
    }
    static getUserId(req) {
        var _a;
        return ((_a = req.user) === null || _a === void 0 ? void 0 : _a.uid) || 'SYSTEM';
    }
    static toBoolean(value) {
        if (value === undefined)
            return undefined;
        return String(value) === 'true';
    }
    static toPartyRole(value) {
        if (!value)
            return undefined;
        const role = String(value).toUpperCase();
        if (!PARTY_ROLES.includes(role)) {
            throw new Error(`Invalid role: ${value}`);
        }
        return role;
    }
    static toTaxScope(value) {
        if (!value)
            return undefined;
        const scope = String(value).toUpperCase();
        if (!TAX_SCOPES.includes(scope)) {
            throw new Error(`Invalid scope: ${value}`);
        }
        return scope;
    }
    static async createParty(req, res, next) {
        try {
            const companyId = SharedController.getCompanyId(req);
            const userId = SharedController.getUserId(req);
            const useCase = new PartyUseCases_1.CreatePartyUseCase(bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.companyCurrencyRepository);
            const party = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: party.toJSON(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateParty(req, res, next) {
        try {
            const companyId = SharedController.getCompanyId(req);
            const useCase = new PartyUseCases_1.UpdatePartyUseCase(bindRepositories_1.diContainer.partyRepository, bindRepositories_1.diContainer.companyCurrencyRepository);
            const party = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, id: req.params.id }));
            res.json({
                success: true,
                data: party.toJSON(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getParty(req, res, next) {
        try {
            const companyId = SharedController.getCompanyId(req);
            const useCase = new PartyUseCases_1.GetPartyUseCase(bindRepositories_1.diContainer.partyRepository);
            const party = await useCase.execute(companyId, req.params.id);
            res.json({
                success: true,
                data: party.toJSON(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listParties(req, res, next) {
        try {
            const companyId = SharedController.getCompanyId(req);
            const useCase = new PartyUseCases_1.ListPartiesUseCase(bindRepositories_1.diContainer.partyRepository);
            const parties = await useCase.execute(companyId, {
                role: SharedController.toPartyRole(req.query.role),
                active: SharedController.toBoolean(req.query.active),
                search: req.query.search ? String(req.query.search) : undefined,
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                offset: req.query.offset ? Number(req.query.offset) : undefined,
            });
            res.json({
                success: true,
                data: parties.map((party) => party.toJSON()),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async createTaxCode(req, res, next) {
        try {
            const companyId = SharedController.getCompanyId(req);
            const userId = SharedController.getUserId(req);
            const useCase = new TaxCodeUseCases_1.CreateTaxCodeUseCase(bindRepositories_1.diContainer.taxCodeRepository, bindRepositories_1.diContainer.accountRepository);
            const taxCode = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, createdBy: userId }));
            res.status(201).json({
                success: true,
                data: taxCode.toJSON(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateTaxCode(req, res, next) {
        try {
            const companyId = SharedController.getCompanyId(req);
            const useCase = new TaxCodeUseCases_1.UpdateTaxCodeUseCase(bindRepositories_1.diContainer.taxCodeRepository);
            const taxCode = await useCase.execute(Object.assign(Object.assign({}, (req.body || {})), { companyId, id: req.params.id }));
            res.json({
                success: true,
                data: taxCode.toJSON(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getTaxCode(req, res, next) {
        try {
            const companyId = SharedController.getCompanyId(req);
            const useCase = new TaxCodeUseCases_1.GetTaxCodeUseCase(bindRepositories_1.diContainer.taxCodeRepository);
            const taxCode = await useCase.execute(companyId, req.params.id);
            res.json({
                success: true,
                data: taxCode.toJSON(),
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listTaxCodes(req, res, next) {
        try {
            const companyId = SharedController.getCompanyId(req);
            const useCase = new TaxCodeUseCases_1.ListTaxCodesUseCase(bindRepositories_1.diContainer.taxCodeRepository);
            const taxCodes = await useCase.execute(companyId, {
                scope: SharedController.toTaxScope(req.query.scope),
                active: SharedController.toBoolean(req.query.active),
                limit: req.query.limit ? Number(req.query.limit) : undefined,
                offset: req.query.offset ? Number(req.query.offset) : undefined,
            });
            res.json({
                success: true,
                data: taxCodes.map((taxCode) => taxCode.toJSON()),
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SharedController = SharedController;
//# sourceMappingURL=SharedController.js.map