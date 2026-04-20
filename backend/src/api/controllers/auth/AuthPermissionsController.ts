import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ModuleRegistry } from '../../../application/platform/ModuleRegistry';

export class AuthPermissionsController {
  static async getMyPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const companyId = user.companyId;
      const isSuperAdmin = user.isSuperAdmin;

      if (!companyId) {
        return res.json({ success: true, data: { roleId: null, roleName: null, moduleBundles: [], explicitPermissions: [], resolvedPermissions: [], isSuperAdmin } });
      }

      const membership = await diContainer.rbacCompanyUserRepository.getByUserAndCompany(user.uid, companyId);
      if (!membership) {
        return res.json({ success: true, data: { roleId: null, roleName: null, moduleBundles: [], explicitPermissions: [], resolvedPermissions: [], isSuperAdmin } });
      }

      const role = await diContainer.companyRoleRepository.getById(companyId, membership.roleId);
      const resolvedPermissions = role?.resolvedPermissions || role?.permissions || [];

      // Normalize/merge module assignments from company + role records.
      const company = await diContainer.companyRepository.findById(companyId);
      const moduleIds = new Set(
        ModuleRegistry.getInstance()
          .getAllModules()
          .map((module) => String(module.metadata.id || '').trim().toLowerCase())
          .filter(Boolean)
      );

      const companyModules = Array.isArray(company?.modules) ? company!.modules : [];
      const roleModules = Array.isArray(role?.moduleBundles) ? role!.moduleBundles : [];

      const normalizedRawModules = [...companyModules, ...roleModules]
        .map((moduleId) => String(moduleId || '').trim().toLowerCase())
        .filter(Boolean);

      let normalizedModules = Array.from(
        new Set(normalizedRawModules.filter((moduleId) => moduleIds.has(moduleId)))
      );

      const hasOnlyLegacyTokens = normalizedRawModules.length > 0 && normalizedModules.length === 0;
      if (hasOnlyLegacyTokens) {
        const moduleStates = await diContainer.companyModuleRepository.listByCompany(companyId);
        normalizedModules = Array.from(
          new Set(
            moduleStates
              .filter((state) => state.initialized || state.initializationStatus === 'complete')
              .map((state) => String(state.moduleCode || '').trim().toLowerCase())
              .filter((moduleId) => moduleIds.has(moduleId))
          )
        );
      }

      return res.json({
        success: true,
        data: {
          roleId: membership.roleId,
          roleName: role?.name || null,
          moduleBundles: normalizedModules,
          explicitPermissions: role?.explicitPermissions || role?.permissions || [],
          resolvedPermissions,
          isSuperAdmin,
        },
      });
    } catch (err) {
      return next(err);
    }
  }
}
