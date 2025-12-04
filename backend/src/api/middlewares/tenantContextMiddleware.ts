import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';
import { diContainer } from '../../infrastructure/di/bindRepositories';
import { getBundleById } from '../../domain/platform/Bundle';

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
        if (user.roleId) {
            const role = await diContainer.companyRoleRepository.getById(companyId, user.roleId);
            if (role) {
                permissions = role.resolvedPermissions || role.permissions || [];
            }
        }

        // 3. Resolve Features from Bundle
        // Use company.subscriptionPlan if available, otherwise default to 'starter'
        const bundleId = (company as any).subscriptionPlan || 'starter';
        const bundle = getBundleById(bundleId);
        const features = bundle ? bundle.features : [];

        // 4. Set Tenant Context with ALL required fields
        req.tenantContext = {
            userId: user.uid,
            companyId: companyId,
            roleId: user.roleId,
            permissions: permissions,
            modules: company.modules || [],
            features: features
        };

        next();
    } catch (error) {
        next(error);
    }
};
