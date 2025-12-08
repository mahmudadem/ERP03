"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyFeaturesController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ListCompanyFeaturesUseCase_1 = require("../../../application/company-admin/use-cases/ListCompanyFeaturesUseCase");
const ListActiveCompanyFeaturesUseCase_1 = require("../../../application/company-admin/use-cases/ListActiveCompanyFeaturesUseCase");
const ToggleFeatureFlagUseCase_1 = require("../../../application/company-admin/use-cases/ToggleFeatureFlagUseCase");
/**
 * CompanyFeaturesController
 * Handles company feature flag management
 */
class CompanyFeaturesController {
    /**
     * GET /company-admin/features
     * List all features
     */
    static async listFeatures(req, res, next) {
        try {
            const useCase = new ListCompanyFeaturesUseCase_1.ListCompanyFeaturesUseCase();
            const result = await useCase.execute();
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /company-admin/features/active
     * List active features
     */
    static async listActiveFeatures(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            const useCase = new ListActiveCompanyFeaturesUseCase_1.ListActiveCompanyFeaturesUseCase(bindRepositories_1.diContainer.companyRepository);
            const result = await useCase.execute({ companyId });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /company-admin/features/toggle
     * Toggle feature on/off
     */
    static async toggleFeature(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            const { featureName, enabled } = req.body;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            if (!featureName) {
                res.status(400).json({ success: false, error: 'Feature name required' });
                return;
            }
            const useCase = new ToggleFeatureFlagUseCase_1.ToggleFeatureFlagUseCase(bindRepositories_1.diContainer.companyRepository);
            const result = await useCase.execute({
                companyId,
                featureName,
                enabled
            });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CompanyFeaturesController = CompanyFeaturesController;
//# sourceMappingURL=CompanyFeaturesController.js.map