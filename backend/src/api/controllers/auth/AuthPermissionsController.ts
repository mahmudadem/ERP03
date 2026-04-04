import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

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

      // Read active modules from company document (source of truth)
      // instead of role.moduleBundles which is stale after new modules are enabled
      const company = await diContainer.companyRepository.findById(companyId);
      const companyModules = company?.modules || role?.moduleBundles || [];

      return res.json({
        success: true,
        data: {
          roleId: membership.roleId,
          roleName: role?.name || null,
          moduleBundles: companyModules,
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
