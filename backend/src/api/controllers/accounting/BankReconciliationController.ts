import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { BankReconciliationUseCases } from '../../../application/accounting/use-cases/BankReconciliationUseCases';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

const useCases = new BankReconciliationUseCases(
  diContainer.bankStatementRepository,
  diContainer.reconciliationRepository,
  diContainer.ledgerRepository,
  diContainer.voucherRepository,
  diContainer.companyRepository,
  permissionChecker
);

export class BankReconciliationController {
  static async import(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const data = await useCases.importStatement(companyId, userId, req.body);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async listStatements(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const accountId = req.query.accountId as string | undefined;
      const data = await useCases.listStatements(companyId, userId, accountId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async getReconciliation(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const accountId = req.params.accountId;
      const data = await useCases.getReconciliation(companyId, userId, accountId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async manualMatch(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const { statementId, lineId, ledgerEntryId } = req.body;
      const data = await useCases.manualMatch(companyId, userId, statementId, lineId, ledgerEntryId);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  static async complete(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user?.companyId || (req as any).companyId;
      const userId = (req as any).user?.uid;
      const accountId = req.params.accountId;
      const { statementId, adjustments } = req.body;
      const data = await useCases.complete(companyId, userId, accountId, statementId, adjustments);
      res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
}
