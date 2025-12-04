import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';

/**
 * ownerOrPermissionGuard
 * Middleware that allows access if user is owner OR has specific permission
 * 
 * @param requiredPermission - The permission code required (e.g., 'system.company.manage')
 * @returns Express middleware function
 */
export function ownerOrPermissionGuard(requiredPermission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      // Get user from request (set by authMiddleware)
      const user = (req as any).user;
      if (!user) {
        return next(ApiError.unauthorized('User not authenticated'));
      }

      // Get tenant context (set by tenantContextMiddleware)
      const tenantContext = (req as any).tenantContext;
      if (!tenantContext) {
        return next(ApiError.internal('Tenant context not initialized'));
      }

      // Check if user is owner - owners bypass permission checks
      if (user.isOwner === true) {
        return next();
      }

      // Check if user has the required permission
      if (!tenantContext.permissions || !Array.isArray(tenantContext.permissions)) {
        return next(ApiError.forbidden(`Permission denied: ${requiredPermission}`));
      }

      if (!tenantContext.permissions.includes(requiredPermission)) {
        return next(ApiError.forbidden(`Permission denied: ${requiredPermission}`));
      }

      // User has permission, allow access
      next();
    } catch (error) {
      next(error);
    }
  };
}
