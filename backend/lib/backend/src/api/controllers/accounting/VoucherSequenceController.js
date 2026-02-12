"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherSequenceController = void 0;
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const VoucherSequenceUseCases_1 = require("../../../application/accounting/use-cases/VoucherSequenceUseCases");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
class VoucherSequenceController {
    static async list(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const useCase = new VoucherSequenceUseCases_1.ListVoucherSequencesUseCase(bindRepositories_1.diContainer.voucherSequenceRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async setNext(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { prefix, nextNumber, year } = req.body;
            const useCase = new VoucherSequenceUseCases_1.SetNextVoucherNumberUseCase(bindRepositories_1.diContainer.voucherSequenceRepository, permissionChecker);
            await useCase.execute(companyId, userId, prefix, Number(nextNumber), year ? Number(year) : undefined);
            res.status(200).json({ success: true });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.VoucherSequenceController = VoucherSequenceController;
//# sourceMappingURL=VoucherSequenceController.js.map