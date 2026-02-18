"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiscalYearController = void 0;
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const FiscalYearUseCases_1 = require("../../../application/accounting/use-cases/FiscalYearUseCases");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
class FiscalYearController {
    static async list(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const useCase = new FiscalYearUseCases_1.ListFiscalYearsUseCase(bindRepositories_1.diContainer.fiscalYearRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async create(req, res, next) {
        try {
            const { year, startMonth, name, periodScheme, includeAdjustmentPeriod, specialPeriodsCount } = req.body;
            const useCase = new FiscalYearUseCases_1.CreateFiscalYearUseCase(bindRepositories_1.diContainer.fiscalYearRepository, bindRepositories_1.diContainer.companyRepository, permissionChecker);
            const fy = await useCase.execute(req.user.companyId, req.user.uid, {
                year,
                startMonth,
                name,
                periodScheme
            });
            res.status(201).json(fy);
        }
        catch (error) {
            next(error);
        }
    }
    static async closePeriod(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const { periodId } = req.body;
            const useCase = new FiscalYearUseCases_1.ClosePeriodUseCase(bindRepositories_1.diContainer.fiscalYearRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId, id, periodId);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async reopenPeriod(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const { periodId } = req.body;
            const useCase = new FiscalYearUseCases_1.ReopenPeriodUseCase(bindRepositories_1.diContainer.fiscalYearRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId, id, periodId);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async enableSpecialPeriods(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const { definitions } = req.body;
            const useCase = new FiscalYearUseCases_1.EnableSpecialPeriodsUseCase(bindRepositories_1.diContainer.fiscalYearRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId, id, definitions);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async closeYear(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const { retainedEarningsAccountId } = req.body;
            const useCase = new FiscalYearUseCases_1.CloseYearUseCase(bindRepositories_1.diContainer.fiscalYearRepository, bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.transactionManager, permissionChecker);
            const data = await useCase.execute(companyId, userId, id, { retainedEarningsAccountId });
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async reopenYear(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const useCase = new FiscalYearUseCases_1.ReopenYearUseCase(bindRepositories_1.diContainer.fiscalYearRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId, id);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async delete(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const useCase = new FiscalYearUseCases_1.DeleteFiscalYearUseCase(bindRepositories_1.diContainer.fiscalYearRepository, bindRepositories_1.diContainer.voucherRepository, permissionChecker);
            await useCase.execute(companyId, userId, id);
            res.status(200).json({ success: true, message: 'Fiscal year deleted successfully' });
        }
        catch (err) {
            next(err);
        }
    }
    static async autoCreateRetainedEarnings(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const useCase = new FiscalYearUseCases_1.AutoCreateRetainedEarningsUseCase(bindRepositories_1.diContainer.accountRepository, permissionChecker);
            const result = await useCase.execute(companyId, userId);
            res.status(200).json({ success: true, data: result });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.FiscalYearController = FiscalYearController;
//# sourceMappingURL=FiscalYearController.js.map