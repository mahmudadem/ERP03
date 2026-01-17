
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { CreateCompanyRoleUseCase } from '../../../application/rbac/use-cases/CreateCompanyRoleUseCase';
import { UpdateCompanyRoleUseCase } from '../../../application/rbac/use-cases/UpdateCompanyRoleUseCase';
import { DeleteCompanyRoleUseCase } from '../../../application/rbac/use-cases/DeleteCompanyRoleUseCase';
import { DeleteCompanyUserUseCase } from '../../../application/company-admin/use-cases/DeleteCompanyUserUseCase';
import { AssignRoleToCompanyUserUseCase } from '../../../application/rbac/use-cases/AssignRoleToCompanyUserUseCase';
import { ListCompanyRolesUseCase } from '../../../application/rbac/use-cases/ListCompanyRolesUseCase';
import { ListCompanyUsersWithRolesUseCase } from '../../../application/rbac/use-cases/ListCompanyUsersWithRolesUseCase';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { ApiError } from '../../errors/ApiError';
import { CompanyRolePermissionResolver } from '../../../application/rbac/CompanyRolePermissionResolver';

const resolver = new CompanyRolePermissionResolver(
  diContainer.modulePermissionsDefinitionRepository,
  diContainer.companyRoleRepository
);

export class RbacController {

  private static getPermissionChecker() {
    const getPermissionsUC = new GetCurrentUserPermissionsForCompanyUseCase(
      diContainer.userRepository,
      diContainer.rbacCompanyUserRepository,
      diContainer.companyRoleRepository
    );
    return new PermissionChecker(getPermissionsUC);
  }

  static async getPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const repo = diContainer.rbacPermissionRepository;
      const permissions = await repo.getAll();
      res.json({ success: true, data: permissions });
    } catch (error) {
      next(error);
    }
  }

  static async getSystemRoleTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const repo = diContainer.systemRoleTemplateRepository;
      const templates = await repo.getAll();
      res.json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  }

  static async createCompanyRole(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).params.companyId;
      const actorId = (req as any).user.uid;

      const useCase = new CreateCompanyRoleUseCase(
        diContainer.companyRoleRepository,
        RbacController.getPermissionChecker()
      );

      const role = await useCase.execute({
        companyId,
        actorId,
        ...req.body
      });

      await resolver.resolveRoleById(companyId, role.id);
      const saved = await diContainer.companyRoleRepository.getById(companyId, role.id);

      res.status(201).json({ success: true, data: saved });
    } catch (error) {
      next(error);
    }
  }

  static async updateCompanyRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, roleId } = (req as any).params;
      const actorId = (req as any).user.uid;

      const useCase = new UpdateCompanyRoleUseCase(
        diContainer.companyRoleRepository,
        RbacController.getPermissionChecker()
      );

      await useCase.execute({
        companyId,
        roleId,
        actorId,
        updates: req.body
      });

      await resolver.resolveRoleById(companyId, roleId);
      const saved = await diContainer.companyRoleRepository.getById(companyId, roleId);

      res.json({ success: true, message: 'Role updated', data: saved });
    } catch (error) {
      next(error);
    }
  }

  static async deleteCompanyRole(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, roleId } = (req as any).params;
      const actorId = (req as any).user.uid;

      const useCase = new DeleteCompanyRoleUseCase(
        diContainer.companyRoleRepository,
        diContainer.rbacCompanyUserRepository,
        RbacController.getPermissionChecker()
      );

      await useCase.execute({ companyId, roleId, actorId });

      res.json({ success: true, message: 'Role deleted' });
    } catch (error) {
      next(error);
    }
  }

  static async listCompanyRoles(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).params.companyId;
      const actorId = (req as any).user.uid;

      const useCase = new ListCompanyRolesUseCase(
        diContainer.companyRoleRepository,
        RbacController.getPermissionChecker()
      );

      const roles = await useCase.execute({ companyId, actorId });
      res.json({ success: true, data: roles });
    } catch (error) {
      next(error);
    }
  }

  static async listCompanyUsers(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).params.companyId;
      const actorId = (req as any).user.uid;

      const useCase = new ListCompanyUsersWithRolesUseCase(
        diContainer.rbacCompanyUserRepository,
        RbacController.getPermissionChecker()
      );

      const users = await useCase.execute({ companyId, actorId });
      res.json({ success: true, data: users });
    } catch (error) {
      next(error);
    }
  }

  static async assignRoleToUser(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, uid } = (req as any).params;
      const { roleId } = (req as any).body;
      const actorId = (req as any).user.uid;

      const useCase = new AssignRoleToCompanyUserUseCase(
        diContainer.rbacCompanyUserRepository,
        RbacController.getPermissionChecker()
      );

      await useCase.execute({
        companyId,
        targetUserId: uid,
        roleId,
        actorId
      });

      res.json({ success: true, message: 'Role assigned' });
    } catch (error) {
      next(error);
    }
  }

  static async removeUserFromCompany(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, userId } = (req as any).params;
      const useCase = new DeleteCompanyUserUseCase(diContainer.rbacCompanyUserRepository);
      await useCase.execute({ companyId, userId });
      res.json({ success: true, message: 'User removed' });
    } catch (error) {
      next(error);
    }
  }

  static async getCurrentUserPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).query.companyId as string;
      const userId = (req as any).user.uid;

      if (!companyId) throw ApiError.badRequest('Company ID is required');

      const useCase = new GetCurrentUserPermissionsForCompanyUseCase(
        diContainer.userRepository,
        diContainer.rbacCompanyUserRepository,
        diContainer.companyRoleRepository
      );

      const permissions = await useCase.execute({ userId, companyId });
      res.json({ success: true, data: permissions });
    } catch (error) {
      next(error);
    }
  }
}
