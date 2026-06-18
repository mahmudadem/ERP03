import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';

export function requireCompanyParamMatchesContext(paramName = 'companyId') {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    const requestedCompanyId = (req.params as any)?.[paramName];

    if (!requestedCompanyId) {
      return next(ApiError.badRequest('Company id is required', 'COMPANY_CONTEXT_REQUIRED'));
    }

    if (user?.isSuperAdmin === true) {
      return next();
    }

    if (!user?.companyId) {
      return next(ApiError.forbidden('No active company selected', 'COMPANY_CONTEXT_REQUIRED'));
    }

    if (user.companyId !== requestedCompanyId) {
      return next(ApiError.forbidden('Company access denied', 'COMPANY_ACCESS_DENIED'));
    }

    next();
  };
}
