import { Request, Response, NextFunction } from 'express';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import {
  CreateFiscalYearUseCase,
  ListFiscalYearsUseCase,
  ClosePeriodUseCase,
  ReopenPeriodUseCase,
  CloseYearUseCase,
  ReopenYearUseCase,
  DeleteFiscalYearUseCase,
  EnableSpecialPeriodsUseCase,
  AutoCreateRetainedEarningsUseCase,
} from '../../../application/accounting/use-cases/FiscalYearUseCases';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

export class FiscalYearController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const useCase = new ListFiscalYearsUseCase(diContainer.fiscalYearRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId);
      (res as any).status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const { year, startMonth, name, periodScheme, includeAdjustmentPeriod, specialPeriodsCount } = req.body;
      const useCase = new CreateFiscalYearUseCase(
        diContainer.fiscalYearRepository,
        diContainer.companyRepository,
        permissionChecker
      );
      const fy = await useCase.execute(req.user!.companyId, req.user!.uid, { 
        year, 
        startMonth, 
        name, 
        periodScheme
      });
      res.status(201).json(fy);
    } catch (error) {
      next(error);
    }
  }

  static async closePeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const { periodId } = req.body;
      const useCase = new ClosePeriodUseCase(diContainer.fiscalYearRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId, id, periodId);
      (res as any).status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async reopenPeriod(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const { periodId } = req.body;
      const useCase = new ReopenPeriodUseCase(diContainer.fiscalYearRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId, id, periodId);
      (res as any).status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async enableSpecialPeriods(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const { definitions } = req.body;
      
      const useCase = new EnableSpecialPeriodsUseCase(diContainer.fiscalYearRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId, id, definitions);
      (res as any).status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async closeYear(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const { retainedEarningsAccountId } = req.body;
      const useCase = new CloseYearUseCase(
        diContainer.fiscalYearRepository,
        diContainer.ledgerRepository,
        diContainer.accountRepository,
        diContainer.companyRepository,
        diContainer.voucherRepository,
        diContainer.transactionManager,
        permissionChecker
      );
      const data = await useCase.execute(companyId, userId, id, { retainedEarningsAccountId });
      (res as any).status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async reopenYear(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const useCase = new ReopenYearUseCase(
        diContainer.fiscalYearRepository,
        diContainer.voucherRepository,
        diContainer.ledgerRepository,
        diContainer.transactionManager,
        permissionChecker
      );
      const data = await useCase.execute(companyId, userId, id);
      (res as any).status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      
      const useCase = new DeleteFiscalYearUseCase(diContainer.fiscalYearRepository, diContainer.voucherRepository, permissionChecker);
      await useCase.execute(companyId, userId, id);
      
      (res as any).status(200).json({ success: true, message: 'Fiscal year deleted successfully' });
    } catch (err) {
      next(err);
    }
  }
  static async autoCreateRetainedEarnings(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      
      const useCase = new AutoCreateRetainedEarningsUseCase(diContainer.accountRepository, permissionChecker);
      const result = await useCase.execute(companyId, userId);
      
      (res as any).status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
}
