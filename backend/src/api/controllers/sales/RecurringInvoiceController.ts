import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';
import {
  CreateRecurringInvoiceTemplateUseCase,
  UpdateRecurringInvoiceTemplateUseCase,
  PauseRecurringInvoiceTemplateUseCase,
  ResumeRecurringInvoiceTemplateUseCase,
  CancelRecurringInvoiceTemplateUseCase,
  GenerateRecurringInvoicesUseCase,
  CloneInvoiceAsTemplateUseCase,
} from '../../../application/sales/use-cases/RecurringInvoiceUseCases';
import { SalesDTOMapper } from '../../../api/dtos/SalesDTOs';

export class RecurringInvoiceController {
  private static getCompanyId(req: Request): string {
    const companyId = (req as any).user?.companyId;
    if (!companyId) {
      throw ApiError.badRequest('Company context not found');
    }
    return companyId;
  }

  private static getUserId(req: Request): string {
    const userId = (req as any).user?.uid || (req as any).user?.id;
    if (!userId) {
      throw ApiError.unauthorized('Authenticated user not found');
    }
    return userId;
  }

  private static validateCreatePayload(input: any): void {
    if (!input?.name?.trim()) {
      throw ApiError.badRequest('Template name is required');
    }
    if (!input?.customerId?.trim()) {
      throw ApiError.badRequest('Customer ID is required');
    }
    if (!input?.currency?.trim()) {
      throw ApiError.badRequest('Currency is required');
    }
    if (!input?.frequency?.trim()) {
      throw ApiError.badRequest('Frequency is required');
    }
    if (!input?.startDate?.trim()) {
      throw ApiError.badRequest('Start date is required');
    }
    if (!Array.isArray(input?.lines) || input.lines.length === 0) {
      throw ApiError.badRequest('At least one invoice line is required');
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = RecurringInvoiceController.getCompanyId(req);
      const opts: any = {};
      if (req.query.status) opts.status = req.query.status as string;
      if (req.query.customerId) opts.customerId = req.query.customerId as string;

      const templates = await diContainer.recurringInvoiceTemplateRepository.list(companyId, opts);
      (res as any).json({ success: true, data: templates.map((t) => t.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = RecurringInvoiceController.getCompanyId(req);
      const { id } = req.params;

      const template = await diContainer.recurringInvoiceTemplateRepository.findById(companyId, id);
      if (!template) {
        return (res as any).status(404).json({ success: false, error: 'Template not found' });
      }
      (res as any).json({ success: true, data: template.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = RecurringInvoiceController.getCompanyId(req);
      const userId = RecurringInvoiceController.getUserId(req);
      const input = (req as any).body;
      RecurringInvoiceController.validateCreatePayload(input);

      const useCase = new CreateRecurringInvoiceTemplateUseCase(
        diContainer.recurringInvoiceTemplateRepository,
        diContainer.salesSettingsRepository
      );
      const template = await useCase.execute(companyId, userId, input);
      (res as any).status(201).json({ success: true, data: template.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = RecurringInvoiceController.getCompanyId(req);
      const userId = RecurringInvoiceController.getUserId(req);
      const { id } = req.params;
      const partial = (req as any).body;

      const useCase = new UpdateRecurringInvoiceTemplateUseCase(diContainer.recurringInvoiceTemplateRepository);
      const template = await useCase.execute(companyId, userId, id, partial);
      (res as any).json({ success: true, data: template.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async pause(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = RecurringInvoiceController.getCompanyId(req);
      const userId = RecurringInvoiceController.getUserId(req);
      const { id } = req.params;

      const useCase = new PauseRecurringInvoiceTemplateUseCase(diContainer.recurringInvoiceTemplateRepository);
      const template = await useCase.execute(companyId, userId, id);
      (res as any).json({ success: true, data: template.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async resume(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = RecurringInvoiceController.getCompanyId(req);
      const userId = RecurringInvoiceController.getUserId(req);
      const { id } = req.params;

      const useCase = new ResumeRecurringInvoiceTemplateUseCase(diContainer.recurringInvoiceTemplateRepository);
      const template = await useCase.execute(companyId, userId, id);
      (res as any).json({ success: true, data: template.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async cancel(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = RecurringInvoiceController.getCompanyId(req);
      const userId = RecurringInvoiceController.getUserId(req);
      const { id } = req.params;

      const useCase = new CancelRecurringInvoiceTemplateUseCase(diContainer.recurringInvoiceTemplateRepository);
      const template = await useCase.execute(companyId, userId, id);
      (res as any).json({ success: true, data: template.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = RecurringInvoiceController.getCompanyId(req);
      RecurringInvoiceController.getUserId(req); // auth guard
      const { id } = req.params;

      // Only cancelled templates can be permanently deleted. Active/paused must
      // be cancelled first — prevents accidentally wiping a live schedule.
      const existing = await diContainer.recurringInvoiceTemplateRepository.findById(companyId, id);
      if (!existing) {
        return (res as any).status(404).json({ success: false, error: 'Template not found' });
      }
      if (existing.status !== 'CANCELLED') {
        throw ApiError.badRequest('Only cancelled templates can be deleted. Cancel the template first.');
      }

      await diContainer.recurringInvoiceTemplateRepository.delete(companyId, id);
      (res as any).status(204).end();
    } catch (error) {
      next(error);
    }
  }

  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = RecurringInvoiceController.getCompanyId(req);
      const userId = RecurringInvoiceController.getUserId(req);
      const asOfDate = (req as any).body?.asOfDate || new Date().toISOString().slice(0, 10);

      const useCase = new GenerateRecurringInvoicesUseCase(
        diContainer.recurringInvoiceTemplateRepository,
        diContainer.salesInvoiceRepository,
        diContainer.salesSettingsRepository,
        diContainer.numberingEngine
      );
      const invoices = await useCase.execute(companyId, userId, asOfDate);
      (res as any).json({ success: true, data: invoices.map((si) => SalesDTOMapper.toSalesInvoiceDTO(si)) });
    } catch (error) {
      next(error);
    }
  }

  static async cloneToTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = RecurringInvoiceController.getCompanyId(req);
      const userId = RecurringInvoiceController.getUserId(req);
      const { invoiceId } = req.params;
      const body = (req as any).body;

      if (!body?.name?.trim() || !body?.frequency?.trim()) {
        return (res as any).status(400).json({ success: false, error: 'Missing required fields: name, frequency' });
      }

      const useCase = new CloneInvoiceAsTemplateUseCase(
        diContainer.recurringInvoiceTemplateRepository,
        diContainer.salesInvoiceRepository
      );
      const template = await useCase.execute(
        companyId,
        userId,
        invoiceId,
        body.name.trim(),
        body.frequency,
        body.dayOfMonth,
        body.dayOfWeek,
        body.startDate,
        body.endDate,
        body.maxOccurrences
      );
      (res as any).status(201).json({ success: true, data: template.toJSON() });
    } catch (error) {
      next(error);
    }
  }
}
