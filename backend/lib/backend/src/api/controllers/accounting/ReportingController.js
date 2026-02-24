"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportingController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const LedgerUseCases_1 = require("../../../application/accounting/use-cases/LedgerUseCases");
const GetProfitAndLossUseCase_1 = require("../../../application/reporting/use-cases/GetProfitAndLossUseCase");
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
class ReportingController {
    static async profitAndLoss(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            // DEBUG LOGGING
            console.log('🔍 P&L Request:', {
                companyId,
                userId,
                from: req.query.from,
                to: req.query.to,
                user: req.user
            });
            const fromDate = typeof req.query.from === 'string'
                ? req.query.from
                : `${new Date().getFullYear()}-01-01`;
            const toDate = typeof req.query.to === 'string'
                ? req.query.to
                : new Date().toISOString().slice(0, 10);
            const useCase = new GetProfitAndLossUseCase_1.GetProfitAndLossUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.accountRepository, permissionChecker);
            const data = await useCase.execute({
                companyId,
                userId,
                fromDate,
                toDate
            });
            console.log('✅ P&L Result:', { revenue: data.revenue, expenses: data.expenses, netProfit: data.netProfit });
            res.json({ success: true, data });
        }
        catch (err) {
            console.error('❌ P&L Error:', err);
            next(err);
        }
    }
    static async trialBalance(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const asOfDate = String(req.query.asOfDate || new Date().toISOString().split('T')[0]);
            const includeZeroBalance = req.query.includeZeroBalance === 'true';
            const useCase = new LedgerUseCases_1.GetTrialBalanceUseCase(bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.accountRepository, permissionChecker);
            const result = await useCase.execute(companyId, userId, asOfDate, includeZeroBalance);
            res.json({ success: true, data: { rows: result.data, meta: result.meta } });
        }
        catch (err) {
            next(err);
        }
    }
    static async generalLedger(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const filters = {
                accountId: req.query.accountId,
                fromDate: req.query.fromDate,
                toDate: req.query.toDate,
            };
            const useCase = new LedgerUseCases_1.GetGeneralLedgerUseCase(bindRepositories_1.diContainer.ledgerRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId, filters);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async journal(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const filters = {
                fromDate: req.query.fromDate,
                toDate: req.query.toDate,
                voucherType: req.query.voucherType,
            };
            const useCase = new LedgerUseCases_1.GetJournalUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.accountRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId, filters);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.ReportingController = ReportingController;
//# sourceMappingURL=ReportingController.js.map