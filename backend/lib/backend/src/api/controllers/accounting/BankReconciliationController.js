"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BankReconciliationController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const BankReconciliationUseCases_1 = require("../../../application/accounting/use-cases/BankReconciliationUseCases");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
const useCases = new BankReconciliationUseCases_1.BankReconciliationUseCases(bindRepositories_1.diContainer.bankStatementRepository, bindRepositories_1.diContainer.reconciliationRepository, bindRepositories_1.diContainer.ledgerRepository, bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.companyRepository, permissionChecker);
class BankReconciliationController {
    static async import(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const data = await useCases.importStatement(companyId, userId, req.body);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async listStatements(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const accountId = req.query.accountId;
            const data = await useCases.listStatements(companyId, userId, accountId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async getReconciliation(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const accountId = req.params.accountId;
            const data = await useCases.getReconciliation(companyId, userId, accountId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async manualMatch(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { statementId, lineId, ledgerEntryId } = req.body;
            const data = await useCases.manualMatch(companyId, userId, statementId, lineId, ledgerEntryId);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
    static async complete(req, res, next) {
        var _a, _b;
        try {
            const companyId = ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId) || req.companyId;
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const accountId = req.params.accountId;
            const { statementId, adjustments } = req.body;
            const data = await useCases.complete(companyId, userId, accountId, statementId, adjustments);
            res.status(200).json({ success: true, data });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.BankReconciliationController = BankReconciliationController;
//# sourceMappingURL=BankReconciliationController.js.map