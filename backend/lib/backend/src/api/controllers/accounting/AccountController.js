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
            const useCase = new CreateAccountUseCase_1.CreateAccountUseCase(bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.companyCurrencyRepository);
            const account = await useCase.execute(companyId, Object.assign(Object.assign({}, req.body), { createdBy: userId }));
            // Broaden Triggers: Send a notification when an account is created
            await bindRepositories_1.diContainer.notificationService.notify({
                companyId,
                recipientUserIds: [userId],
                type: 'INFO',
                category: 'SYSTEM',
                title: 'Account Created',
                message: `Account ${account.userCode || account.systemCode} (${account.name}) was successfully created.`,
                sourceModule: 'ACCOUNTING',
                sourceEntityType: 'Account',
                sourceEntityId: account.id,
                actionUrl: `/accounting/accounts`
            }).catch(err => console.error('Failed to dispatch account creation notification:', err));
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
            const useCase = new UpdateAccountUseCase_1.UpdateAccountUseCase(bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.companyCurrencyRepository);
            const account = await useCase.execute(companyId, id, Object.assign(Object.assign({}, req.body), { updatedBy: userId }));
            return res.json({ success: true, data: account });
        }
        catch (err) {
            return next(err);
        }
    }
    static async batchUpdateSubgroups(req, res, next) {
        var _a, _b, _c;
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const updates = Array.isArray((_a = req.body) === null || _a === void 0 ? void 0 : _a.updates) ? req.body.updates : [];
            await permissionChecker.assertOrThrow(userId, companyId, 'accounting.accounts.edit');
            const useCase = new UpdateAccountUseCase_1.UpdateAccountUseCase(bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.companyCurrencyRepository);
            let updated = 0;
            const errors = [];
            for (const item of updates) {
                const accountId = String((item === null || item === void 0 ? void 0 : item.accountId) || '').trim();
                if (!accountId) {
                    errors.push({ accountId: '', error: 'accountId is required' });
                    continue;
                }
                const command = { updatedBy: userId };
                if (Object.prototype.hasOwnProperty.call(item, 'plSubgroup')) {
                    command.plSubgroup = (_b = item.plSubgroup) !== null && _b !== void 0 ? _b : null;
                }
                if (Object.prototype.hasOwnProperty.call(item, 'equitySubgroup')) {
                    command.equitySubgroup = (_c = item.equitySubgroup) !== null && _c !== void 0 ? _c : null;
                }
                if (!Object.prototype.hasOwnProperty.call(item, 'plSubgroup') && !Object.prototype.hasOwnProperty.call(item, 'equitySubgroup')) {
                    errors.push({ accountId, error: 'No subgroup fields provided' });
                    continue;
                }
                try {
                    await useCase.execute(companyId, accountId, command);
                    updated += 1;
                }
                catch (error) {
                    errors.push({
                        accountId,
                        error: (error === null || error === void 0 ? void 0 : error.message) || 'Unknown error'
                    });
                }
            }
            return res.json({
                success: true,
                data: {
                    updated,
                    errors
                }
            });
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