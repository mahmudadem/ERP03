import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';

export function permissionGuard(requiredPermission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = req.tenantContext;

    if (!context) {
      return next(ApiError.internal('Tenant context not initialized'));
    }

    // Check if user has the specific permission OR wildcard
    if (!context.permissions.includes('*') && !context.permissions.includes(requiredPermission)) {
      return next(ApiError.forbidden(`Permission denied: ${requiredPermission}`));
    }

    next();
  };
}
