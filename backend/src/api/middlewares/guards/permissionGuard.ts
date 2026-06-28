import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';

export function permissionGuard(requiredPermission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = req.tenantContext;

    if (!context) {
      return next(ApiError.internal('Tenant context not initialized'));
    }

    if (context.isOwner || ((req as any).user && (req as any).user.isSuperAdmin)) {
      return next();
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

export function anyPermissionGuard(requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = req.tenantContext;

    if (!context) {
      return next(ApiError.internal('Tenant context not initialized'));
    }

    if (context.isOwner || ((req as any).user && (req as any).user.isSuperAdmin)) {
      return next();
    }

    const hasPermission = requiredPermissions.some((requiredPermission) =>
      context.permissions.some((perm: string) => {
        if (perm === '*') return true;
        if (perm === requiredPermission) return true;
        if (requiredPermission.startsWith(perm + '.')) return true;
        return false;
      })
    );

    if (!hasPermission) {
      return next(ApiError.forbidden(`Permission denied: ${requiredPermissions.join(' or ')}`));
    }

    next();
  };
}
