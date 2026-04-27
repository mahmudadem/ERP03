/**
 * tenantContextMiddleware Build tenant context with proper 4-gate filtering:
 * 
 * Gates (in order):
 * 1. Module availability passes (code exists, lifecycleStatus=ready, runtimeStatus=available)
 * 2. Company is entitled (has bundle/trial/promotion entitlement)
 * 3. CompanyModule is enabled (company.admin turned ON)
 * 4. User role grants the module (role.moduleBundles includes it)
 * 
 * Never union company modules and role modules - intersect them.
 * Owner/admin wildcard role behavior: use company-enabled modules if role has no moduleBundles.
 */
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';
import { diContainer } from '../../infrastructure/di/bindRepositories';
import {
    filterRuntimeAvailableModules,
    resolveCompanyModuleAccess
} from '../../application/company-admin/services/CompanyModuleAccessResolver';
import { resolveEnabledCompanyCapabilityCodes } from '../../application/company-admin/services/CompanyCapabilityAccessResolver';

declare global {
    namespace Express {
        interface Request {
            tenantContext?: {
                userId: string;
                companyId: string;
                roleId?: string;
                permissions: string[];
                modules: string[];
                features: string[];
            }
        }
    }
}

export const tenantContextMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const user = (req as any).user;

        if (!user) {
            return next(ApiError.unauthorized('User not authenticated'));
        }

        if (!user.companyId) {
            return next(ApiError.badRequest('Company Context Required: No companyId found in user session.'));
        }

        const companyId = user.companyId;

        const company = await diContainer.companyRepository.findById(companyId);

        if (!company || company.id !== user.companyId) {
            return next(ApiError.forbidden('Invalid company context'));
        }

        let permissions: string[] = [];
        let roleModuleBundles: string[] = [];
        let role: any = null;
        if (user.roleId) {
            role = await diContainer.companyRoleRepository.getById(companyId, user.roleId);
            if (role) {
                permissions = role.resolvedPermissions || role.permissions || [];
                roleModuleBundles = role.moduleBundles || [];
            }
        }

        const companyModules = await diContainer.companyModuleRepository.listByCompany(companyId);
        const entitledModules = await diContainer.entitlementService.getEntitledModules(companyId);
        const finalModules = resolveCompanyModuleAccess({
            companyModules,
            legacyModules: (company.modules || []) as string[],
            entitledModules,
            roleModuleBundles,
            role,
            membership: {
                roleId: user.roleId || undefined,
                isOwner: user.isOwner,
            },
        });
        const capabilityParentModules = await filterRuntimeAvailableModules(companyId, finalModules);
        const enabledFeatures = await resolveEnabledCompanyCapabilityCodes({
            companyId,
            accessibleModules: capabilityParentModules,
            capabilityRepository: diContainer.capabilityRegistryRepository,
            entitlementRepository: diContainer.companyEntitlementRepository,
        });

        console.log(`[TenantContext] User: ${user.uid}, Role: ${user.roleId}, Company: ${companyId}`);
        console.log(`[TenantContext] Final modules: ${JSON.stringify(capabilityParentModules)}`);

        req.tenantContext = {
            userId: user.uid,
            companyId: companyId,
            roleId: user.roleId,
            permissions: permissions,
            modules: capabilityParentModules,
            features: enabledFeatures
        };

        next();
    } catch (error) {
        next(error);
    }
};
