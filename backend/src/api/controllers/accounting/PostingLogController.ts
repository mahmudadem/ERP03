import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';

export class PostingLogController {
  private static getCompanyId(req: Request): string {
    const cid = (req as any).user?.companyId || (req as any).companyId;
    if (!cid) throw ApiError.badRequest('Missing company context');
    return cid;
  }

  /**
   * GET /tenant/accounting/posting-logs?sourceId=<id>
   *
   * Returns all PostingLog records for a given source document (e.g. a Sales
   * Invoice id). Used by the future GL Impact preview (P1).
   *
   * When `sourceId` is absent, returns the most recent 50 records, optionally
   * filtered by sourceModule and sourceType.
   */
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PostingLogController.getCompanyId(req);
      const sourceId = (req.query.sourceId as string) || undefined;
      const sourceModule = (req.query.sourceModule as string) || undefined;
      const sourceType = (req.query.sourceType as string) || undefined;
      const limitRaw = (req.query.limit as string) || '50';
      const limit = Math.min(parseInt(limitRaw, 10) || 50, 200);

      const repo = diContainer.postingLogRepository;
      const logs = sourceId
        ? await repo.findBySourceId(companyId, sourceId)
        : await repo.listBySource(companyId, { sourceModule, sourceType, limit });

      (res as any).json({ success: true, data: logs.map((l) => l.toJSON()) });
    } catch (err) {
      next(err);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = PostingLogController.getCompanyId(req);
      const id = req.params.id;
      const log = await diContainer.postingLogRepository.getById(companyId, id);
      if (!log) {
        throw ApiError.notFound(`PostingLog ${id} not found`);
      }
      (res as any).json({ success: true, data: log.toJSON() });
    } catch (err) {
      next(err);
    }
  }
}
