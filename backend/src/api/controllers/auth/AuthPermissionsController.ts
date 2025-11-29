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

      const role = await diContainer.rbacCompanyRoleRepository.getById(companyId, membership.roleId);
      const resolvedPermissions = role?.resolvedPermissions || role?.permissions || [];
      res.json({
        success: true,
        data: {
          roleId: membership.roleId,
          roleName: role?.name || null,
          moduleBundles: role?.moduleBundles || [],
          explicitPermissions: role?.explicitPermissions || role?.permissions || [],
          resolvedPermissions,
          isSuperAdmin,
        },
      });
    } catch (err) {
      next(err);
    }
  }
}
