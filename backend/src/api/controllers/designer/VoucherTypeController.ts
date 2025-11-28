
/**
 * VoucherTypeController.ts
 */
import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';
import { DesignerDTOMapper } from '../../dtos/DesignerDTOs';

export class VoucherTypeController {
  
  static async getVoucherTypeByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const code = (req as any).params.code;
      // In a real implementation, we'd add a method 'findByCode' to the repo.
      // For MVP, we'll iterate or assume ID access.
      // Let's assume we fetch all and find, or assume the ID passed IS the code for simplicity in mock data.
      
      const allTypes = await diContainer.voucherTypeDefinitionRepository.getVoucherTypesForModule('ACCOUNTING');
      const def = allTypes.find(t => t.code === code);

      if (!def) throw ApiError.notFound(`Voucher Type '${code}' not found`);

      // We return the raw definition structure because the frontend engine needs the full JSON, 
      // not the simplified DTO used for lists.
      (res as any).status(200).json({
        success: true,
        data: def 
      });
    } catch (error) {
      next(error);
    }
  }

  static async listVoucherTypes(req: Request, res: Response, next: NextFunction) {
    try {
      const types = await diContainer.voucherTypeDefinitionRepository.getVoucherTypesForModule('ACCOUNTING');
      (res as any).status(200).json({
        success: true,
        data: types.map(DesignerDTOMapper.toVoucherTypeDTO)
      });
    } catch (error) {
      next(error);
    }
  }
}
