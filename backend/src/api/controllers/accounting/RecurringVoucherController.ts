import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import {
  CreateRecurringTemplateUseCase,
  UpdateRecurringTemplateUseCase,
  PauseRecurringTemplateUseCase,
  ResumeRecurringTemplateUseCase,
  GenerateRecurringVouchersUseCase
} from '../../../application/accounting/use-cases/RecurringVoucherUseCases';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

export class RecurringVoucherController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const data = await diContainer.recurringVoucherTemplateRepository.list(companyId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const uc = new CreateRecurringTemplateUseCase(
        diContainer.recurringVoucherTemplateRepository,
        diContainer.voucherRepository,
        permissionChecker
      );
      const data = await uc.execute(companyId, userId, req.body);
      res.status(201).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const uc = new UpdateRecurringTemplateUseCase(diContainer.recurringVoucherTemplateRepository, permissionChecker);
      const data = await uc.execute(companyId, userId, id, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async pause(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const uc = new PauseRecurringTemplateUseCase(diContainer.recurringVoucherTemplateRepository, permissionChecker);
      const data = await uc.execute(companyId, userId, id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async resume(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const uc = new ResumeRecurringTemplateUseCase(diContainer.recurringVoucherTemplateRepository, permissionChecker);
      const data = await uc.execute(companyId, userId, id);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const { asOfDate } = req.body;
      const uc = new GenerateRecurringVouchersUseCase(
        diContainer.recurringVoucherTemplateRepository,
        diContainer.voucherRepository,
        permissionChecker
      );
      const data = await uc.execute(companyId, userId, asOfDate || new Date().toISOString().slice(0, 10));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
