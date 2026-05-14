import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';

export class AiMaintenanceController {
  static async runCleanup(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyIds, retentionDays } = req.body;

      if (!Array.isArray(companyIds) || companyIds.length === 0) {
        throw ApiError.badRequest('companyIds must be a non-empty array of company IDs');
      }

      const report = await diContainer.aiConversationCleanupService.cleanupAll(
        companyIds,
        retentionDays ?? 90,
      );

      res.json({ success: true, data: report });
    } catch (error) {
      next(error);
    }
  }
}
