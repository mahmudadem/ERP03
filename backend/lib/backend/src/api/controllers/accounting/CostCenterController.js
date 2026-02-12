"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CostCenterController = void 0;
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const CostCenterUseCases_1 = require("../../../application/accounting/use-cases/CostCenterUseCases");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const permissionChecker = new PermissionChecker_1.PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository));
class CostCenterController {
    static async list(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const useCase = new CostCenterUseCases_1.ListCostCentersUseCase(bindRepositories_1.diContainer.costCenterRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async getById(req, res, next) {
        var _a;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const { id } = req.params;
            const cc = await bindRepositories_1.diContainer.costCenterRepository.findById(companyId, id);
            if (!cc)
                return res.status(404).json({ error: 'Not found' });
            res.status(200).json({ success: true, data: cc });
        }
        catch (err) {
            next(err);
        }
    }
    static async create(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const useCase = new CostCenterUseCases_1.CreateCostCenterUseCase(bindRepositories_1.diContainer.costCenterRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId, req.body);
            res.status(201).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async update(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const useCase = new CostCenterUseCases_1.UpdateCostCenterUseCase(bindRepositories_1.diContainer.costCenterRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId, id, req.body);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
    static async deactivate(req, res, next) {
        var _a, _b;
        try {
            const companyId = req.companyId || ((_a = req.user) === null || _a === void 0 ? void 0 : _a.companyId);
            const userId = (_b = req.user) === null || _b === void 0 ? void 0 : _b.uid;
            const { id } = req.params;
            const useCase = new CostCenterUseCases_1.DeactivateCostCenterUseCase(bindRepositories_1.diContainer.costCenterRepository, permissionChecker);
            const data = await useCase.execute(companyId, userId, id);
            res.status(200).json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.CostCenterController = CostCenterController;
//# sourceMappingURL=CostCenterController.js.map