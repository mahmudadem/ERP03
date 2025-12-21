import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import {
  CreateVoucherUseCase,
  UpdateVoucherUseCase,
  ApproveVoucherUseCase,
  LockVoucherUseCase,
  CancelVoucherUseCase,
  GetVoucherUseCase,
  ListVouchersUseCase,
} from '../../../application/accounting/use-cases/VoucherUseCases';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

export class VoucherController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new ListVouchersUseCase(diContainer.voucherRepository, permissionChecker);
      const vouchers = await useCase.execute(companyId, userId, req.query);
      res.json({ success: true, data: vouchers });
    } catch (err) {
      next(err);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new GetVoucherUseCase(diContainer.voucherRepository, permissionChecker);
      const voucher = await useCase.execute(companyId, userId, req.params.id);
      res.json({ success: true, data: voucher });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new CreateVoucherUseCase(
        diContainer.voucherRepository,
        diContainer.accountRepository,
        diContainer.companyModuleSettingsRepository,
        diContainer.ledgerRepository,
        permissionChecker,
        diContainer.transactionManager,
        diContainer.voucherTypeDefinitionRepository
      );
      const voucher = await useCase.execute(companyId, userId, req.body);
      res.json({ success: true, data: voucher });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new UpdateVoucherUseCase(
        diContainer.voucherRepository,
        diContainer.accountRepository,
        permissionChecker
      );
      await useCase.execute(companyId, userId, req.params.id, req.body);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async approve(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new ApproveVoucherUseCase(diContainer.voucherRepository, diContainer.ledgerRepository, permissionChecker);
      await useCase.execute(companyId, userId, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async lock(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new LockVoucherUseCase(diContainer.voucherRepository, permissionChecker);
      await useCase.execute(companyId, userId, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new CancelVoucherUseCase(diContainer.voucherRepository, diContainer.ledgerRepository, permissionChecker);
      await useCase.execute(companyId, userId, req.params.id);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
