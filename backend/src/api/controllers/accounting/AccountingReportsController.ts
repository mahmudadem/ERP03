
import { Request, Response, NextFunction } from 'express';
import { GetTrialBalanceUseCase } from '../../../application/accounting/use-cases/ReportingUseCases';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';

export class AccountingReportsController {
  
  static async getTrialBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId;
      if (!companyId) throw ApiError.badRequest('Company Context Missing');

      const useCase = new GetTrialBalanceUseCase(
        diContainer.accountRepository,
        diContainer.voucherRepository
      );
      
      const report = await useCase.execute(companyId);

      (res as any).status(200).json({
        success: true,
        data: report,
        meta: {
          generatedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
