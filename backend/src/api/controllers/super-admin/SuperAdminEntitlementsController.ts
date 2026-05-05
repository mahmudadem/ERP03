import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { GrantModuleToCompanyUseCase } from '../../../application/super-admin/use-cases/GrantModuleToCompanyUseCase';
import { RevokeModuleFromCompanyUseCase } from '../../../application/super-admin/use-cases/RevokeModuleFromCompanyUseCase';

export class SuperAdminEntitlementsController {
  /**
   * GET /super-admin/companies/:companyId/entitlements
   * List all entitled modules for a company
   */
  static async listModules(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId } = req.params;
      const entitledModules = await diContainer.entitlementService.getEntitledModules(companyId);

      // Also get full entitlement details
      const entitlements = await diContainer.companyEntitlementRepository.getActiveByCompanyId(companyId);

      res.json({ success: true, data: { modules: entitledModules, entitlements } });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /super-admin/companies/:companyId/entitlements/modules
   * Grant a module to a company
   */
  static async grantModule(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId } = req.params;
      const { moduleKey } = req.body;

      if (!moduleKey || typeof moduleKey !== 'string') {
        res.status(400).json({ success: false, message: 'moduleKey is required' });
        return;
      }

      const useCase = new GrantModuleToCompanyUseCase(
        diContainer.entitlementService,
        diContainer.moduleRegistryRepository
      );

      await useCase.execute(companyId, moduleKey);

      res.status(201).json({ success: true, message: `Module '${moduleKey}' granted to company.` });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /super-admin/companies/:companyId/entitlements/modules/:moduleKey
   * Revoke a module from a company
   */
  static async revokeModule(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, moduleKey } = req.params;

      const useCase = new RevokeModuleFromCompanyUseCase(
        diContainer.entitlementService
      );

      await useCase.execute(companyId, moduleKey);

      res.json({ success: true, message: `Module '${moduleKey}' revoked from company.` });
    } catch (error) {
      next(error);
    }
  }
}