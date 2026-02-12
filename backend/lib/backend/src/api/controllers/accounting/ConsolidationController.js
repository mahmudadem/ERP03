"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsolidationController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const ConsolidationUseCases_1 = require("../../../application/accounting/use-cases/ConsolidationUseCases");
const uuid_1 = require("uuid");
const CompanyGroup_1 = require("../../../domain/accounting/entities/CompanyGroup");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
class ConsolidationController {
    static async createGroup(req, res, next) {
        var _a;
        try {
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.uid;
            const { name, reportingCurrency, members } = req.body;
            const group = new CompanyGroup_1.CompanyGroup((0, uuid_1.v4)(), name, reportingCurrency, members, new Date(), userId);
            await bindRepositories_1.diContainer.companyGroupRepository.create(group);
            res.status(201).json({ success: true, data: group });
        }
        catch (error) {
            next(error);
        }
    }
    static async listGroups(req, res, next) {
        var _a;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const groups = await bindRepositories_1.diContainer.companyGroupRepository.list(companyId);
            res.status(200).json({ success: true, data: groups });
        }
        catch (error) {
            next(error);
        }
    }
    static async consolidatedTrialBalance(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { groupId, asOfDate } = req.query;
            if (!groupId)
                return res.status(400).json({ error: 'groupId is required' });
            const useCase = new ConsolidationUseCases_1.GetConsolidatedTrialBalanceUseCase(bindRepositories_1.diContainer.companyGroupRepository, bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.exchangeRateRepository, permissionChecker);
            const data = await useCase.execute(groupId, companyId, userId, asOfDate || new Date().toISOString().slice(0, 10));
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.ConsolidationController = ConsolidationController;
//# sourceMappingURL=ConsolidationController.js.map