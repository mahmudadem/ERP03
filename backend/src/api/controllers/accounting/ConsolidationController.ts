import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { GetConsolidatedTrialBalanceUseCase } from '../../../application/accounting/use-cases/ConsolidationUseCases';
import { v4 as uuidv4 } from 'uuid';
import { CompanyGroup } from '../../../domain/accounting/entities/CompanyGroup';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

export class ConsolidationController {
  static async createGroup(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.uid;
      const { name, reportingCurrency, members } = req.body;
      const group = new CompanyGroup(uuidv4(), name, reportingCurrency, members, new Date(), userId);
      await diContainer.companyGroupRepository.create(group);
      res.status(201).json({ success: true, data: group });
    } catch (error) {
      next(error);
    }
  }

  static async listGroups(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const groups = await diContainer.companyGroupRepository.list(companyId);
      res.status(200).json({ success: true, data: groups });
    } catch (error) {
      next(error);
    }
  }

  static async consolidatedTrialBalance(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const { groupId, asOfDate } = req.query;
      if (!groupId) return res.status(400).json({ error: 'groupId is required' });
      const useCase = new GetConsolidatedTrialBalanceUseCase(
        diContainer.companyGroupRepository,
        diContainer.companyRepository,
        diContainer.ledgerRepository,
        diContainer.accountRepository,
        diContainer.exchangeRateRepository,
        permissionChecker
      );
      const data = await useCase.execute(groupId as string, companyId, userId, (asOfDate as string) || new Date().toISOString().slice(0, 10));
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
