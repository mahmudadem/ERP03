import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';

export function featureFlagGuard(featureName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = req.tenantContext;

    if (!context) {
      return next(ApiError.internal('Tenant context not initialized'));
    }

    if (!context.features.includes(featureName)) {
      return next(ApiError.forbidden(`Feature not enabled: ${featureName}`));
    }

    next();
  };
}
