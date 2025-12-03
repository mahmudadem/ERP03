import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';

export const tenantContextMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;

    if (!user) {
        return next(ApiError.unauthorized('User not authenticated'));
    }

    if (!user.companyId) {
        return next(ApiError.badRequest('Company Context Required: No companyId found in user session or headers.'));
    }

    // Future: Check if module is enabled for this company (Phase 3)

    next();
};
