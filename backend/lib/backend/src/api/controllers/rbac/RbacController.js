"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RbacController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const CreateCompanyRoleUseCase_1 = require("../../../application/rbac/use-cases/CreateCompanyRoleUseCase");
const UpdateCompanyRoleUseCase_1 = require("../../../application/rbac/use-cases/UpdateCompanyRoleUseCase");
const DeleteCompanyRoleUseCase_1 = require("../../../application/rbac/use-cases/DeleteCompanyRoleUseCase");
const DeleteCompanyUserUseCase_1 = require("../../../application/company-admin/use-cases/DeleteCompanyUserUseCase");
const AssignRoleToCompanyUserUseCase_1 = require("../../../application/rbac/use-cases/AssignRoleToCompanyUserUseCase");
const ListCompanyRolesUseCase_1 = require("../../../application/rbac/use-cases/ListCompanyRolesUseCase");
const ListCompanyUsersWithRolesUseCase_1 = require("../../../application/rbac/use-cases/ListCompanyUsersWithRolesUseCase");
const GetCurrentUserPermissionsForCompanyUseCase_1 = require("../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase");
const PermissionChecker_1 = require("../../../application/rbac/PermissionChecker");
const ApiError_1 = require("../../errors/ApiError");
const CompanyRolePermissionResolver_1 = require("../../../application/rbac/CompanyRolePermissionResolver");
const resolver = new CompanyRolePermissionResolver_1.CompanyRolePermissionResolver(bindRepositories_1.diContainer.modulePermissionsDefinitionRepository, bindRepositories_1.diContainer.companyRoleRepository);
class RbacController {
    static getPermissionChecker() {
        const getPermissionsUC = new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository);
        return new PermissionChecker_1.PermissionChecker(getPermissionsUC);
    }
    static async getPermissions(req, res, next) {
        try {
            const repo = bindRepositories_1.diContainer.rbacPermissionRepository;
            const permissions = await repo.getAll();
            res.json({ success: true, data: permissions });
        }
        catch (error) {
            next(error);
        }
    }
    static async getSystemRoleTemplates(req, res, next) {
        try {
            const repo = bindRepositories_1.diContainer.systemRoleTemplateRepository;
            const templates = await repo.getAll();
            res.json({ success: true, data: templates });
        }
        catch (error) {
            next(error);
        }
    }
    static async createCompanyRole(req, res, next) {
        try {
            const companyId = req.params.companyId;
            const actorId = req.user.uid;
            const useCase = new CreateCompanyRoleUseCase_1.CreateCompanyRoleUseCase(bindRepositories_1.diContainer.companyRoleRepository, RbacController.getPermissionChecker());
            const role = await useCase.execute(Object.assign({ companyId,
                actorId }, req.body));
            await resolver.resolveRoleById(companyId, role.id);
            const saved = await bindRepositories_1.diContainer.companyRoleRepository.getById(companyId, role.id);
            res.status(201).json({ success: true, data: saved });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateCompanyRole(req, res, next) {
        try {
            const { companyId, roleId } = req.params;
            const actorId = req.user.uid;
            const useCase = new UpdateCompanyRoleUseCase_1.UpdateCompanyRoleUseCase(bindRepositories_1.diContainer.companyRoleRepository, RbacController.getPermissionChecker());
            await useCase.execute({
                companyId,
                roleId,
                actorId,
                updates: req.body
            });
            await resolver.resolveRoleById(companyId, roleId);
            const saved = await bindRepositories_1.diContainer.companyRoleRepository.getById(companyId, roleId);
            res.json({ success: true, message: 'Role updated', data: saved });
        }
        catch (error) {
            next(error);
        }
    }
    static async deleteCompanyRole(req, res, next) {
        try {
            const { companyId, roleId } = req.params;
            const actorId = req.user.uid;
            const useCase = new DeleteCompanyRoleUseCase_1.DeleteCompanyRoleUseCase(bindRepositories_1.diContainer.companyRoleRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, RbacController.getPermissionChecker());
            await useCase.execute({ companyId, roleId, actorId });
            res.json({ success: true, message: 'Role deleted' });
        }
        catch (error) {
            next(error);
        }
    }
    static async listCompanyRoles(req, res, next) {
        try {
            const companyId = req.params.companyId;
            const actorId = req.user.uid;
            const useCase = new ListCompanyRolesUseCase_1.ListCompanyRolesUseCase(bindRepositories_1.diContainer.companyRoleRepository, RbacController.getPermissionChecker());
            const roles = await useCase.execute({ companyId, actorId });
            res.json({ success: true, data: roles });
        }
        catch (error) {
            next(error);
        }
    }
    static async listCompanyUsers(req, res, next) {
        try {
            const companyId = req.params.companyId;
            const actorId = req.user.uid;
            const useCase = new ListCompanyUsersWithRolesUseCase_1.ListCompanyUsersWithRolesUseCase(bindRepositories_1.diContainer.rbacCompanyUserRepository, RbacController.getPermissionChecker());
            const users = await useCase.execute({ companyId, actorId });
            res.json({ success: true, data: users });
        }
        catch (error) {
            next(error);
        }
    }
    static async assignRoleToUser(req, res, next) {
        try {
            const { companyId, uid } = req.params;
            const { roleId } = req.body;
            const actorId = req.user.uid;
            const useCase = new AssignRoleToCompanyUserUseCase_1.AssignRoleToCompanyUserUseCase(bindRepositories_1.diContainer.rbacCompanyUserRepository, RbacController.getPermissionChecker());
            await useCase.execute({
                companyId,
                targetUserId: uid,
                roleId,
                actorId
            });
            res.json({ success: true, message: 'Role assigned' });
        }
        catch (error) {
            next(error);
        }
    }
    static async removeUserFromCompany(req, res, next) {
        try {
            const { companyId, userId } = req.params;
            const useCase = new DeleteCompanyUserUseCase_1.DeleteCompanyUserUseCase(bindRepositories_1.diContainer.rbacCompanyUserRepository);
            await useCase.execute({ companyId, userId });
            res.json({ success: true, message: 'User removed' });
        }
        catch (error) {
            next(error);
        }
    }
    static async getCurrentUserPermissions(req, res, next) {
        try {
            const companyId = req.query.companyId;
            const userId = req.user.uid;
            if (!companyId)
                throw ApiError_1.ApiError.badRequest('Company ID is required');
            const useCase = new GetCurrentUserPermissionsForCompanyUseCase_1.GetCurrentUserPermissionsForCompanyUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository);
            const permissions = await useCase.execute({ userId, companyId });
            res.json({ success: true, data: permissions });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.RbacController = RbacController;
//# sourceMappingURL=RbacController.js.map