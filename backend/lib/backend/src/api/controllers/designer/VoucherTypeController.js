"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoucherTypeController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ApiError_1 = require("../../errors/ApiError");
const DesignerDTOs_1 = require("../../dtos/DesignerDTOs");
class VoucherTypeController {
    static async getVoucherTypeByCode(req, res, next) {
        try {
            const code = req.params.code;
            // In a real implementation, we'd add a method 'findByCode' to the repo.
            // For MVP, we'll iterate or assume ID access.
            // Let's assume we fetch all and find, or assume the ID passed IS the code for simplicity in mock data.
            const allTypes = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getVoucherTypesForModule('ACCOUNTING');
            const def = allTypes.find(t => t.code === code);
            if (!def)
                throw ApiError_1.ApiError.notFound(`Voucher Type '${code}' not found`);
            // We return the raw definition structure because the frontend engine needs the full JSON, 
            // not the simplified DTO used for lists.
            res.status(200).json({
                success: true,
                data: def
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async listVoucherTypes(req, res, next) {
        try {
            const types = await bindRepositories_1.diContainer.voucherTypeDefinitionRepository.getVoucherTypesForModule('ACCOUNTING');
            res.status(200).json({
                success: true,
                data: types.map(DesignerDTOs_1.DesignerDTOMapper.toVoucherTypeDTO)
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.VoucherTypeController = VoucherTypeController;
//# sourceMappingURL=VoucherTypeController.js.map