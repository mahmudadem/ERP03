import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../infrastructure/di/bindRepositories';
import { ApiError } from '../errors/ApiError';

export class RecordAuditController {
  static async getByEntity(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = RecordAuditController.getCompanyId(req);
      const entityType = (req as any).query.entityType;
      const entityId = (req as any).query.entityId;

      if (!entityType || !entityId) {
        return (res as any).status(400).json({
          success: false,
          error: 'entityType and entityId query parameters are required',
        });
      }

      const logs = await diContainer.recordChangeLogRepository.findByEntity(companyId, String(entityType), String(entityId));

      (res as any).json({
        success: true,
        data: logs.map((log) => log.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  }

  private static getCompanyId(req: Request): string {
    const companyId = (req as any).user?.companyId;
    if (!companyId) {
      throw ApiError.badRequest('Company context not found');
    }
    return companyId;
  }
}
