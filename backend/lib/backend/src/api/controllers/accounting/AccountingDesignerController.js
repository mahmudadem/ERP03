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
}
exports.AccountingDesignerController = AccountingDesignerController;
//# sourceMappingURL=AccountingDesignerController.js.map