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
    /**
     * Create a new voucher type
     */
    static async create(req: Request, res: Response, next: NextFunction) {
        try {
            const companyId = (req as any).user.companyId;
            const definition = req.body;

            if (!companyId) {
                throw ApiError.badRequest('Company context required');
            }

            // Ensure companyId is set on the definition
            definition.companyId = companyId;

            await diContainer.voucherTypeDefinitionRepository.createVoucherType(definition);
            
            // Return the created definition (mocking return since void)
            res.status(201).json({ success: true, data: definition });
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update an existing voucher type
     */
    static async update(req: Request, res: Response, next: NextFunction) {
        try {
            const companyId = (req as any).user.companyId;
            const { code } = req.params;
            const updates = req.body;

            if (!companyId) {
                throw ApiError.badRequest('Company context required');
            }

            // Get existing to find ID (repo updates by ID, not code, usually? Interface says ID)
            // But verify interface: updateVoucherType(companyId: string, id: string, ...)
            // We need the ID.
            const existing = await diContainer.voucherTypeDefinitionRepository.getByCode(companyId, code);
            if (!existing || !existing.id) {
                throw ApiError.notFound('Voucher type not found');
            }

            await diContainer.voucherTypeDefinitionRepository.updateVoucherType(companyId, existing.id, updates);

            res.json({ success: true, data: { ...existing, ...updates } });
        } catch (error) {
            next(error);
        }
    }
}
