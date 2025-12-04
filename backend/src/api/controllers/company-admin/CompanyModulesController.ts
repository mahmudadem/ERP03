import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListCompanyModulesUseCase } from '../../../application/company-admin/use-cases/ListCompanyModulesUseCase';
import { ListActiveCompanyModulesUseCase } from '../../../application/company-admin/use-cases/ListActiveCompanyModulesUseCase';
import { EnableModuleForCompanyUseCase } from '../../../application/company-admin/use-cases/EnableModuleForCompanyUseCase';
import { DisableModuleForCompanyUseCase } from '../../../application/company-admin/use-cases/DisableModuleForCompanyUseCase';

/**
 * CompanyModulesController
 * Handles company module activation/deactivation
 */
export class CompanyModulesController {

  /**
   * GET /company-admin/modules
   * List available modules
   */
  static async listModules(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const useCase = new ListCompanyModulesUseCase();
      const result = await useCase.execute({ companyId });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /company-admin/modules/active
   * List active modules
   */
  static async listActiveModules(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const useCase = new ListActiveCompanyModulesUseCase(diContainer.companyRepository);
      const result = await useCase.execute({ companyId });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /company-admin/modules/enable
   * Enable module
   */
  static async enableModule(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      const { moduleName } = req.body;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }
      if (!moduleName) {
        res.status(400).json({ success: false, error: 'Module name required' });
        return;
      }

      const useCase = new EnableModuleForCompanyUseCase(diContainer.companyRepository);
      const result = await useCase.execute({ companyId, moduleName });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /company-admin/modules/disable
   * Disable module
   */
  static async disableModule(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      const { moduleName } = req.body;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }
      if (!moduleName) {
        res.status(400).json({ success: false, error: 'Module name required' });
        return;
      }

      const useCase = new DisableModuleForCompanyUseCase(diContainer.companyRepository);
      const result = await useCase.execute({ companyId, moduleName });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
