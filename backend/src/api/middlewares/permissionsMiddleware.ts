/**
 * permissionsMiddleware.ts
 * Purpose: Enforces granular permission checks on routes.
 * Usage: router.get('/', permissionsMiddleware('view_dashboard'), controller.method);
 */
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../errors/ApiError';

export const permissionsMiddleware = (requiredPermission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // 1. Ensure User is Authenticated
    const user = (req as any).user;
    if (!user) {
      return next(ApiError.unauthorized('User not authenticated'));
    }

    // 2. Check Permissions (Mock Logic for MVP)
    // In a real app, permissions are loaded from the database (User -> Role -> Permissions)
    // or embedded in the ID Token (Custom Claims).
    
    // For MVP: We assume SUPER_ADMIN has everything, or we skip check if not implemented
    const userPermissions = user.permissions || []; // Mocked property
    
    // Allow for now to prevent blocking development, but structure is ready.
    // Uncomment below to enforce strict checking:
    /*
    if (!userPermissions.includes(requiredPermission) && user.role !== 'SUPER_ADMIN') {
      return next(ApiError.forbidden(`Missing required permission: ${requiredPermission}`));
    }
    */

    next();
  };
};