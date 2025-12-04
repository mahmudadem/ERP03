import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';

export function companyModuleGuard(moduleName: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const context = req.tenantContext;

    if (!context) {
      return next(ApiError.internal('Tenant context not initialized'));
    }

    if (!context.modules.includes(moduleName)) {
      return next(ApiError.forbidden(`Module '${moduleName}' is disabled for this company`));
    }

    next();
  };
}
