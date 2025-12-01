import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { GetTrialBalanceUseCase, GetGeneralLedgerUseCase, GetJournalUseCase } from '../../../application/accounting/use-cases/LedgerUseCases';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

export class ReportingController {
  static async trialBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const asOfDate = String(req.query.asOfDate || new Date().toISOString());
      const useCase = new GetTrialBalanceUseCase(diContainer.ledgerRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId, asOfDate);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async generalLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const filters = {
        accountId: req.query.accountId as string,
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string,
      };
      const useCase = new GetGeneralLedgerUseCase(diContainer.ledgerRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId, filters);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async journal(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const filters = {
        fromDate: req.query.fromDate as string,
        toDate: req.query.toDate as string,
        voucherType: req.query.voucherType as string,
      };
      const useCase = new GetJournalUseCase(diContainer.ledgerRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId, filters);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}
