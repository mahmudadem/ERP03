import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { RolePermissionResolver } from '../../../application/roles/RolePermissionResolver';

const resolver = new RolePermissionResolver(
  diContainer.modulePermissionsDefinitionRepository,
  diContainer.roleRepository
);

export class SystemRoleController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const roles = await diContainer.roleRepository.listSystemRoleTemplates
        ? await diContainer.roleRepository.listSystemRoleTemplates()
        : await diContainer.roleRepository.getCompanyRoles('');
      res.json({ success: true, data: roles });
    } catch (err) {
      next(err);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const role = await diContainer.roleRepository.getRole(req.params.roleId);
      res.json({ success: true, data: role });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, moduleBundles = [], explicitPermissions = [] } = req.body;
      const roleId = `role_${Date.now()}`;
      const role: any = {
        id: roleId,
        name,
        permissions: [],
        moduleBundles,
        explicitPermissions,
        resolvedPermissions: [],
      };
      await diContainer.roleRepository.createRole('', role);
      await resolver.resolveRoleById(roleId);
      const saved = await diContainer.roleRepository.getRole(roleId);
      res.json({ success: true, data: saved });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const { name, moduleBundles = [], explicitPermissions = [] } = req.body;
      await diContainer.roleRepository.updateRole(req.params.roleId, {
        name,
        moduleBundles,
        explicitPermissions,
      });
      await resolver.resolveRoleById(req.params.roleId);
      const saved = await diContainer.roleRepository.getRole(req.params.roleId);
      res.json({ success: true, data: saved });
    } catch (err) {
      next(err);
    }
  }
}
