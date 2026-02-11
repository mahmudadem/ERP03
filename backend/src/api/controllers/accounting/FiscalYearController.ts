import { Request, Response, NextFunction } from 'express';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import {
  CreateFiscalYearUseCase,
  ListFiscalYearsUseCase,
  ClosePeriodUseCase,
  ReopenPeriodUseCase,
  CloseYearUseCase,
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
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const { year, startMonth, name } = req.body;
      const useCase = new CreateFiscalYearUseCase(
        diContainer.fiscalYearRepository,
        diContainer.companyRepository,
        permissionChecker
      );
      const data = await useCase.execute(companyId, userId, { year: Number(year), startMonth: Number(startMonth), name });
      (res as any).status(201).json({ success: true, data });
    } catch (err) {
      next(err);
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
}
