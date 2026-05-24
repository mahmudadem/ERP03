import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import {
  CreateQuoteUseCase,
  UpdateQuoteUseCase,
  GetQuoteUseCase,
  ListQuotesUseCase,
  DeleteQuoteUseCase,
  SendQuoteUseCase,
  AcceptQuoteUseCase,
  RejectQuoteUseCase,
  ReviseQuoteUseCase,
  ConvertQuoteToSalesOrderUseCase,
  ConvertQuoteToSalesInvoiceUseCase,
} from '../../../application/sales/use-cases/QuoteUseCases';
import {
  CreatePromotionRuleUseCase,
  UpdatePromotionRuleUseCase,
  DeletePromotionRuleUseCase,
  GetPromotionRuleUseCase,
  ListPromotionRulesUseCase,
  EvaluatePromotionsUseCase,
} from '../../../application/sales/use-cases/PromotionUseCases';
import { GetAgedBacklogUseCase } from '../../../application/sales/use-cases/AgedBacklogUseCase';
import { CreateSalesOrderUseCase } from '../../../application/sales/use-cases/SalesOrderUseCases';
import { CreateSalesInvoiceUseCase } from '../../../application/sales/use-cases/SalesInvoiceUseCases';

export class SalesOperationalController {
  private static getCompanyId(req: Request): string {
    const companyId = (req as any).user?.companyId;
    if (!companyId) {
      throw new Error('Company context not found');
    }
    return companyId;
  }

  private static getUserId(req: Request): string {
    return (req as any).user?.uid || 'SYSTEM';
  }

  // ---------------------------------------------------------------------------
  // Quote handlers
  // ---------------------------------------------------------------------------

  static async createQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const userId = SalesOperationalController.getUserId(req);
      const useCase = new CreateQuoteUseCase(diContainer.quoteRepository, diContainer.salesSettingsRepository);
      const result = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });
      (res as any).status(201).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async updateQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const useCase = new UpdateQuoteUseCase(diContainer.quoteRepository);
      const result = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id: (req as any).params.id,
      });
      (res as any).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async getQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const useCase = new GetQuoteUseCase(diContainer.quoteRepository);
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async listQuotes(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const q = (req as any).query;
      const useCase = new ListQuotesUseCase(diContainer.quoteRepository);
      const results = await useCase.execute(companyId, {
        status: q.status as string | undefined,
        customerId: q.customerId as string | undefined,
      });
      (res as any).json({ success: true, data: results.map((r) => r.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async deleteQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const useCase = new DeleteQuoteUseCase(diContainer.quoteRepository);
      await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async sendQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const useCase = new SendQuoteUseCase(diContainer.quoteRepository);
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async acceptQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const useCase = new AcceptQuoteUseCase(diContainer.quoteRepository);
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async rejectQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const useCase = new RejectQuoteUseCase(diContainer.quoteRepository);
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async reviseQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const useCase = new ReviseQuoteUseCase(diContainer.quoteRepository, diContainer.salesSettingsRepository);
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async convertQuoteToSalesOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const createSalesOrderUseCase = new CreateSalesOrderUseCase(
        diContainer.salesSettingsRepository,
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.taxCodeRepository,
        diContainer.companyCurrencyRepository,
        diContainer.promotionRuleRepository
      );
      const useCase = new ConvertQuoteToSalesOrderUseCase(
        diContainer.quoteRepository,
        createSalesOrderUseCase
      );
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  static async convertQuoteToSalesInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const createSalesInvoiceUseCase = new CreateSalesInvoiceUseCase(
        diContainer.salesSettingsRepository,
        diContainer.salesInvoiceRepository,
        diContainer.salesOrderRepository,
        diContainer.partyRepository,
        diContainer.itemRepository,
        diContainer.itemCategoryRepository,
        diContainer.taxCodeRepository,
        diContainer.companyCurrencyRepository,
        diContainer.promotionRuleRepository
      );
      const useCase = new ConvertQuoteToSalesInvoiceUseCase(
        diContainer.quoteRepository,
        createSalesInvoiceUseCase
      );
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Promotion handlers
  // ---------------------------------------------------------------------------

  static async createPromotionRule(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const userId = SalesOperationalController.getUserId(req);
      const useCase = new CreatePromotionRuleUseCase(diContainer.promotionRuleRepository);
      const result = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        createdBy: userId,
      });
      (res as any).status(201).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async updatePromotionRule(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const useCase = new UpdatePromotionRuleUseCase(diContainer.promotionRuleRepository);
      const result = await useCase.execute({
        ...((req as any).body || {}),
        companyId,
        id: (req as any).params.id,
      });
      (res as any).json({ success: true, data: result.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async deletePromotionRule(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const useCase = new DeletePromotionRuleUseCase(diContainer.promotionRuleRepository);
      await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true });
    } catch (error) {
      next(error);
    }
  }

  static async getPromotionRule(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const useCase = new GetPromotionRuleUseCase(diContainer.promotionRuleRepository);
      const result = await useCase.execute(companyId, (req as any).params.id);
      (res as any).json({ success: true, data: result ? result.toJSON() : null });
    } catch (error) {
      next(error);
    }
  }

  static async listPromotionRules(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const useCase = new ListPromotionRulesUseCase(diContainer.promotionRuleRepository);
      const results = await useCase.execute(companyId);
      (res as any).json({ success: true, data: results.map((r) => r.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async evaluatePromotions(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const body = (req as any).body || {};
      const useCase = new EvaluatePromotionsUseCase(diContainer.promotionRuleRepository);
      const result = await useCase.execute({
        companyId,
        lines: body.lines,
        asOfDate: body.asOfDate,
      });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }

  // ---------------------------------------------------------------------------
  // Credit override + aged backlog
  // ---------------------------------------------------------------------------

  static async listCreditOverrides(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const q = (req as any).query;
      const rows = await diContainer.creditOverrideRepository.list(companyId, {
        customerId: q.customerId as string | undefined,
        sourceId: q.sourceId as string | undefined,
      });
      (res as any).json({ success: true, data: rows.map((r) => r.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async getAgedBacklog(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = SalesOperationalController.getCompanyId(req);
      const q = (req as any).query;
      const useCase = new GetAgedBacklogUseCase(diContainer.salesOrderRepository);
      const result = await useCase.execute({
        companyId,
        asOfDate: q.asOfDate as string | undefined,
      });
      (res as any).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
