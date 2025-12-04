import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListCompanyFeaturesUseCase } from '../../../application/company-admin/use-cases/ListCompanyFeaturesUseCase';
import { ListActiveCompanyFeaturesUseCase } from '../../../application/company-admin/use-cases/ListActiveCompanyFeaturesUseCase';
import { ToggleFeatureFlagUseCase } from '../../../application/company-admin/use-cases/ToggleFeatureFlagUseCase';

/**
 * CompanyFeaturesController
 * Handles company feature flag management
 */
export class CompanyFeaturesController {

  /**
   * GET /company-admin/features
   * List all features
   */
  static async listFeatures(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const useCase = new ListCompanyFeaturesUseCase();
      const features = await useCase.execute(companyId);

      res.json({ success: true, data: features });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /company-admin/features/active
   * List active features
   */
  static async listActiveFeatures(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }

      const useCase = new ListActiveCompanyFeaturesUseCase(diContainer.companyRepository);
      const features = await useCase.execute(companyId);

      res.json({ success: true, data: features });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /company-admin/features/toggle
   * Toggle feature on/off
   */
  static async toggleFeature(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      const { featureId, enabled } = req.body;

      if (!companyId) {
        res.status(400).json({ success: false, error: 'Company ID required' });
        return;
      }
      if (!featureId) {
        res.status(400).json({ success: false, error: 'Feature ID required' });
        return;
      }

      const useCase = new ToggleFeatureFlagUseCase(diContainer.companyRepository);
      await useCase.execute(companyId, featureId, enabled);

      res.json({ success: true, message: 'Feature toggled successfully' });
    } catch (error) {
      next(error);
    }
  }
}
