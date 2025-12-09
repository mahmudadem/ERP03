"use strict";
/**
 * AccountingDesignerController.ts
 *
 * Handles voucher designer operations for the accounting module.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountingDesignerController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ApiError_1 = require("../../errors/ApiError");
class AccountingDesignerController {
    /**
     * Get voucher type definitions for a company
     */
    static async getVoucherTypes(req, res, next) {
        try {
            const companyId = req.user.companyId;
            if (!companyId) {
                throw ApiError_1.ApiError.badRequest('Company context required');
            }
            const voucherTypes = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getByCompanyId(companyId);
            res.json({ success: true, data: voucherTypes });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Get a specific voucher type by code
     */
    static async getVoucherTypeByCode(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const { code } = req.params;
            if (!companyId) {
                throw ApiError_1.ApiError.badRequest('Company context required');
            }
            const voucherType = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getByCode(companyId, code);
            if (!voucherType) {
                throw ApiError_1.ApiError.notFound('Voucher type not found');
            }
            res.json({ success: true, data: voucherType });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Save voucher type layout/design
     */
    static async saveVoucherTypeLayout(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const { code } = req.params;
            const { layout } = req.body;
            if (!companyId) {
                throw ApiError_1.ApiError.badRequest('Company context required');
            }
            // Update the voucher type with new layout
            await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.updateLayout(companyId, code, layout);
            res.json({ success: true, message: 'Layout saved successfully' });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Create a new voucher type
     */
    static async create(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const definition = req.body;
            if (!companyId) {
                throw ApiError_1.ApiError.badRequest('Company context required');
            }
            // Ensure companyId is set on the definition
            definition.companyId = companyId;
            await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.createVoucherType(definition);
            // Return the created definition (mocking return since void)
            res.status(201).json({ success: true, data: definition });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * Update an existing voucher type
     */
    static async update(req, res, next) {
        try {
            const companyId = req.user.companyId;
            const { code } = req.params;
            const updates = req.body;
            if (!companyId) {
                throw ApiError_1.ApiError.badRequest('Company context required');
            }
            // Get existing to find ID (repo updates by ID, not code, usually? Interface says ID)
            // But verify interface: updateVoucherType(companyId: string, id: string, ...)
            // We need the ID.
            const existing = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getByCode(companyId, code);
            if (!existing || !existing.id) {
                throw ApiError_1.ApiError.notFound('Voucher type not found');
            }
            await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.updateVoucherType(companyId, existing.id, updates);
            res.json({ success: true, data: Object.assign(Object.assign({}, existing), updates) });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.AccountingDesignerController = AccountingDesignerController;
//# sourceMappingURL=AccountingDesignerController.js.map