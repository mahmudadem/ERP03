import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { InviteCompanyUserUseCase } from '../../../application/company-admin/use-cases/InviteCompanyUserUseCase';
import { UpdateCompanyUserRoleUseCase } from '../../../application/company-admin/use-cases/UpdateCompanyUserRoleUseCase';
import { DisableCompanyUserUseCase } from '../../../application/company-admin/use-cases/DisableCompanyUserUseCase';
import { EnableCompanyUserUseCase } from '../../../application/company-admin/use-cases/EnableCompanyUserUseCase';
import { DeleteCompanyUserUseCase } from '../../../application/company-admin/use-cases/DeleteCompanyUserUseCase';
import { ApiError } from '../../errors/ApiError';

/**
 * CompanyUsersController
 * Handles company user management operations
 */
export class CompanyUsersController {

  /**
   * GET /company-admin/users
   * List company users
   */
  static async listUsers(req: Request, res: Response, next: NextFunction) {
    try {
      // Get company ID from tenant context
      const tenantContext = (req as any).tenantContext;
      if (!tenantContext || !tenantContext.companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company context not found'
        });
      }

      const companyId = tenantContext.companyId;

      // Fetch all company users
      const companyUsers = await diContainer.rbacCompanyUserRepository.getByCompany(companyId);

      // Enrich with user and role data
      const enrichedUsers = await Promise.all(
        companyUsers.map(async (companyUser) => {
          // Get user details
          const user = await diContainer.userRepository.getUserById(companyUser.userId);

          // Get role details
          const role = await diContainer.companyRoleRepository.getById(companyId, companyUser.roleId);

          // Parse name (assuming format "FirstName LastName")
          const nameParts = user?.name?.split(' ') || [];
          const firstName = nameParts[0] || '';
          const lastName = nameParts.slice(1).join(' ') || '';

          return {
            userId: companyUser.userId,
            email: user?.email || '',
            firstName,
            lastName,
            roleId: companyUser.roleId,
            roleName: role?.name || 'Unknown',
            isOwner: companyUser.isOwner || false,
            status: 'active', // TODO: Add status field to CompanyUser entity
            joinedAt: companyUser.createdAt
          };
        })
      );

      return res.status(200).json({
        success: true,
        data: enrichedUsers
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /company-admin/users/invite
   * Invite new user to company
   */
  static async inviteUser(req: Request, res: Response, next: NextFunction) {
    try {
      // Get company ID from tenant context
      const tenantContext = (req as any).tenantContext;
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
        throw ApiError.badRequest('Email is required');
      }

      if (!roleId || typeof roleId !== 'string') {
        throw ApiError.badRequest('Role ID is required');
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw ApiError.badRequest('Invalid email format');
      }

      // Execute use case
      const useCase = new InviteCompanyUserUseCase(
        diContainer.userRepository,
        diContainer.rbacCompanyUserRepository
      );

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
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /company-admin/users/:userId/update-role
   * Update user's role
   */
  static async updateUserRole(req: Request, res: Response, next: NextFunction) {
    try {
      // Get company ID from tenant context
      const tenantContext = (req as any).tenantContext;
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
        throw ApiError.badRequest('Role ID is required');
      }

      // Execute use case
      const useCase = new UpdateCompanyUserRoleUseCase(
        diContainer.rbacCompanyUserRepository,
        diContainer.companyRoleRepository
      );

      const result = await useCase.execute({
        companyId,
        userId,
        newRoleId
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /company-admin/users/:userId/disable
   * Disable user access
   */
  static async disableUser(req: Request, res: Response, next: NextFunction) {
    try {
      // Get company ID from tenant context
      const tenantContext = (req as any).tenantContext;
      if (!tenantContext || !tenantContext.companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company context not found'
        });
      }

      const companyId = tenantContext.companyId;
      const { userId } = req.params;

      // Execute use case
      const useCase = new DisableCompanyUserUseCase(
        diContainer.rbacCompanyUserRepository
      );

      const result = await useCase.execute({
        companyId,
        userId
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * POST /company-admin/users/:userId/enable
   * Enable user access
   */
  static async enableUser(req: Request, res: Response, next: NextFunction) {
    try {
      // Get company ID from tenant context
      const tenantContext = (req as any).tenantContext;
      if (!tenantContext || !tenantContext.companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company context not found'
        });
      }

      const companyId = tenantContext.companyId;
      const { userId } = req.params;

      // Execute use case
      const useCase = new EnableCompanyUserUseCase(
        diContainer.rbacCompanyUserRepository
      );

      const result = await useCase.execute({
        companyId,
        userId
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * DELETE /company-admin/users/:userId
   * Remove user from company
   */
  static async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      const tenantContext = (req as any).tenantContext;
      if (!tenantContext || !tenantContext.companyId) {
        return res.status(400).json({
          success: false,
          error: 'Company context not found'
        });
      }

      const companyId = tenantContext.companyId;
      const { userId } = req.params;

      const useCase = new DeleteCompanyUserUseCase(diContainer.rbacCompanyUserRepository);
      await useCase.execute({ companyId, userId });

      return res.status(200).json({ success: true });
    } catch (error) {
      return next(error);
    }
  }
}
