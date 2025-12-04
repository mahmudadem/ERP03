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
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const useCase = new ListCompanyModulesUseCase(diContainer.moduleRepository);
      const modules = await useCase.execute(companyId);

      res.json({ success: true, data: modules });
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
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const useCase = new ListActiveCompanyModulesUseCase(
        diContainer.companyModuleSettingsRepository,
        diContainer.moduleRepository
      );
      const modules = await useCase.execute(companyId);

      res.json({ success: true, data: modules });
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
      const companyId = req.user?.companyId;
      const { moduleId } = req.body;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }
      if (!moduleId) {
        res.status(400).json({ success: false, error: 'Module ID required' });
        return;
      }

      const useCase = new EnableModuleForCompanyUseCase(diContainer.companyModuleSettingsRepository);
      await useCase.execute(companyId, moduleId);

      res.json({ success: true, message: 'Module enabled successfully' });
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
      const companyId = req.user?.companyId;
      const { moduleId } = req.body;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }
      if (!moduleId) {
        res.status(400).json({ success: false, error: 'Module ID required' });
        return;
      }

      const useCase = new DisableModuleForCompanyUseCase(diContainer.companyModuleSettingsRepository);
      await useCase.execute(companyId, moduleId);

      res.json({ success: true, message: 'Module disabled successfully' });
    } catch (error) {
      next(error);
    }
  }
}
