"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingReportsController = void 0;
const ReportingUseCases_1 = require("../../../application/accounting/use-cases/ReportingUseCases");
const LedgerUseCases_1 = require("../../../application/accounting/use-cases/LedgerUseCases");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ApiError_1 = require("../../errors/ApiError");
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
class AccountingReportsController {
    static async getTrialBalance(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            if (!companyId)
                throw ApiError_1.ApiError.badRequest('Company Context Missing');
            if (!userId)
                throw ApiError_1.ApiError.unauthorized('User missing');
            const useCase = new ReportingUseCases_1.GetTrialBalanceUseCase(bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.voucherRepository, permissionChecker);
            const report = await useCase.execute(companyId, userId);
            res.status(200).json({
                success: true,
                data: report,
                meta: {
                    generatedAt: new Date().toISOString()
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getGeneralLedger(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            if (!companyId)
                throw ApiError_1.ApiError.badRequest('Company Context Missing');
            if (!userId)
                throw ApiError_1.ApiError.unauthorized('User missing');
            const { accountId, from, to } = req.query;
            const useCase = new ReportingUseCases_1.GetGeneralLedgerUseCase(bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.userRepository, permissionChecker);
            const report = await useCase.execute(companyId, userId, {
                accountId: accountId,
                fromDate: from,
                toDate: to,
            });
            res.status(200).json({
                success: true,
                data: report,
                meta: {
                    generatedAt: new Date().toISOString(),
                    filters: { accountId, from, to }
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getBalanceSheet(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            if (!companyId)
                throw ApiError_1.ApiError.badRequest('Company Context Missing');
            if (!userId)
                throw ApiError_1.ApiError.unauthorized('User missing');
            const asOfDate = req.query.asOfDate || new Date().toISOString().split('T')[0];
            const useCase = new LedgerUseCases_1.GetBalanceSheetUseCase(bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.accountRepository, permissionChecker, bindRepositories_1.diContainer.companyRepository);
            const report = await useCase.execute(companyId, userId, asOfDate);
            res.status(200).json({
                success: true,
                data: report,
                meta: {
                    generatedAt: new Date().toISOString(),
                    asOfDate
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async getAccountStatement(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            if (!companyId)
                throw ApiError_1.ApiError.badRequest('Company Context Missing');
            if (!userId)
                throw ApiError_1.ApiError.unauthorized('User missing');
            const { accountId, fromDate, toDate } = req.query;
            if (!accountId) {
                return res.status(400).json({ error: 'accountId is required' });
            }
            const useCase = new LedgerUseCases_1.GetAccountStatementUseCase(bindRepositories_1.diContainer.ledgerRepository, permissionChecker);
            const report = await useCase.execute(companyId, userId, accountId, fromDate || '', toDate || '');
            res.status(200).json({
                success: true,
                data: report,
                meta: {
                    generatedAt: new Date().toISOString(),
                    filters: { accountId, fromDate, toDate }
                }
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AccountingReportsController = AccountingReportsController;
//# sourceMappingURL=AccountingReportsController.js.map