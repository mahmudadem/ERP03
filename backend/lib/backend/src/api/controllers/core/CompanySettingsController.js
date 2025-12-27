"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanySettingsController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ApiError_1 = require("../../errors/ApiError");
const CompanySettingsDTO_1 = require("../../dtos/CompanySettingsDTO");
class CompanySettingsController {
    static async getSettings(req, res, next) {
        var _a;
        try {
            const companyId = req.companyId || req.query.companyId || ((_a = req.body) === null || _a === void 0 ? void 0 : _a.companyId);
            if (!companyId)
                throw ApiError_1.ApiError.badRequest('Company Context Missing');
            const settings = await bindRepositories_1.diContainer.companySettingsRepository.getSettings(companyId);
            res.status(200).json({
                success: true,
                data: CompanySettingsDTO_1.CompanySettingsDTOMapper.toDTO(settings)
            });
        }
        catch (error) {
            next(error);
        }
    }
    static async updateSettings(req, res, next) {
        var _a;
        try {
            const companyId = req.companyId || req.query.companyId || ((_a = req.body) === null || _a === void 0 ? void 0 : _a.companyId);
            if (!companyId)
                throw ApiError_1.ApiError.badRequest('Company Context Missing');
            const { strictApprovalMode, uiMode, timezone, dateFormat } = req.body;
            await bindRepositories_1.diContainer.companySettingsRepository.updateSettings(companyId, {
                strictApprovalMode,
                uiMode,
                timezone,
                dateFormat
            });
            res.status(200).json({
                success: true,
                message: 'Settings updated'
            });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CompanySettingsController = CompanySettingsController;
//# sourceMappingURL=CompanySettingsController.js.map