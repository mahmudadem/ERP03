import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { GetGrossProfitByDocumentUseCase } from '../../../application/reporting/use-cases/GetGrossProfitByDocumentUseCase';
import { GetGrossProfitByItemUseCase } from '../../../application/reporting/use-cases/GetGrossProfitByItemUseCase';
import { PermissionChecker } from '../../../application/rbac/PermissionChecker';
import { GetCurrentUserPermissionsForCompanyUseCase } from '../../../application/rbac/use-cases/GetCurrentUserPermissionsForCompanyUseCase';
import { ProfitDocumentType } from '../../../domain/reporting/entities/SalesProfitLineFact';

const permissionChecker = new PermissionChecker(
  new GetCurrentUserPermissionsForCompanyUseCase(
    diContainer.userRepository,
    diContainer.rbacCompanyUserRepository,
    diContainer.companyRoleRepository
  )
);

const KNOWN_DOCUMENT_TYPES: ProfitDocumentType[] = [
  'SALES_INVOICE',
  'SALES_RETURN',
  'PURCHASE_INVOICE',
  'PURCHASE_RETURN',
];

const parseDocumentType = (raw: unknown): ProfitDocumentType | ProfitDocumentType[] | undefined => {
  if (typeof raw !== 'string' || raw.length === 0) return undefined;
  const tokens = raw.split(',').map(t => t.trim()).filter(Boolean);
  const valid = tokens.filter((t): t is ProfitDocumentType => KNOWN_DOCUMENT_TYPES.includes(t as ProfitDocumentType));
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return valid[0];
  return valid;
};

export class SalesGrossProfitController {
  static async grossProfitByDocument(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new GetGrossProfitByDocumentUseCase(
        diContainer.salesProfitLineFactRepository,
        permissionChecker
      );
      const data = await useCase.execute({
        companyId,
        userId,
        fromDate: typeof req.query.from === 'string' ? req.query.from : undefined,
        toDate: typeof req.query.to === 'string' ? req.query.to : undefined,
        documentType: parseDocumentType(req.query.documentType),
        itemId: typeof req.query.itemId === 'string' ? req.query.itemId : undefined,
        docCurrency: typeof req.query.docCurrency === 'string' ? req.query.docCurrency : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async grossProfitByItem(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = (req as any).user.companyId;
      const userId = (req as any).user.uid;
      const useCase = new GetGrossProfitByItemUseCase(
        diContainer.salesProfitLineFactRepository,
        permissionChecker
      );
      const data = await useCase.execute({
        companyId,
        userId,
        fromDate: typeof req.query.from === 'string' ? req.query.from : undefined,
        toDate: typeof req.query.to === 'string' ? req.query.to : undefined,
        documentType: parseDocumentType(req.query.documentType),
        itemId: typeof req.query.itemId === 'string' ? req.query.itemId : undefined,
        docCurrency: typeof req.query.docCurrency === 'string' ? req.query.docCurrency : undefined,
        limit: req.query.limit ? Number(req.query.limit) : undefined,
      });
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}
