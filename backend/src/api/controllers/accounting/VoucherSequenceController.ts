import { Request, Response, NextFunction } from 'express';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { ListVoucherSequencesUseCase, SetNextVoucherNumberUseCase } from '../../../application/accounting/use-cases/VoucherSequenceUseCases';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

export class VoucherSequenceController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const useCase = new ListVoucherSequencesUseCase(diContainer.voucherSequenceRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId);
      (res as any).status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async setNext(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const { prefix, nextNumber, year } = req.body;
      const useCase = new SetNextVoucherNumberUseCase(diContainer.voucherSequenceRepository, permissionChecker);
      await useCase.execute(companyId, userId, prefix, Number(nextNumber), year ? Number(year) : undefined);
      (res as any).status(200).json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}
