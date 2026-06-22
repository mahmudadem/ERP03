import { NextFunction, Request, Response } from 'express';
import { PrintLayoutCore, PrintDocumentType } from '../../../application/system-core';
import {
  CreateDefaultPrintLayoutTemplateUseCase,
  DeletePrintLayoutTemplateUseCase,
  GetPrintLayoutTemplateUseCase,
  ListPrintLayoutTemplatesUseCase,
  SavePrintLayoutTemplateUseCase,
} from '../../../application/print-layout/PrintLayoutTemplateUseCases';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

const companyIdOf = (req: Request): string => {
  const companyId = (req as any).companyId || (req as any).tenant?.companyId || req.headers['x-company-id'];
  if (!companyId || Array.isArray(companyId)) throw new Error('Company context is required');
  return String(companyId);
};

const actorOf = (req: Request): string => {
  return String((req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || 'SYSTEM');
};

const core = new PrintLayoutCore();

export class PrintLayoutController {
  static async schema(req: Request, res: Response, next: NextFunction) {
    try {
      const documentType = String(req.params.documentType || req.query.documentType || 'POS_RECEIPT') as PrintDocumentType;
      res.json({ success: true, data: core.getDataSchema(documentType) });
    } catch (error) {
      next(error);
    }
  }

  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new ListPrintLayoutTemplatesUseCase(diContainer.printLayoutTemplateRepository);
      const data = await useCase.execute(companyIdOf(req), req.query.documentType as PrintDocumentType | undefined);
      res.json({ success: true, data: data.map((template) => template.toJSON()) });
    } catch (error) {
      next(error);
    }
  }

  static async get(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new GetPrintLayoutTemplateUseCase(diContainer.printLayoutTemplateRepository);
      const template = await useCase.execute(companyIdOf(req), req.params.id);
      res.json({ success: true, data: template.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async save(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new SavePrintLayoutTemplateUseCase(diContainer.printLayoutTemplateRepository, core);
      const template = await useCase.execute({
        companyId: companyIdOf(req),
        id: req.params.id || req.body.id,
        name: req.body.name,
        documentType: req.body.documentType,
        layout: req.body.layout,
        isDefault: req.body.isDefault,
        actorUserId: actorOf(req),
      });
      res.json({ success: true, data: template.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async createDefault(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new CreateDefaultPrintLayoutTemplateUseCase(diContainer.printLayoutTemplateRepository, core);
      const template = await useCase.execute(
        companyIdOf(req),
        String(req.body.documentType || req.query.documentType || 'POS_RECEIPT') as PrintDocumentType,
        actorOf(req)
      );
      res.json({ success: true, data: template.toJSON() });
    } catch (error) {
      next(error);
    }
  }

  static async remove(req: Request, res: Response, next: NextFunction) {
    try {
      const useCase = new DeletePrintLayoutTemplateUseCase(diContainer.printLayoutTemplateRepository);
      await useCase.execute(companyIdOf(req), req.params.id);
      res.json({ success: true, data: { deleted: true } });
    } catch (error) {
      next(error);
    }
  }
}
