/**
 * AccountingDesignerController.ts
 * 
 * Handles voucher designer operations for the accounting module.
 */

import { Request, Response, NextFunction } from 'express';
import { diContainer } from '../../../infrastructure/di/bindRepositories';
import { ApiError } from '../../errors/ApiError';

export class AccountingDesignerController {
    /**
     * Get voucher type definitions for a company
     */
    static async getVoucherTypes(req: Request, res: Response, next: NextFunction) {
        try {
            const companyId = (req as any).user.companyId;
            if (!companyId) {
                throw ApiError.badRequest('Company context required');
            }

            const voucherTypes = await diContainer.voucherTypeDefinitionRepository.getByCompanyId(companyId);
            res.json({ success: true, data: voucherTypes });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get a specific voucher type by code
     */
    static async getVoucherTypeByCode(req: Request, res: Response, next: NextFunction) {
        try {
            const companyId = (req as any).user.companyId;
            const { code } = req.params;

            if (!companyId) {
                throw ApiError.badRequest('Company context required');
            }

            const voucherType = await diContainer.voucherTypeDefinitionRepository.getByCode(companyId, code);
            if (!voucherType) {
                throw ApiError.notFound('Voucher type not found');
            }

            res.json({ success: true, data: voucherType });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Save voucher type layout/design
     */
    static async saveVoucherTypeLayout(req: Request, res: Response, next: NextFunction) {
        try {
            const companyId = (req as any).user.companyId;
            const { code } = req.params;
            const { layout } = req.body;

            if (!companyId) {
                throw ApiError.badRequest('Company context required');
            }

            // Update the voucher type with new layout
            await diContainer.voucherTypeDefinitionRepository.updateLayout(companyId, code, layout);

            res.json({ success: true, message: 'Layout saved successfully' });
        } catch (error) {
            next(error);
        }
    }
}
