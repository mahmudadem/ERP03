import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { GetCompanyBundleUseCase } from '../../../application/company-admin/use-cases/GetCompanyBundleUseCase';
import { ListAvailableBundlesUseCase } from '../../../application/company-admin/use-cases/ListAvailableBundlesUseCase';
import { UpgradeCompanyBundleUseCase } from '../../../application/company-admin/use-cases/UpgradeCompanyBundleUseCase';

/**
 * CompanyBundleController
 * Handles company bundle management
 */
export class CompanyBundleController {

  /**
   * GET /company-admin/bundle
   * Get current bundle
   */
  static async getCurrentBundle(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const useCase = new GetCompanyBundleUseCase(
        diContainer.companyRepository,
        diContainer.bundleRegistryRepository
      );
      const result = await useCase.execute({ companyId });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /company-admin/bundle/available
   * List available bundles
   */
  static async listAvailableBundles(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new ListAvailableBundlesUseCase(diContainer.bundleRegistryRepository);
      const result = await useCase.execute();

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /company-admin/bundle/upgrade
   * Upgrade to new bundle
   */
  static async upgradeBundle(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).tenantContext?.companyId;
      const { bundleId } = req.body;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }
      if (!bundleId) {
        res.status(400).json({ success: false, error: 'Bundle ID required' });
        return;
      }

      const useCase = new UpgradeCompanyBundleUseCase(
        diContainer.companyRepository,
        diContainer.bundleRegistryRepository
      );
      const result = await useCase.execute({ companyId, bundleId });

      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
