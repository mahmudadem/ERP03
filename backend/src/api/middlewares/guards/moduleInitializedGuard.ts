import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

export function moduleInitializedGuard(moduleCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const companyId = req.tenantContext?.companyId || (req as any).user?.companyId;
      if (!companyId) {
        return next(ApiError.internal('Tenant context not initialized'));
      }

      const moduleState = await diContainer.companyModuleRepository.get(companyId, moduleCode);
      if (!moduleState || !moduleState.initialized) {
        return next(ApiError.forbidden(`Module '${moduleCode}' is not initialized`));
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
