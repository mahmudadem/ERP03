"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyRolesController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ListCompanyRolesUseCase_1 = require("../../../application/company-admin/use-cases/ListCompanyRolesUseCase");
const GetCompanyRoleUseCase_1 = require("../../../application/company-admin/use-cases/GetCompanyRoleUseCase");
const CreateCompanyRoleUseCase_1 = require("../../../application/company-admin/use-cases/CreateCompanyRoleUseCase");
const UpdateCompanyRoleUseCase_1 = require("../../../application/company-admin/use-cases/UpdateCompanyRoleUseCase");
const DeleteCompanyRoleUseCase_1 = require("../../../application/company-admin/use-cases/DeleteCompanyRoleUseCase");
/**
 * CompanyRolesController
 * Handles company role management operations
 */
class CompanyRolesController {
    /**
     * GET /company-admin/roles
     * List company roles
     */
    static async listRoles(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            const useCase = new ListCompanyRolesUseCase_1.ListCompanyRolesUseCase(bindRepositories_1.diContainer.companyRoleRepository);
            const result = await useCase.execute({ companyId });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /company-admin/roles/:roleId
     * Get role details
     */
    static async getRole(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            const { roleId } = req.params;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            const useCase = new GetCompanyRoleUseCase_1.GetCompanyRoleUseCase(bindRepositories_1.diContainer.companyRoleRepository);
            const role = await useCase.execute(companyId, roleId);
            if (!role) {
                res.status(404).json({ success: false, error: 'Role not found' });
                return;
            }
            res.json({ success: true, data: role });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /company-admin/roles/create
     * Create new role
     */
    static async createRole(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            const { name, description, permissions } = req.body;
            const useCase = new CreateCompanyRoleUseCase_1.CreateCompanyRoleUseCase(bindRepositories_1.diContainer.companyRoleRepository);
            const role = await useCase.execute({
                companyId,
                name,
                description,
                permissions
            });
            res.json({ success: true, data: role });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /company-admin/roles/:roleId/update
     * Update role
     */
    static async updateRole(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            const { roleId } = req.params;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            const { name, description, permissions } = req.body;
            const useCase = new UpdateCompanyRoleUseCase_1.UpdateCompanyRoleUseCase(bindRepositories_1.diContainer.companyRoleRepository);
            await useCase.execute({
                companyId,
                roleId,
                name,
                description,
                permissions
            });
            res.json({ success: true, message: 'Role updated successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * DELETE /company-admin/roles/:roleId
     * Delete role
     */
    static async deleteRole(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            const { roleId } = req.params;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            const useCase = new DeleteCompanyRoleUseCase_1.DeleteCompanyRoleUseCase(bindRepositories_1.diContainer.companyRoleRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository);
            await useCase.execute(companyId, roleId);
            res.json({ success: true, message: 'Role deleted successfully' });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CompanyRolesController = CompanyRolesController;
//# sourceMappingURL=CompanyRolesController.js.map