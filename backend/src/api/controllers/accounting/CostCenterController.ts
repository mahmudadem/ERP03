import { Request, Response, NextFunction } from 'express';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import {
  ListCostCentersUseCase,
  CreateCostCenterUseCase,
  UpdateCostCenterUseCase,
  DeactivateCostCenterUseCase,
  ActivateCostCenterUseCase,
  DeleteCostCenterUseCase
} from '../../../application/accounting/use-cases/CostCenterUseCases';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

export class CostCenterController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const useCase = new ListCostCentersUseCase(diContainer.costCenterRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId);
      (res as any).status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const { id } = req.params;
      const cc = await diContainer.costCenterRepository.findById(companyId, id);
      if (!cc) return res.status(404).json({ error: 'Not found' });
      (res as any).status(200).json({ success: true, data: cc });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const useCase = new CreateCostCenterUseCase(diContainer.costCenterRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId, req.body);
      (res as any).status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const useCase = new UpdateCostCenterUseCase(diContainer.costCenterRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId, id, req.body);
      (res as any).status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async deactivate(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const useCase = new DeactivateCostCenterUseCase(diContainer.costCenterRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId, id);
      (res as any).status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async activate(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).companyId || (req as any).user?.companyId;
      const userId = (req as any).user?.uid;
      const { id } = req.params;
      const useCase = new ActivateCostCenterUseCase(diContainer.costCenterRepository, permissionChecker);
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
      const useCase = new DeleteCostCenterUseCase(diContainer.costCenterRepository, permissionChecker);
      const data = await useCase.execute(companyId, userId, id);
      (res as any).status(200).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}
