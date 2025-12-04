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
            return next(ApiError.badRequest('Company Context Required: No companyId found in user session or headers.'));
        }

        // 1. Load Company to get Modules
        const company = await diContainer.companyRepository.findById(user.companyId);
        if (!company) {
            return next(ApiError.notFound('Company not found'));
        }

        // 2. Load Permissions
        let permissions: string[] = [];
        if (user.roleId) {
             const role = await diContainer.companyRoleRepository.getById(user.companyId, user.roleId);
             if (role) {
                 permissions = role.resolvedPermissions || [];
             }
        }

        // 3. Resolve Features (Mocking Bundle logic for now as per existing codebase limitations)
        // In a real scenario, we would read company.bundleId
        const bundleId = 'starter'; 
        const bundle = getBundleById(bundleId);
        const features = bundle ? bundle.features : [];

        req.tenantContext = {
            userId: user.uid,
            companyId: user.companyId,
            roleId: user.roleId,
            permissions: permissions,
            modules: company.modules,
            features: features
        };

        next();
    } catch (error) {
        next(error);
    }
};
