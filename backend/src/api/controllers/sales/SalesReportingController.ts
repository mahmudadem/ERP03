import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import {
  GetArAgingReportUseCase,
  GetLedgerBackedArAgingUseCase,
  GetCustomerLedgerUseCase,
  GetLedgerBackedCustomerStatementUseCase,
  CustomerStatementMissingAccountError,
} from '../../../application/sales/use-cases/ReceivablesReportingUseCases';
import { GetAccountStatementUseCase } from '../../../application/accounting/use-cases/LedgerUseCases';
import {
  GetSalesByCustomerUseCase,
  GetSalesByItemUseCase,
  GetSalesBySalespersonUseCase,
} from '../../../application/sales/use-cases/SalesAnalyticsUseCases';

export class SalesReportingController {
  private static getCompanyId(req: Request): string {
    const companyId = (req as any).user?.companyId;
    if (!companyId) {
      throw new Error('Company context not found');
    }
    return companyId;
  }

  private static getUserId(req: Request): string {
    const userId = (req as any).user?.uid || (req as any).user?.id;
    if (!userId) {
      throw new Error('User context not found');
    }
    return userId;
  }

  // ---------------------------------------------------------------------------
  // AR Aging Report
  // ---------------------------------------------------------------------------

  static async getArAgingReport(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesReportingController.getCompanyId(req);
      const userId = SalesReportingController.getUserId(req);
      const q = (req as any).query;
      const accountStatementUseCase = new GetAccountStatementUseCase(
        diContainer.ledgerRepository,
        diContainer.permissionChecker,
        diContainer.accountRepository,
        diContainer.companyRepository,
      );
      const useCase = new GetLedgerBackedArAgingUseCase(
        diContainer.partyRepository,
        diContainer.salesInvoiceRepository,
        accountStatementUseCase,
      );
      const result = await useCase.execute({
        companyId,
        userId,
        asOfDate: q.asOfDate as string | undefined,
        customerId: q.customerId as string | undefined,
      });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Customer Ledger
  // ---------------------------------------------------------------------------

  static async getCustomerLedger(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesReportingController.getCompanyId(req);
      const q = (req as any).query;
      if (!q.customerId) {
        throw new Error('customerId query parameter is required');
      }
      const useCase = new GetCustomerLedgerUseCase(
        diContainer.salesInvoiceRepository,
        diContainer.paymentHistoryRepository,
        diContainer.partyRepository,
      );
      const result = await useCase.execute({
        companyId,
        customerId: q.customerId as string,
        fromDate: q.fromDate as string | undefined,
        toDate: q.toDate as string | undefined,
      });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Customer Statement
  // ---------------------------------------------------------------------------

  static async getCustomerStatement(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesReportingController.getCompanyId(req);
      const userId = SalesReportingController.getUserId(req);
      const q = (req as any).query;
      const customerId = (req as any).params?.partyId || q.customerId;
      if (!customerId) {
        throw new Error('customerId query parameter or partyId route parameter is required');
      }
      if (!q.fromDate) {
        throw new Error('fromDate query parameter is required');
      }
      if (!q.toDate) {
        throw new Error('toDate query parameter is required');
      }
      const accountStatementUseCase = new GetAccountStatementUseCase(
        diContainer.ledgerRepository,
        diContainer.permissionChecker,
        diContainer.accountRepository,
        diContainer.companyRepository,
      );
      const useCase = new GetLedgerBackedCustomerStatementUseCase(
        diContainer.partyRepository,
        diContainer.salesInvoiceRepository,
        diContainer.salesOrderRepository,
        accountStatementUseCase,
        diContainer.voucherRepository,
      );
      const result = await useCase.execute({
        companyId,
        userId,
        customerId: customerId as string,
        fromDate: q.fromDate as string,
        toDate: q.toDate as string,
        includeOpenCommitments: q.includeOpenCommitments === 'true',
      });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      if (error instanceof CustomerStatementMissingAccountError) {
        return (res as any).status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
      }
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Sales by Customer
  // ---------------------------------------------------------------------------

  static async getSalesByCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesReportingController.getCompanyId(req);
      const q = (req as any).query;
      const useCase = new GetSalesByCustomerUseCase(diContainer.salesInvoiceRepository);
      const result = await useCase.execute({
        companyId,
        fromDate: q.fromDate as string | undefined,
        toDate: q.toDate as string | undefined,
      });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Sales by Item
  // ---------------------------------------------------------------------------

  static async getSalesByItem(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesReportingController.getCompanyId(req);
      const q = (req as any).query;
      const useCase = new GetSalesByItemUseCase(diContainer.salesInvoiceRepository);
      const result = await useCase.execute({
        companyId,
        fromDate: q.fromDate as string | undefined,
        toDate: q.toDate as string | undefined,
      });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Sales by Salesperson
  // ---------------------------------------------------------------------------

  static async getSalesBySalesperson(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesReportingController.getCompanyId(req);
      const q = (req as any).query;
      const useCase = new GetSalesBySalespersonUseCase(
        diContainer.salesInvoiceRepository,
        diContainer.salespersonRepository,
      );
      const result = await useCase.execute({
        companyId,
        fromDate: q.fromDate as string | undefined,
        toDate: q.toDate as string | undefined,
      });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
