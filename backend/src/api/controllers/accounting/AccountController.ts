import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { CreateAccountUseCase, UpdateAccountUseCase, DeactivateAccountUseCase } from '../../../application/accounting/use-cases/AccountUseCases';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';

const permissionChecker = new PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase(diContainer.rbacPermissionRepository, diContainer.rbacCompanyUserRepository));

export class AccountController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const accounts = await diContainer.accountRepository.getAccounts(companyId);
      res.json({ success: true, data: accounts });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      await permissionChecker.assertOrThrow(userId, companyId, 'coa.edit');
      const useCase = new CreateAccountUseCase(diContainer.accountRepository);
      const acc = await useCase.execute({ ...req.body, companyId });
      res.json({ success: true, data: acc });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      await permissionChecker.assertOrThrow(userId, companyId, 'coa.edit');
      const useCase = new UpdateAccountUseCase(diContainer.accountRepository);
      await useCase.execute(req.params.id, req.body, companyId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      await permissionChecker.assertOrThrow(userId, companyId, 'coa.edit');
      const useCase = new DeactivateAccountUseCase(diContainer.accountRepository);
      await useCase.execute(req.params.id, companyId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
