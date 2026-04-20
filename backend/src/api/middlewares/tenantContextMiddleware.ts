import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';
import { diContainer } from '../../infrastructure/di/bindRepositories';

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

        // CRITICAL: companyId MUST come ONLY from req.user.companyId
        // Block any attempts to load companyId from req.body, req.query, or req.params
        const companyId = user.companyId;

        // 1. Load Company to get Modules
        const company = await diContainer.companyRepository.findById(companyId);

        // Tenant Isolation Check: Ensure company exists and matches authenticated user's company
        if (!company || company.id !== user.companyId) {
            return next(ApiError.forbidden('Invalid company context'));
        }

        // 2. Load Permissions from User's Role
        let permissions: string[] = [];
        let roleModuleBundles: string[] = [];
        if (user.roleId) {
            const role = await diContainer.companyRoleRepository.getById(companyId, user.roleId);
            if (role) {
                permissions = role.resolvedPermissions || role.permissions || [];
                roleModuleBundles = role.moduleBundles || [];
            }
        }

        // NOTE: Features were part of the old bundle structure
        // With the new businessDomains-based bundle structure, features are not tracked
        const features: string[] = [];

        // 4. Set Tenant Context with ALL required fields
        console.log(`[TenantContext] User: ${user.uid}, Role: ${user.roleId}, Company: ${companyId}`);
        console.log(`[TenantContext] Permissions: ${JSON.stringify(permissions)}`);

        const companyModules = Array.isArray(company.modules) ? company.modules : [];
        const normalizedCompanyModules = companyModules
            .map((moduleId) => String(moduleId || '').trim().toLowerCase())
            .filter(Boolean);

        const normalizedRoleModuleBundles = roleModuleBundles
            .map((moduleId) => String(moduleId || '').trim().toLowerCase())
            .filter(Boolean);

        const modules = Array.from(new Set([
            ...normalizedCompanyModules,
            ...normalizedRoleModuleBundles
        ]));

        req.tenantContext = {
            userId: user.uid,
            companyId: companyId,
            roleId: user.roleId,
            permissions: permissions,
            modules,
            features: features
        };

        next();
    } catch (error) {
        next(error);
    }
};
