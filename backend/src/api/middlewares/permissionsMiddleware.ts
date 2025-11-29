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

    if (!user.companyId) {
      return next(ApiError.forbidden('No active company selected'));
    }

    next();
  };
};
