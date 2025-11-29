import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListAccountsUseCase } from '../../../application/accounting/use-cases/accounts/ListAccountsUseCase';
import { GetAccountUseCase } from '../../../application/accounting/use-cases/accounts/GetAccountUseCase';
import { CreateAccountUseCase } from '../../../application/accounting/use-cases/accounts/CreateAccountUseCase';
import { UpdateAccountUseCase } from '../../../application/accounting/use-cases/accounts/UpdateAccountUseCase';
import { DeactivateAccountUseCase } from '../../../application/accounting/use-cases/accounts/DeactivateAccountUseCase';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';

const permissionChecker = new PermissionChecker(new GetCurrentUserPermissionsForCompanyUseCase(diContainer.rbacPermissionRepository, diContainer.rbacCompanyUserRepository));

export class AccountController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      await permissionChecker.assertOrThrow(userId, companyId, 'coa.view');

      const useCase = new ListAccountsUseCase(diContainer.accountRepository);
      const accounts = await useCase.execute(companyId);

      res.json({ success: true, data: accounts });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const { id } = req.params;

      await permissionChecker.assertOrThrow(userId, companyId, 'coa.view');

      const useCase = new GetAccountUseCase(diContainer.accountRepository);
      const account = await useCase.execute(companyId, id);

      if (!account) {
        return res.status(404).json({ success: false, error: 'Account not found' });
      }

      res.json({ success: true, data: account });
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
      const account = await useCase.execute(companyId, req.body);

      res.json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const { id } = req.params;

      await permissionChecker.assertOrThrow(userId, companyId, 'coa.edit');

      const useCase = new UpdateAccountUseCase(diContainer.accountRepository);
      const account = await useCase.execute(companyId, id, req.body);

      res.json({ success: true, data: account });
    } catch (err) {
      next(err);
    }
  }

  static async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const { id } = req.params;

      await permissionChecker.assertOrThrow(userId, companyId, 'coa.edit');

      const useCase = new DeactivateAccountUseCase(diContainer.accountRepository);
      await useCase.execute(companyId, id);

      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
