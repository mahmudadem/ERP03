import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';

export class TemplatesController {
  static async listWizardTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await diContainer.companyWizardTemplateRepository.listAll();
      res.json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  }

  static async listCoaTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await diContainer.chartOfAccountsTemplateRepository.listChartOfAccountsTemplates();
      res.json({ success: true, data: templates });
    } catch (error) {
      next(error);
    }
  }

  static async listCurrencies(req: Request, res: Response, next: NextFunction) {
    try {
      const currencies = await diContainer.currencyRepository.listCurrencies();
      res.json({ success: true, data: currencies });
    } catch (error) {
      next(error);
    }
  }
}
