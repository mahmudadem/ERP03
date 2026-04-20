import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { ModuleRegistry } from '../../../application/platform/ModuleRegistry';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

export function companyModuleGuard(moduleName: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const context = req.tenantContext;
    const normalizedModuleName = String(moduleName || '').trim().toLowerCase();

    if (!context) {
      return next(ApiError.internal('Tenant context not initialized'));
    }

    const tenantModules = Array.isArray(context.modules)
      ? context.modules.map((m) => String(m || '').trim().toLowerCase()).filter(Boolean)
      : [];

    // Primary path: trust tenant context when module list contains canonical module ids.
    if (tenantModules.includes(normalizedModuleName)) {
      return next();
    }

    const registeredModules = new Set(
      ModuleRegistry.getInstance()
        .getAllModules()
        .map((m) => String(m.metadata.id || '').trim().toLowerCase())
        .filter(Boolean)
    );

    const hasCanonicalTenantModules = tenantModules.some((m) => registeredModules.has(m));

    // Fallback path for legacy/stale company.modules payloads (e.g., wizard model tokens).
    if (!hasCanonicalTenantModules) {
      try {
        const moduleState = await diContainer.companyModuleRepository.get(context.companyId, normalizedModuleName);
        if (moduleState && (moduleState.initialized || moduleState.initializationStatus === 'complete')) {
          return next();
        }
      } catch (error) {
        return next(error);
      }
    }

    return next(ApiError.forbidden(`Module '${moduleName}' is disabled for this company`));
  };
}
