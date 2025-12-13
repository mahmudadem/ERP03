"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemMetadataController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const GetSystemMetadataUseCase_1 = require("../../../application/use-cases/system/GetSystemMetadataUseCase");
class SystemMetadataController {
    /**
     * GET /api/v1/system/metadata/currencies
     * Get list of available currencies
     */
    static async getCurrencies(req, res) {
        try {
            const useCase = new GetSystemMetadataUseCase_1.GetSystemMetadataUseCase(bindRepositories_1.diContainer.systemMetadataRepository);
            const currencies = await useCase.execute('currencies');
            res.json({
                success: true,
                data: currencies,
            });
        }
        catch (error) {
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
    static async getCoaTemplates(req, res) {
        try {
            const useCase = new GetSystemMetadataUseCase_1.GetSystemMetadataUseCase(bindRepositories_1.diContainer.systemMetadataRepository);
            const templates = await useCase.execute('coa_templates');
            res.json({
                success: true,
                data: templates,
            });
        }
        catch (error) {
            console.error('[SystemMetadataController] Error getting COA templates:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch COA templates',
            });
        }
    }
}
exports.SystemMetadataController = SystemMetadataController;
//# sourceMappingURL=SystemMetadataController.js.map