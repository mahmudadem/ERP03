import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ListAccountsUseCase } from '../../../application/accounting/use-cases/accounts/ListAccountsUseCase';
import { GetAccountUseCase } from '../../../application/accounting/use-cases/accounts/GetAccountUseCase';
import { CreateAccountUseCase } from '../../../application/accounting/use-cases/accounts/CreateAccountUseCase';
import { UpdateAccountUseCase } from '../../../application/accounting/use-cases/accounts/UpdateAccountUseCase';
import { DeactivateAccountUseCase } from '../../../application/accounting/use-cases/accounts/DeactivateAccountUseCase';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { AccountValidationService } from '../../../application/accounting/services/AccountValidationService';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

export class AccountController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      await permissionChecker.assertOrThrow(userId, companyId, 'coa.view');

      const useCase = new ListAccountsUseCase(diContainer.accountRepository);
      const accounts = await useCase.execute(companyId);

      return res.json({ success: true, data: accounts });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Get valid accounts for voucher entry
   * Only returns leaf accounts that pass all validation rules
   */
  static async getValid(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const voucherType = req.query.voucherType as string | undefined;

      await permissionChecker.assertOrThrow(userId, companyId, 'voucher.create');

      const validationService = new AccountValidationService(diContainer.accountRepository);
      const validAccounts = await validationService.getValidAccounts(companyId, userId, voucherType);

      return res.json({ success: true, data: validAccounts });
    } catch (err) {
      return next(err);
    }
  }

  /**
   * Resolve account code to account object and validate
   */
  static async resolveCode(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const { code } = req.params;
      const voucherType = req.query.voucherType as string | undefined;

      await permissionChecker.assertOrThrow(userId, companyId, 'voucher.create');

      const validationService = new AccountValidationService(diContainer.accountRepository);
      const account = await validationService.resolveAndValidate(companyId, userId, code, voucherType);

      return res.json({ success: true, data: account });
    } catch (err) {
      return next(err);
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

      return res.json({ success: true, data: account });
    } catch (err) {
      return next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;

      await permissionChecker.assertOrThrow(userId, companyId, 'coa.edit');

      const useCase = new CreateAccountUseCase(diContainer.accountRepository);
      const account = await useCase.execute(companyId, {
        ...req.body,
        createdBy: userId
      });

      return res.json({ success: true, data: account });
    } catch (err) {
      return next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const { id } = req.params;

      await permissionChecker.assertOrThrow(userId, companyId, 'coa.edit');

      const useCase = new UpdateAccountUseCase(diContainer.accountRepository);
      const account = await useCase.execute(companyId, id, {
        ...req.body,
        updatedBy: userId
      });

      return res.json({ success: true, data: account });
    } catch (err) {
      return next(err);
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

      return res.json({ success: true });
    } catch (err) {
      return next(err);
    }
  }
}
