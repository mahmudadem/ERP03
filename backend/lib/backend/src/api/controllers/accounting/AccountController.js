"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ListAccountsUseCase_1 = require("../../../application/accounting/use-cases/accounts/ListAccountsUseCase");
const GetAccountUseCase_1 = require("../../../application/accounting/use-cases/accounts/GetAccountUseCase");
const CreateAccountUseCase_1 = require("../../../application/accounting/use-cases/accounts/CreateAccountUseCase");
const UpdateAccountUseCase_1 = require("../../../application/accounting/use-cases/accounts/UpdateAccountUseCase");
const DeactivateAccountUseCase_1 = require("../../../application/accounting/use-cases/accounts/DeactivateAccountUseCase");
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
class AccountController {
    static async list(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            await permissionChecker.assertOrThrow(userId, companyId, 'coa.view');
            const useCase = new ListAccountsUseCase_1.ListAccountsUseCase(bindRepositories_1.diContainer.accountRepository);
            const accounts = await useCase.execute(companyId);
            return res.json({ success: true, data: accounts });
        }
        catch (err) {
            return next(err);
        }
    }
    static async getById(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const { id } = req.params;
            await permissionChecker.assertOrThrow(userId, companyId, 'coa.view');
            const useCase = new GetAccountUseCase_1.GetAccountUseCase(bindRepositories_1.diContainer.accountRepository);
            const account = await useCase.execute(companyId, id);
            if (!account) {
                return res.status(404).json({ success: false, error: 'Account not found' });
            }
            return res.json({ success: true, data: account });
        }
        catch (err) {
            return next(err);
        }
    }
    static async create(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            await permissionChecker.assertOrThrow(userId, companyId, 'coa.edit');
            const useCase = new CreateAccountUseCase_1.CreateAccountUseCase(bindRepositories_1.diContainer.accountRepository);
            const account = await useCase.execute(companyId, req.body);
            return res.json({ success: true, data: account });
        }
        catch (err) {
            return next(err);
        }
    }
    static async update(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const { id } = req.params;
            await permissionChecker.assertOrThrow(userId, companyId, 'coa.edit');
            const useCase = new UpdateAccountUseCase_1.UpdateAccountUseCase(bindRepositories_1.diContainer.accountRepository);
            const account = await useCase.execute(companyId, id, req.body);
            return res.json({ success: true, data: account });
        }
        catch (err) {
            return next(err);
        }
    }
    static async deactivate(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const { id } = req.params;
            await permissionChecker.assertOrThrow(userId, companyId, 'coa.edit');
            const useCase = new DeactivateAccountUseCase_1.DeactivateAccountUseCase(bindRepositories_1.diContainer.accountRepository);
            await useCase.execute(companyId, id);
            return res.json({ success: true });
        }
        catch (err) {
            return next(err);
        }
    }
}
exports.AccountController = AccountController;
//# sourceMappingURL=AccountController.js.map