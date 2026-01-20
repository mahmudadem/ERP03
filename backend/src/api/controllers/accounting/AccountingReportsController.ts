
import { Request, Response, NextFunction } from 'express';
import { GetTrialBalanceUseCase, GetGeneralLedgerUseCase } from '../../../application/accounting/use-cases/ReportingUseCases';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

export class AccountingReportsController {
  
  static async getTrialBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      if (!companyId) throw ApiError.badRequest('Company Context Missing');
      if (!userId) throw ApiError.unauthorized('User missing');
      const useCase = new GetTrialBalanceUseCase(
        diContainer.accountRepository,
        diContainer.voucherRepository,
        permissionChecker
      );
      
      const report = await useCase.execute(companyId, userId);

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

  static async getGeneralLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      if (!companyId) throw ApiError.badRequest('Company Context Missing');
      if (!userId) throw ApiError.unauthorized('User missing');

      const { accountId, from, to } = req.query;

      const useCase = new GetGeneralLedgerUseCase(
        diContainer.ledgerRepository as any,
        diContainer.accountRepository,
        diContainer.voucherRepository,
        diContainer.userRepository,
        permissionChecker
      );
      
      const report = await useCase.execute(companyId, userId, {
        accountId: accountId as string | undefined,
        fromDate: from as string | undefined,
        toDate: to as string | undefined,
      });

      (res as any).status(200).json({
        success: true,
        data: report,
        meta: {
          generatedAt: new Date().toISOString(),
          filters: { accountId, from, to }
        }
      });
    } catch (error) {
      next(error);
    }
  }
}
