"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyUsersController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const InviteCompanyUserUseCase_1 = require("../../../application/company-admin/use-cases/InviteCompanyUserUseCase");
const UpdateCompanyUserRoleUseCase_1 = require("../../../application/company-admin/use-cases/UpdateCompanyUserRoleUseCase");
const DisableCompanyUserUseCase_1 = require("../../../application/company-admin/use-cases/DisableCompanyUserUseCase");
const EnableCompanyUserUseCase_1 = require("../../../application/company-admin/use-cases/EnableCompanyUserUseCase");
const ApiError_1 = require("../../errors/ApiError");
/**
 * CompanyUsersController
 * Handles company user management operations
 */
class CompanyUsersController {
    /**
     * GET /company-admin/users
     * List company users
     */
    static async listUsers(req, res, next) {
        try {
            // Get company ID from tenant context
            const tenantContext = req.tenantContext;
            if (!tenantContext || !tenantContext.companyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Company context not found'
                });
            }
            const companyId = tenantContext.companyId;
            // Fetch all company users
            const companyUsers = await bindRepositories_1.diContainer.rbacCompanyUserRepository.getByCompany(companyId);
            // Enrich with user and role data
            const enrichedUsers = await Promise.all(companyUsers.map(async (companyUser) => {
                var _a;
                // Get user details
                const user = await bindRepositories_1.diContainer.userRepository.getUserById(companyUser.userId);
                // Get role details
                const role = await bindRepositories_1.diContainer.companyRoleRepository.getById(companyId, companyUser.roleId);
                // Parse name (assuming format "FirstName LastName")
                const nameParts = ((_a = user === null || user === void 0 ? void 0 : user.name) === null || _a === void 0 ? void 0 : _a.split(' ')) || [];
                const firstName = nameParts[0] || '';
                const lastName = nameParts.slice(1).join(' ') || '';
                return {
                    userId: companyUser.userId,
                    email: (user === null || user === void 0 ? void 0 : user.email) || '',
                    firstName,
                    lastName,
                    roleId: companyUser.roleId,
                    roleName: (role === null || role === void 0 ? void 0 : role.name) || 'Unknown',
                    isOwner: companyUser.isOwner || false,
                    status: 'active',
                    joinedAt: companyUser.createdAt
                };
            }));
            return res.status(200).json({
                success: true,
                data: enrichedUsers
            });
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /company-admin/users/invite
     * Invite new user to company
     */
    static async inviteUser(req, res, next) {
        try {
            // Get company ID from tenant context
            const tenantContext = req.tenantContext;
            if (!tenantContext || !tenantContext.companyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Company context not found'
                });
            }
            const companyId = tenantContext.companyId;
            const { email, roleId, firstName, lastName } = req.body;
            // Validate input
            if (!email || typeof email !== 'string') {
                throw ApiError_1.ApiError.badRequest('Email is required');
            }
            if (!roleId || typeof roleId !== 'string') {
                throw ApiError_1.ApiError.badRequest('Role ID is required');
            }
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw ApiError_1.ApiError.badRequest('Invalid email format');
            }
            // Execute use case
            const useCase = new InviteCompanyUserUseCase_1.InviteCompanyUserUseCase(bindRepositories_1.diContainer.userRepository, bindRepositories_1.diContainer.rbacCompanyUserRepository);
            const invitation = await useCase.execute({
                companyId,
                email,
                roleId,
                firstName,
                lastName
            });
            return res.status(200).json({
                success: true,
                data: invitation
            });
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /company-admin/users/:userId/update-role
     * Update user's role
     */
    static async updateUserRole(req, res, next) {
        try {
            // Get company ID from tenant context
            const tenantContext = req.tenantContext;
            if (!tenantContext || !tenantContext.companyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Company context not found'
                });
            }
            const companyId = tenantContext.companyId;
            const { userId } = req.params;
            const { roleId: newRoleId } = req.body;
            // Validate input
            if (!newRoleId || typeof newRoleId !== 'string') {
                throw ApiError_1.ApiError.badRequest('Role ID is required');
            }
            // Execute use case
            const useCase = new UpdateCompanyUserRoleUseCase_1.UpdateCompanyUserRoleUseCase(bindRepositories_1.diContainer.rbacCompanyUserRepository, bindRepositories_1.diContainer.companyRoleRepository);
            const result = await useCase.execute({
                companyId,
                userId,
                newRoleId
            });
            return res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /company-admin/users/:userId/disable
     * Disable user access
     */
    static async disableUser(req, res, next) {
        try {
            // Get company ID from tenant context
            const tenantContext = req.tenantContext;
            if (!tenantContext || !tenantContext.companyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Company context not found'
                });
            }
            const companyId = tenantContext.companyId;
            const { userId } = req.params;
            // Execute use case
            const useCase = new DisableCompanyUserUseCase_1.DisableCompanyUserUseCase(bindRepositories_1.diContainer.rbacCompanyUserRepository);
            const result = await useCase.execute({
                companyId,
                userId
            });
            return res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            return next(error);
        }
    }
    /**
     * POST /company-admin/users/:userId/enable
     * Enable user access
     */
    static async enableUser(req, res, next) {
        try {
            // Get company ID from tenant context
            const tenantContext = req.tenantContext;
            if (!tenantContext || !tenantContext.companyId) {
                return res.status(400).json({
                    success: false,
                    error: 'Company context not found'
                });
            }
            const companyId = tenantContext.companyId;
            const { userId } = req.params;
            // Execute use case
            const useCase = new EnableCompanyUserUseCase_1.EnableCompanyUserUseCase(bindRepositories_1.diContainer.rbacCompanyUserRepository);
            const result = await useCase.execute({
                companyId,
                userId
            });
            return res.status(200).json({
                success: true,
                data: result
            });
        }
        catch (error) {
            return next(error);
        }
    }
}
exports.CompanyUsersController = CompanyUsersController;
//# sourceMappingURL=CompanyUsersController.js.map