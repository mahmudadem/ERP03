/**
 * ModuleAvailabilityController
 *
 * Handles SuperAdmin endpoints for module availability and implementation checks.
 */
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ModuleRegistry } from '../../../application/platform/ModuleRegistry';
import { CheckModuleImplementationUseCase } from '../../../application/super-admin/use-cases/CheckModuleImplementationUseCase';
import { ModuleAvailabilityService } from '../../../application/platform/ModuleAvailabilityService';

export class ModuleAvailabilityController {
  /**
   * POST /super-admin/modules/:id/check-implementation
   * Run implementation check for a module and refresh cache
   */
  static async checkImplementation(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const useCase = new CheckModuleImplementationUseCase(
        diContainer.moduleRegistryRepository,
        ModuleRegistry.getInstance()
      );

      const result = await useCase.execute(id);

      const service = ModuleAvailabilityService.getInstance();
      if (service.isInitialized()) {
        await service.rebuildAvailabilityMap();
      }

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /super-admin/modules/availability
   * Get full availability report for SuperAdmin
   */
  static async getAvailabilityReport(req: Request, res: Response, next: NextFunction) {
    try {
      const service = ModuleAvailabilityService.getInstance();
      const report = service.getSuperAdminView();

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /super-admin/modules/:id/availability
   * Get availability state for a specific module
   */
  static async getModuleAvailability(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const service = ModuleAvailabilityService.getInstance();
      const info = service.getAvailabilityInfo(id);

      if (!info) {
        return res.status(404).json({
          success: false,
          error: 'Module not found',
        });
      }

      res.json({
        success: true,
        data: info,
      });
    } catch (error) {
      next(error);
    }
  }
}