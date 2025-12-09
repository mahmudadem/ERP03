import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { GetTrialBalanceUseCase, GetGeneralLedgerUseCase, GetJournalUseCase } from '../../../application/accounting/use-cases/LedgerUseCases';
import { GetProfitAndLossUseCase } from '../../../application/reporting/use-cases/GetProfitAndLossUseCase';
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
  static async profitAndLoss(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      
      // DEBUG LOGGING
      console.log('🔍 P&L Request:', {
        companyId,
        userId,
        from: req.query.from,
        to: req.query.to,
        user: (req as any).user
      });
      
      const fromDate = req.query.from ? new Date(req.query.from as string) : new Date(new Date().getFullYear(), 0, 1);
      const toDate = req.query.to ? new Date(req.query.to as string) : new Date();

      const useCase = new GetProfitAndLossUseCase(diContainer.voucherRepository, permissionChecker);
      const data = await useCase.execute({
        companyId,
        userId,
        fromDate,
        toDate
      });

      console.log('✅ P&L Result:', { revenue: data.revenue, expenses: data.expenses, netProfit: data.netProfit });

      res.json({ success: true, data });
    } catch (err) {
      console.error('❌ P&L Error:', err);
      next(err);
    }
  }

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
