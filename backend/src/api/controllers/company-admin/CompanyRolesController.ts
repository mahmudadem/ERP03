import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListCompanyRolesUseCase } from '../../../application/company-admin/use-cases/ListCompanyRolesUseCase';
import { GetCompanyRoleUseCase } from '../../../application/company-admin/use-cases/GetCompanyRoleUseCase';
import { CreateCompanyRoleUseCase } from '../../../application/company-admin/use-cases/CreateCompanyRoleUseCase';
import { UpdateCompanyRoleUseCase } from '../../../application/company-admin/use-cases/UpdateCompanyRoleUseCase';
import { DeleteCompanyRoleUseCase } from '../../../application/company-admin/use-cases/DeleteCompanyRoleUseCase';

/**
 * CompanyRolesController
 * Handles company role management operations
 */
export class CompanyRolesController {

  /**
   * GET /company-admin/roles
   * List company roles
   */
  static async listRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const useCase = new ListCompanyRolesUseCase(diContainer.companyRoleRepository);
      const result = await useCase.execute({ companyId });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /company-admin/roles/:roleId
   * Get role details
   */
  static async getRole(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      const { roleId } = req.params;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const useCase = new GetCompanyRoleUseCase(diContainer.companyRoleRepository);
      const role = await useCase.execute(companyId, roleId);

      if (!role) {
        res.status(404).json({ success: false, error: 'Role not found' });
        return;
      }

      res.json({ success: true, data: role });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /company-admin/roles/create
   * Create new role
   */
  static async createRole(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const { name, description, permissions } = req.body;

      const useCase = new CreateCompanyRoleUseCase(diContainer.companyRoleRepository);
      const role = await useCase.execute({
        companyId,
        name,
        description,
        permissions
      });

      res.json({ success: true, data: role });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /company-admin/roles/:roleId/update
   * Update role
   */
  static async updateRole(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      const { roleId } = req.params;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const { name, description, permissions } = req.body;

      const useCase = new UpdateCompanyRoleUseCase(diContainer.companyRoleRepository);
      await useCase.execute({
        companyId,
        roleId,
        name,
        description,
        permissions
      });

      res.json({ success: true, message: 'Role updated successfully' });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /company-admin/roles/:roleId
   * Delete role
   */
  static async deleteRole(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      const { roleId } = req.params;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const useCase = new DeleteCompanyRoleUseCase(
        diContainer.companyRoleRepository,
        diContainer.rbacCompanyUserRepository
      );
      await useCase.execute(companyId, roleId);

      res.json({ success: true, message: 'Role deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}
