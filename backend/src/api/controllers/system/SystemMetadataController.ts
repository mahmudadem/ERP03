import { Request, Response } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { GetSystemMetadataUseCase } from '../../../application/use-cases/system/GetSystemMetadataUseCase';

export class SystemMetadataController {
  /**
   * GET /api/v1/system/metadata/currencies
   * Get list of available currencies
   */
  static async getCurrencies(req: Request, res: Response) {
    try {
      const useCase = new GetSystemMetadataUseCase(diContainer.systemMetadataRepository);
      const currencies = await useCase.execute('currencies');

      res.json({
        success: true,
        data: currencies,
      });
    } catch (error) {
      console.error('[SystemMetadataController] Error getting currencies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch currencies',
      });
    }
  }

  /**
   * GET /api/v1/system/metadata/coa-templates
   * Get list of  available COA templates
   */
  static async getCoaTemplates(req: Request, res: Response) {
    try {
      const useCase = new GetSystemMetadataUseCase(diContainer.systemMetadataRepository);
      const templates = await useCase.execute('coa_templates');

      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      console.error('[SystemMetadataController] Error getting COA templates:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch COA templates',
      });
    }
  }
}
