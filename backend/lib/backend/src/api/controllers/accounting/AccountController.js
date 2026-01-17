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
const AccountValidationService_1 = require("../../../application/accounting/services/AccountValidationService");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
class AccountController {
    static async list(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            await permissionChecker.assertOrThrow(userId, companyId, 'accounting.accounts.view');
            const useCase = new ListAccountsUseCase_1.ListAccountsUseCase(bindRepositories_1.diContainer.accountRepository);
            const accounts = await useCase.execute(companyId);
            return res.json({ success: true, data: accounts });
        }
        catch (err) {
            return next(err);
        }
    }
    /**
     * Get valid accounts for voucher entry
     * Only returns leaf accounts that pass all validation rules
     */
    static async getValid(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const voucherType = req.query.voucherType;
            await permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
            const validationService = new AccountValidationService_1.AccountValidationService(bindRepositories_1.diContainer.accountRepository);
            const validAccounts = await validationService.getValidAccounts(companyId, userId, voucherType);
            return res.json({ success: true, data: validAccounts });
        }
        catch (err) {
            return next(err);
        }
    }
    /**
     * Resolve account code to account object and validate
     */
    static async resolveCode(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const { code } = req.params;
            const voucherType = req.query.voucherType;
            await permissionChecker.assertOrThrow(userId, companyId, 'accounting.vouchers.create');
            const validationService = new AccountValidationService_1.AccountValidationService(bindRepositories_1.diContainer.accountRepository);
            const account = await validationService.resolveAndValidate(companyId, userId, code, voucherType);
            return res.json({ success: true, data: account });
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
            await permissionChecker.assertOrThrow(userId, companyId, 'accounting.accounts.view');
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
            await permissionChecker.assertOrThrow(userId, companyId, 'accounting.accounts.manage');
            const useCase = new CreateAccountUseCase_1.CreateAccountUseCase(bindRepositories_1.diContainer.accountRepository);
            const account = await useCase.execute(companyId, Object.assign(Object.assign({}, req.body), { createdBy: userId }));
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
            await permissionChecker.assertOrThrow(userId, companyId, 'accounting.accounts.manage');
            const useCase = new UpdateAccountUseCase_1.UpdateAccountUseCase(bindRepositories_1.diContainer.accountRepository);
            const account = await useCase.execute(companyId, id, Object.assign(Object.assign({}, req.body), { updatedBy: userId }));
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
            await permissionChecker.assertOrThrow(userId, companyId, 'accounting.accounts.manage');
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