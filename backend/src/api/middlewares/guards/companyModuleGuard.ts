/**
 * CompanyModuleGuard
 *
 * Guards module routes. Checks:
 * 1. Module is available (DB + code + passed implementation check + ready + available)
 * 2. Version matches between DB and code
 * 3. Company has module enabled in tenant context
 *
 * Returns 423 Locked for suspended modules that are enabled.
 * Returns 503 for unavailable or blocked modules.
 * Returns 403 Forbidden for disabled modules.
 */
import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../../errors/ApiError';
import { ModuleAvailabilityService, ModuleAvailabilityState } from '../../../application/platform/ModuleAvailabilityService';

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

    const service = ModuleAvailabilityService.getInstance();

    if (tenantModules.includes(normalizedModuleName)) {
      const info = service.getAvailabilityInfo(normalizedModuleName);

      if (!info) {
        return next(ApiError.internal('Module availability info not found'));
      }

      if (info.state === ModuleAvailabilityState.DB_ONLY) {
        return next(ApiError.custom(503, 'Module implementation not found. Contact SuperAdmin.'));
      }

      if (info.state === ModuleAvailabilityState.CODE_ONLY) {
        return next(ApiError.custom(503, 'Module not registered. Contact SuperAdmin.'));
      }

      if (info.state === ModuleAvailabilityState.VERSION_MISMATCH) {
        return next(ApiError.custom(503, `Module version mismatch: ${info.reason}`));
      }

      if (info.state === ModuleAvailabilityState.IMPLEMENTATION_FAILED) {
        return next(ApiError.custom(503, `Module implementation failed: ${info.reason}`));
      }

      if (info.state === ModuleAvailabilityState.IMPLEMENTATION_UNCHECKED) {
        return next(ApiError.custom(503, `Module implementation not verified: ${info.reason}`));
      }

      if (info.state === ModuleAvailabilityState.NOT_READY) {
        return next(ApiError.custom(503, `Module is not ready: ${info.reason}`));
      }

      if (info.state === ModuleAvailabilityState.SUSPENDED) {
        return next(ApiError.locked(
          `${normalizedModuleName} is temporarily unavailable due to maintenance. Your data is safe. Please try again later or contact your administrator.`
        ));
      }

      if (info.state === ModuleAvailabilityState.AVAILABLE) {
        return next();
      }

      return next(ApiError.forbidden(`Module '${moduleName}' access denied`));
    }

    return next(ApiError.forbidden(`Module '${moduleName}' is not enabled for this company`));
  };
}