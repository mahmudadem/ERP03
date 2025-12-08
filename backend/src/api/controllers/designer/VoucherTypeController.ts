
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
      const companyId = (req as any).user.companyId;
      
      const def = await diContainer.voucherTypeDefinitionRepository.getByCode(companyId, code);

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
      const companyId = (req as any).user.companyId;
      const types = await diContainer.voucherTypeDefinitionRepository.getVoucherTypesForModule(companyId, 'ACCOUNTING');
      (res as any).status(200).json({
        success: true,
        data: types.map(DesignerDTOMapper.toVoucherTypeDTO)
      });
    } catch (error) {
      next(error);
    }
  }
}
