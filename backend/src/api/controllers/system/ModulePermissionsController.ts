import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ModulePermissionsDefinition } from '../../../domain/system/ModulePermissionsDefinition';
import { RolePermissionResolver } from '../../../application/roles/RolePermissionResolver';

export class ModulePermissionsController {
  static async listModules(req: Request, res: Response, next: NextFunction) {
    try {
      const defs = await diContainer.modulePermissionsDefinitionRepository.list();
      res.json({ success: true, data: defs });
    } catch (err) {
      next(err);
    }
  }

  static async getByModule(req: Request, res: Response, next: NextFunction) {
    try {
      const { moduleId } = req.params;
      const def = await diContainer.modulePermissionsDefinitionRepository.getByModuleId(moduleId);
      res.json({ success: true, data: def });
    } catch (err) {
      next(err);
    }
  }

  static async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      const { moduleId } = req.params;
      const body = req.body as ModulePermissionsDefinition;
      const def: ModulePermissionsDefinition = {
        moduleId,
        permissions: body.permissions || [],
        autoAttachToRoles: body.autoAttachToRoles || [],
        createdAt: body.createdAt || new Date(),
        updatedAt: new Date(),
        permissionsDefined: true
      };
      await diContainer.modulePermissionsDefinitionRepository.update(moduleId, def);
      const resolver = new RolePermissionResolver(
        diContainer.modulePermissionsDefinitionRepository,
        diContainer.roleRepository
      );
      await resolver.resolveAllRoles();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const body = req.body as ModulePermissionsDefinition;
      const def: ModulePermissionsDefinition = {
        moduleId: body.moduleId,
        permissions: body.permissions || [],
        autoAttachToRoles: body.autoAttachToRoles || [],
        createdAt: new Date(),
        updatedAt: new Date(),
        permissionsDefined: true
      };
      await diContainer.modulePermissionsDefinitionRepository.create(def);
      const resolver = new RolePermissionResolver(
        diContainer.modulePermissionsDefinitionRepository,
        diContainer.roleRepository
      );
      await resolver.resolveAllRoles();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const { moduleId } = req.params;
      await diContainer.modulePermissionsDefinitionRepository.delete(moduleId);
      const resolver = new RolePermissionResolver(
        diContainer.modulePermissionsDefinitionRepository,
        diContainer.roleRepository
      );
      await resolver.resolveAllRoles();
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
