/**
 * AuthPermissionsController
 *
 * Returns user permissions and module access.
 * Applies 4-gate filtering (in order):
 * 1. Module availability passes (code exists, lifecycleStatus=ready, runtimeStatus=available)
 * 2. Company is entitled (has bundle/trial/promotion entitlement)
 * 3. CompanyModule is enabled (company admin turned ON)
 * 4. User role grants the module (role.moduleBundles includes it)
 */
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ModuleAvailabilityService, ModuleAvailabilityState } from '../../../application/platform/ModuleAvailabilityService';
import {
  filterRuntimeAvailableModules,
  resolveCompanyModuleAccess
} from '../../../application/company-admin/services/CompanyModuleAccessResolver';
import { resolveEnabledCompanyCapabilityCodes } from '../../../application/company-admin/services/CompanyCapabilityAccessResolver';

export class AuthPermissionsController {
  static async getMyPermissions(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const companyId = user.companyId;
      const isSuperAdmin = user.isSuperAdmin;

      if (!companyId) {
        return res.json({
          success: true,
          data: {
            roleId: null,
            roleName: null,
            moduleBundles: [],
            explicitPermissions: [],
            resolvedPermissions: [],
            isSuperAdmin
          }
        });
      }

      const company = await diContainer.companyRepository.findById(companyId);
      const membership = await diContainer.rbacCompanyUserRepository.getByUserAndCompany(user.uid, companyId);
      
      const isOwner = isSuperAdmin || (company?.ownerId === user.uid) || (!!membership?.isOwner) || (membership?.roleId?.toLowerCase() === 'owner');

      if (!membership) {
        return res.json({
          success: true,
          data: {
            roleId: isOwner ? 'OWNER' : null,
            roleName: isOwner ? 'Owner' : null,
            moduleBundles: [],
            explicitPermissions: [],
            resolvedPermissions: [],
            isSuperAdmin,
            isOwner
          }
        });
      }

      const role = await diContainer.companyRoleRepository.getById(companyId, membership.roleId);
      const resolvedPermissions = role?.resolvedPermissions || role?.permissions || [];

      const service = ModuleAvailabilityService.getInstance();

      const entitledModules = await diContainer.entitlementService.getEntitledModules(companyId);
      const entitledModuleSet = new Set<string>(entitledModules.map(m => m.toLowerCase()));

      const companyModules = await diContainer.companyModuleRepository.listByCompany(companyId);
      const legacyModulesList = (company as any)?.modules as string[] || [];
      const legacyModuleSet = new Set<string>(legacyModulesList.map((m: string) => m.toLowerCase()).filter(Boolean));
      const candidateModules = resolveCompanyModuleAccess({
        companyModules,
        legacyModules: legacyModulesList,
        entitledModules,
        roleModuleBundles: role?.moduleBundles || [],
        role,
        membership,
      });

      const availableForCompany = await service.getAvailableModulesForCompany(companyId);

      const finalModules = candidateModules
        .filter((moduleId: string) => {
          const isEntitled = entitledModuleSet.has(moduleId) || legacyModuleSet.has(moduleId);
          if (!isEntitled) return false;

          const info = service.getAvailabilityInfo(moduleId);
          if (!info) return false;

          if (info.state !== ModuleAvailabilityState.AVAILABLE &&
              info.state !== ModuleAvailabilityState.SUSPENDED) {
            return false;
          }

          return availableForCompany.includes(moduleId);
        });

      const capabilityParentModules = await filterRuntimeAvailableModules(companyId, finalModules, service);
      const enabledCapabilities = await resolveEnabledCompanyCapabilityCodes({
        companyId,
        accessibleModules: capabilityParentModules,
        capabilityRepository: diContainer.capabilityRegistryRepository,
        entitlementRepository: diContainer.companyEntitlementRepository,
      });

      const finalIsOwner = isOwner || membership.roleId?.toLowerCase() === 'owner';

      return res.json({
        success: true,
        data: {
          roleId: membership.roleId,
          roleName: role?.name || null,
          moduleBundles: finalModules,
          explicitPermissions: role?.explicitPermissions || role?.permissions || [],
          resolvedPermissions,
          enabledCapabilities,
          isSuperAdmin,
          isOwner: finalIsOwner,
        },
      });
    } catch (err) {
      return next(err);
    }
  }
}
