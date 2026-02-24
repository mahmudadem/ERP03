"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingReportsController = void 0;
const ReportingUseCases_1 = require("../../../application/accounting/use-cases/ReportingUseCases");
const LedgerUseCases_1 = require("../../../application/accounting/use-cases/LedgerUseCases");
const CashFlowUseCases_1 = require("../../../application/accounting/use-cases/CashFlowUseCases");
const AgingReportUseCase_1 = require("../../../application/accounting/use-cases/AgingReportUseCase");
const CostCenterSummaryUseCase_1 = require("../../../application/accounting/use-cases/CostCenterSummaryUseCase");
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
            const asOfDate = req.query.asOfDate || new Date().toISOString().split('T')[0];
            const includeZeroBalance = req.query.includeZeroBalance === 'true';
            const useCase = new LedgerUseCases_1.GetTrialBalanceUseCase(bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.accountRepository, permissionChecker);
            const result = await useCase.execute(companyId, userId, asOfDate, includeZeroBalance);
            res.status(200).json({
                success: true,
                data: {
                    rows: result.data,
                    meta: result.meta
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
            const { accountId, from, to, limit, offset, costCenterId } = req.query;
            const useCase = new ReportingUseCases_1.GetGeneralLedgerUseCase(bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.userRepository, permissionChecker, bindRepositories_1.diContainer.costCenterRepository);
            const result = await useCase.execute(companyId, userId, {
                accountId: accountId,
                fromDate: from,
                toDate: to,
                costCenterId: costCenterId,
                limit: limit ? parseInt(limit, 10) : undefined,
                offset: offset ? parseInt(offset, 10) : undefined
            });
            res.status(200).json({
                success: true,
                data: result.data,
                meta: {
                    generatedAt: new Date().toISOString(),
                    filters: { accountId, from, to },
                    pagination: {
                        totalItems: result.metadata.totalItems,
                        openingBalance: result.metadata.openingBalance
                    }
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
            const { accountId, fromDate, toDate, includeUnposted } = req.query;
            if (!accountId) {
                return res.status(400).json({ error: 'accountId is required' });
            }
            const useCase = new LedgerUseCases_1.GetAccountStatementUseCase(bindRepositories_1.diContainer.ledgerRepository, permissionChecker);
            const report = await useCase.execute(companyId, userId, accountId, fromDate || '', toDate || '', { includeUnposted: includeUnposted === 'true' });
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
    static async getDashboardSummary(req, res, next) {
        var _a, _b, _c, _d;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            if (!companyId)
                throw ApiError_1.ApiError.badRequest('Company Context Missing');
            if (!userId)
                throw ApiError_1.ApiError.unauthorized('User missing');
            const today = new Date();
            const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];
            const [counts, recent, trialBalance, accounts, fiscal] = await Promise.all([
                bindRepositories_1.diContainer.voucherRepository.getCounts(companyId, monthStart, monthEnd),
                bindRepositories_1.diContainer.voucherRepository.getRecent(companyId, 10),
                bindRepositories_1.diContainer.ledgerRepository.getTrialBalance(companyId, monthEnd),
                bindRepositories_1.diContainer.accountRepository.list(companyId),
                bindRepositories_1.diContainer.fiscalYearRepository.findActiveForDate(companyId, monthEnd).catch(() => null)
            ]);
            const cashAccounts = new Set(accounts.filter((a) => ['CASH', 'BANK'].includes((a.accountRole || '').toUpperCase())).map((a) => a.id));
            const cashPosition = trialBalance
                .filter((r) => cashAccounts.has(r.accountId))
                .reduce((sum, r) => sum + (r.debit || 0) - (r.credit || 0), 0);
            const recentDtos = recent.map((v) => ({
                id: v.id,
                voucherNo: v.voucherNo,
                date: v.date,
                type: v.type,
                status: v.status,
                amount: Math.max(v.totalDebit, v.totalCredit),
                posted: !!v.postedAt
            }));
            const response = {
                vouchers: counts,
                cashPosition,
                recentVouchers: recentDtos,
                unbalancedDrafts: counts.unbalancedDrafts,
                fiscalPeriodStatus: ((_c = fiscal === null || fiscal === void 0 ? void 0 : fiscal.getPeriodForDate(monthEnd)) === null || _c === void 0 ? void 0 : _c.status) || null,
                baseCurrency: ((_d = (await bindRepositories_1.diContainer.companyRepository.findById(companyId).catch(() => null))) === null || _d === void 0 ? void 0 : _d.baseCurrency) || ''
            };
            res.status(200).json({ success: true, data: response });
        }
        catch (error) {
            next(error);
        }
    }
    static async getCashFlow(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            if (!companyId)
                throw ApiError_1.ApiError.badRequest('Company Context Missing');
            if (!userId)
                throw ApiError_1.ApiError.unauthorized('User missing');
            const { from, to } = req.query;
            const useCase = new CashFlowUseCases_1.GetCashFlowStatementUseCase(bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId, from || '', to || '');
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async getAgingReport(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            if (!companyId)
                throw ApiError_1.ApiError.badRequest('Company Context Missing');
            if (!userId)
                throw ApiError_1.ApiError.unauthorized('User missing');
            const { type = 'AR', asOfDate, accountId } = req.query;
            const useCase = new AgingReportUseCase_1.AgingReportUseCase(bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.accountRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId, type || 'AR', asOfDate || new Date().toISOString().slice(0, 10), accountId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async getCostCenterSummary(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            if (!companyId)
                throw ApiError_1.ApiError.badRequest('Company Context Missing');
            if (!userId)
                throw ApiError_1.ApiError.unauthorized('User missing');
            const { costCenterId, from, to } = req.query;
            if (!costCenterId)
                throw ApiError_1.ApiError.badRequest('costCenterId is required');
            const useCase = new CostCenterSummaryUseCase_1.GetCostCenterSummaryUseCase(bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.costCenterRepository, permissionChecker);
            const result = await useCase.execute(companyId, userId, {
                costCenterId: costCenterId,
                fromDate: from,
                toDate: to,
            });
            res.status(200).json({
                success: true,
                data: result.rows,
                meta: result.meta
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AccountingReportsController = AccountingReportsController;
//# sourceMappingURL=AccountingReportsController.js.map