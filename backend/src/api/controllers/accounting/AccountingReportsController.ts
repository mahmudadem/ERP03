
import { Request, Response, NextFunction } from 'express';
import { GetGeneralLedgerUseCase } from '../../../application/accounting/use-cases/ReportingUseCases';
import { GetTrialBalanceUseCase, GetBalanceSheetUseCase, GetAccountStatementUseCase } from '../../../application/accounting/use-cases/LedgerUseCases';
import { GetCashFlowStatementUseCase } from '../../../application/accounting/use-cases/CashFlowUseCases';
import { AgingReportUseCase } from '../../../application/accounting/use-cases/AgingReportUseCase';
import { GetCostCenterSummaryUseCase } from '../../../application/accounting/use-cases/CostCenterSummaryUseCase';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { VoucherStatus } from '../../../domain/accounting/types/VoucherTypes';
import { isCashLikeAccount } from '../../../application/accounting/utils/cashAccountMatcher';

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

      const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().split('T')[0];
      const includeZeroBalance = req.query.includeZeroBalance === 'true';

      const useCase = new GetTrialBalanceUseCase(
        diContainer.ledgerRepository,
        diContainer.accountRepository,
        permissionChecker
      );

      const result = await useCase.execute(companyId, userId, asOfDate, includeZeroBalance);

      (res as any).status(200).json({
        success: true,
        data: {
          rows: result.data,
          meta: result.meta
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

      const { accountId, from, to, limit, offset, costCenterId } = req.query;

      const useCase = new GetGeneralLedgerUseCase(
        diContainer.ledgerRepository as any,
        diContainer.accountRepository,
        diContainer.voucherRepository,
        diContainer.userRepository,
        permissionChecker,
        diContainer.costCenterRepository
      );
      
      const result = await useCase.execute(companyId, userId, {
        accountId: accountId as string | undefined,
        fromDate: from as string | undefined,
        toDate: to as string | undefined,
        costCenterId: costCenterId as string | undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined
      });

      (res as any).status(200).json({
        success: true,
        data: result.data,
        meta: {
          generatedAt: new Date().toISOString(),
          filters: { accountId, from, to },
          pagination: {
            totalItems: result.metadata.totalItems,
            openingBalance: result.metadata.openingBalance
          }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getBalanceSheet(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      if (!companyId) throw ApiError.badRequest('Company Context Missing');
      if (!userId) throw ApiError.unauthorized('User missing');

      const asOfDate = (req.query.asOfDate as string) || new Date().toISOString().split('T')[0];
      const useCase = new GetBalanceSheetUseCase(
        diContainer.ledgerRepository,
        diContainer.accountRepository,
        permissionChecker,
        diContainer.companyRepository
      );

      const report = await useCase.execute(companyId, userId, asOfDate);

      (res as any).status(200).json({
        success: true,
        data: report,
        meta: {
          generatedAt: new Date().toISOString(),
          asOfDate
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getAccountStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      if (!companyId) throw ApiError.badRequest('Company Context Missing');
      if (!userId) throw ApiError.unauthorized('User missing');

      const { accountId, fromDate, toDate, includeUnposted } = req.query;
      if (!accountId) {
        return res.status(400).json({ error: 'accountId is required' });
      }

      const useCase = new GetAccountStatementUseCase(
        diContainer.ledgerRepository,
        permissionChecker,
        diContainer.accountRepository,
        diContainer.companyRepository
      );
      const report = await useCase.execute(
        companyId,
        userId,
        accountId as string,
        (fromDate as string) || '',
        (toDate as string) || '',
        { includeUnposted: includeUnposted === 'true' }
      );

      (res as any).status(200).json({
        success: true,
        data: report,
        meta: {
          generatedAt: new Date().toISOString(),
          filters: { accountId, fromDate, toDate }
        }
      });
    } catch (error) {
      next(error);
    }
  }

  static async getDashboardSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      if (!companyId) throw ApiError.badRequest('Company Context Missing');
      if (!userId) throw ApiError.unauthorized('User missing');

      const today = new Date();
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

      const [counts, recent, trialBalance, accounts, fiscal] = await Promise.all([
        diContainer.voucherRepository.getCounts(companyId, monthStart, monthEnd),
        diContainer.voucherRepository.getRecent(companyId, 10),
        diContainer.ledgerRepository.getTrialBalance(companyId, monthEnd),
        diContainer.accountRepository.list(companyId),
        diContainer.fiscalYearRepository.findActiveForDate(companyId, monthEnd).catch(() => null)
      ]);

      const cashAccounts = new Set(accounts.filter((a: any) => isCashLikeAccount(a)).map((a: any) => a.id));
      const cashPosition = trialBalance
        .filter((r: any) => cashAccounts.has(r.accountId))
        .reduce((sum, r) => sum + (r.debit || 0) - (r.credit || 0), 0);

      const recentDtos = recent.map((v: any) => ({
        id: v.id,
        voucherNo: v.voucherNo,
        date: v.date,
        type: v.type,
        status: v.status,
        amount: Math.max(v.totalDebit, v.totalCredit),
        posted: !!v.postedAt
      }));

      const response = {
        vouchers: counts,
        cashPosition,
        recentVouchers: recentDtos,
        unbalancedDrafts: counts.unbalancedDrafts,
        fiscalPeriodStatus: fiscal?.getPeriodForDate(monthEnd)?.status || null,
        baseCurrency: (await diContainer.companyRepository.findById(companyId).catch(() => null as any))?.baseCurrency || ''
      };

      (res as any).status(200).json({ success: true, data: response });
    } catch (error) {
      next(error);
    }
  }

  static async getCashFlow(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      if (!companyId) throw ApiError.badRequest('Company Context Missing');
      if (!userId) throw ApiError.unauthorized('User missing');
      const { from, to } = req.query;
      const useCase = new GetCashFlowStatementUseCase(
        diContainer.ledgerRepository,
        diContainer.accountRepository,
        diContainer.companyRepository,
        permissionChecker
      );
      const data = await useCase.execute(companyId, userId, (from as string) || '', (to as string) || '');
      (res as any).status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getAgingReport(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      if (!companyId) throw ApiError.badRequest('Company Context Missing');
      if (!userId) throw ApiError.unauthorized('User missing');
      const { type = 'AR', asOfDate, accountId, includeZeroBalance } = req.query;
      const useCase = new AgingReportUseCase(diContainer.ledgerRepository, diContainer.accountRepository, permissionChecker);
      const data = await useCase.execute(
        companyId,
        userId,
        (type as any) || 'AR',
        (asOfDate as string) || new Date().toISOString().slice(0, 10),
        accountId as string | undefined,
        includeZeroBalance === 'true'
      );
      (res as any).status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getCostCenterSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      if (!companyId) throw ApiError.badRequest('Company Context Missing');
      if (!userId) throw ApiError.unauthorized('User missing');

      const { costCenterId, from, to } = req.query;
      if (!costCenterId) throw ApiError.badRequest('costCenterId is required');

      const useCase = new GetCostCenterSummaryUseCase(
        diContainer.ledgerRepository as any,
        diContainer.accountRepository,
        diContainer.costCenterRepository,
        permissionChecker
      );

      const result = await useCase.execute(companyId, userId, {
        costCenterId: costCenterId as string,
        fromDate: from as string | undefined,
        toDate: to as string | undefined,
      });

      (res as any).status(200).json({
        success: true,
        data: result.rows,
        meta: result.meta
      });
    } catch (error) {
      next(error);
    }
  }
}
