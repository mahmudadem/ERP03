"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BudgetController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const BudgetUseCases_1 = require("../../../application/accounting/use-cases/BudgetUseCases");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
class BudgetController {
    static async list(req, res, next) {
        var _a;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const fiscalYearId = req.query.fiscalYearId;
            const budgets = await bindRepositories_1.diContainer.budgetRepository.list(companyId, fiscalYearId);
            res.status(200).json({ success: true, data: budgets });
        }
        catch (error) {
            next(error);
        }
    }
    static async create(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const useCase = new BudgetUseCases_1.CreateBudgetUseCase(bindRepositories_1.diContainer.budgetRepository, bindRepositories_1.diContainer.fiscalYearRepository, permissionChecker);
            const budget = await useCase.execute(companyId, userId, req.body);
            res.status(201).json({ success: true, data: budget });
        }
        catch (error) {
            next(error);
        }
    }
    static async update(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const useCase = new BudgetUseCases_1.UpdateBudgetUseCase(bindRepositories_1.diContainer.budgetRepository, permissionChecker);
            const budget = await useCase.execute(companyId, userId, id, req.body);
            res.status(200).json({ success: true, data: budget });
        }
        catch (error) {
            next(error);
        }
    }
    static async approve(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const useCase = new BudgetUseCases_1.ApproveBudgetUseCase(bindRepositories_1.diContainer.budgetRepository, permissionChecker);
            await useCase.execute(companyId, userId, id);
            res.status(200).json({ success: true });
        }
        catch (error) {
            next(error);
        }
    }
    static async budgetVsActual(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { budgetId, costCenterId } = req.query;
            if (!budgetId)
                return res.status(400).json({ error: 'budgetId is required' });
            const useCase = new BudgetUseCases_1.GetBudgetVsActualUseCase(bindRepositories_1.diContainer.budgetRepository, bindRepositories_1.diContainer.fiscalYearRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId, budgetId, costCenterId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.BudgetController = BudgetController;
//# sourceMappingURL=BudgetController.js.map