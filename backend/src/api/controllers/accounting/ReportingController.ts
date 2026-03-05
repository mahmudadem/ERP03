import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { GetTrialBalanceUseCase, GetGeneralLedgerUseCase, GetJournalUseCase } from '../../../application/accounting/use-cases/LedgerUseCases';
import { GetProfitAndLossUseCase } from '../../../application/reporting/use-cases/GetProfitAndLossUseCase';
import { GetTradingAccountUseCase } from '../../../application/reporting/use-cases/GetTradingAccountUseCase';
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
      
      const fromDate = typeof req.query.from === 'string'
        ? req.query.from
        : `${new Date().getFullYear()}-01-01`;
      const toDate = typeof req.query.to === 'string'
        ? req.query.to
        : new Date().toISOString().slice(0, 10);

      const useCase = new GetProfitAndLossUseCase(
        diContainer.ledgerRepository,
        diContainer.accountRepository,
        permissionChecker
      );
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

  static async tradingAccount(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const fromDate = typeof req.query.from === 'string'
        ? req.query.from
        : `${new Date().getFullYear()}-01-01`;
      const toDate = typeof req.query.to === 'string'
        ? req.query.to
        : new Date().toISOString().slice(0, 10);

      const useCase = new GetTradingAccountUseCase(
        diContainer.ledgerRepository,
        diContainer.accountRepository,
        permissionChecker
      );
      const data = await useCase.execute({
        companyId,
        userId,
        fromDate,
        toDate
      });

      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async trialBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const asOfDate = String(req.query.asOfDate || new Date().toISOString().split('T')[0]);
      const includeZeroBalance = req.query.includeZeroBalance === 'true';
      const excludeSpecialPeriods = req.query.excludeSpecialPeriods === 'true';
      const useCase = new GetTrialBalanceUseCase(diContainer.ledgerRepository, diContainer.accountRepository, permissionChecker);
      const result = await useCase.execute(
        companyId,
        userId,
        asOfDate,
        includeZeroBalance,
        excludeSpecialPeriods
      );
      res.json({ success: true, data: { rows: result.data, meta: result.meta } });
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
      const useCase = new GetJournalUseCase(diContainer.voucherRepository, diContainer.accountRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId, filters);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}
