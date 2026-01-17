import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';

export function permissionGuard(requiredPermission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = req.tenantContext;

    if (!context) {
      return next(ApiError.internal('Tenant context not initialized'));
    }

    // Check if user has the specific permission, wildcard, or a parent permission
    const hasPermission = context.permissions.some((perm: string) => {
      // Wildcard grants all
      if (perm === '*') return true;
      // Exact match
      if (perm === requiredPermission) return true;
      // Hierarchical: if user has "accounting.settings", it grants "accounting.settings.read"
      if (requiredPermission.startsWith(perm + '.')) return true;
      return false;
    });

    if (!hasPermission) {
      return next(ApiError.forbidden(`Permission denied: ${requiredPermission}`));
    }

    next();
  };
}
