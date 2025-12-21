"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const VoucherUseCases_1 = require("../../../application/accounting/use-cases/VoucherUseCases");
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
class VoucherController {
    static async list(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.ListVouchersUseCase(bindRepositories_1.diContainer.voucherRepository, permissionChecker);
            const vouchers = await useCase.execute(companyId, userId, req.query);
            res.json({ success: true, data: vouchers });
        }
        catch (err) {
            next(err);
        }
    }
    static async get(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.GetVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, permissionChecker);
            const voucher = await useCase.execute(companyId, userId, req.params.id);
            res.json({ success: true, data: voucher });
        }
        catch (err) {
            next(err);
        }
    }
    static async create(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.CreateVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.accountRepository, bindRepositories_1.diContainer.companyModuleSettingsRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker, bindRepositories_1.diContainer.transactionManager, bindRepositories_1.diContainer.voucherTypeDefinitionRepository);
            const voucher = await useCase.execute(companyId, userId, req.body);
            res.json({ success: true, data: voucher });
        }
        catch (err) {
            next(err);
        }
    }
    static async update(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.UpdateVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.accountRepository, permissionChecker);
            await useCase.execute(companyId, userId, req.params.id, req.body);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
    static async approve(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.ApproveVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker);
            await useCase.execute(companyId, userId, req.params.id);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
    static async lock(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.LockVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, permissionChecker);
            await useCase.execute(companyId, userId, req.params.id);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
    static async cancel(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const userId = req.user.uid;
            const useCase = new VoucherUseCases_1.CancelVoucherUseCase(bindRepositories_1.diContainer.voucherRepository, bindRepositories_1.diContainer.ledgerRepository, permissionChecker);
            await useCase.execute(companyId, userId, req.params.id);
            res.json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.VoucherController = VoucherController;
//# sourceMappingURL=VoucherController.js.map