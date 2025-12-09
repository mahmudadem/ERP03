import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';
import { VoucherTypeDefinition } from '../../../domain/designer/entities/VoucherTypeDefinition';
import { randomUUID } from 'crypto';

export class SuperAdminVoucherTypeController {
  
  static async listSystemTemplates(req: Request, res: Response, next: NextFunction) {
    try {
      const templates = await diContainer.voucherTypeDefinitionRepository.getSystemTemplates();
      (res as any).status(200).json({
        success: true,
        data: templates
      });
    } catch (error) {
      next(error);
    }
  }

  static async createSystemTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const payload = req.body;
      
      // Enforce SYSTEM scope
      const template = new VoucherTypeDefinition(
        randomUUID(),
        'SYSTEM',
        payload.name,
        payload.code,
        payload.module,
        payload.headerFields || [],
        payload.tableColumns || [],
        payload.layout || {},
        payload.workflow
      );

      await diContainer.voucherTypeDefinitionRepository.createVoucherType(template);

      (res as any).status(201).json({
        success: true,
        data: template
      });
    } catch (error) {
      next(error);
    }
  }

  static async updateSystemTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;
      const payload = req.body;

      // Ensure we are updating a SYSTEM template
      const existing = await diContainer.voucherTypeDefinitionRepository.getVoucherType('SYSTEM', id);
      if (!existing) throw ApiError.notFound('System template not found');

      await diContainer.voucherTypeDefinitionRepository.updateVoucherType('SYSTEM', id, payload);

      (res as any).status(200).json({
        success: true,
        message: 'Template updated'
      });
    } catch (error) {
      next(error);
    }
  }

  static async deleteSystemTemplate(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id;

      // Ensure we are deleting a SYSTEM template
      const existing = await diContainer.voucherTypeDefinitionRepository.getVoucherType('SYSTEM', id);
      if (!existing) throw ApiError.notFound('System template not found');

      await diContainer.voucherTypeDefinitionRepository.deleteVoucherType('SYSTEM', id);

      (res as any).status(200).json({
        success: true,
        message: 'Template deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }
}
