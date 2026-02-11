import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { ApproveBudgetUseCase, CreateBudgetUseCase, GetBudgetVsActualUseCase, UpdateBudgetUseCase } from '../../../application/accounting/use-cases/BudgetUseCases';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

export class BudgetController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const fiscalYearId = req.query.fiscalYearId as string | undefined;
      const budgets = await diContainer.budgetRepository.list(companyId, fiscalYearId);
      res.status(200).json({ success: true, data: budgets });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const useCase = new CreateBudgetUseCase(diContainer.budgetRepository, diContainer.fiscalYearRepository, permissionChecker);
      const budget = await useCase.execute(companyId, userId, req.body);
      res.status(201).json({ success: true, data: budget });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const useCase = new UpdateBudgetUseCase(diContainer.budgetRepository, permissionChecker);
      const budget = await useCase.execute(companyId, userId, id, req.body);
      res.status(200).json({ success: true, data: budget });
    } catch (error) {
      next(error);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const useCase = new ApproveBudgetUseCase(diContainer.budgetRepository, permissionChecker);
      await useCase.execute(companyId, userId, id);
      res.status(200).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async budgetVsActual(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const { budgetId, costCenterId } = req.query;
      if (!budgetId) return res.status(400).json({ error: 'budgetId is required' });
      const useCase = new GetBudgetVsActualUseCase(
        diContainer.budgetRepository,
        diContainer.fiscalYearRepository,
        diContainer.ledgerRepository,
        permissionChecker
      );
      const data = await useCase.execute(companyId, userId, budgetId as string, costCenterId as string | undefined);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
