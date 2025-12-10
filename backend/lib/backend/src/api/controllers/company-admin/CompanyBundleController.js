"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyBundleController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const GetCompanyBundleUseCase_1 = require("../../../application/company-admin/use-cases/GetCompanyBundleUseCase");
const ListAvailableBundlesUseCase_1 = require("../../../application/company-admin/use-cases/ListAvailableBundlesUseCase");
const UpgradeCompanyBundleUseCase_1 = require("../../../application/company-admin/use-cases/UpgradeCompanyBundleUseCase");
/**
 * CompanyBundleController
 * Handles company bundle management
 */
class CompanyBundleController {
    /**
     * GET /company-admin/bundle
     * Get current bundle
     */
    static async getCurrentBundle(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            const useCase = new GetCompanyBundleUseCase_1.GetCompanyBundleUseCase(bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.bundleRegistryRepository);
            const result = await useCase.execute({ companyId });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /company-admin/bundle/available
     * List available bundles
     */
    static async listAvailableBundles(req, res, next) {
        try {
            const useCase = new ListAvailableBundlesUseCase_1.ListAvailableBundlesUseCase(bindRepositories_1.diContainer.bundleRegistryRepository);
            const result = await useCase.execute();
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /company-admin/bundle/upgrade
     * Upgrade to new bundle
     */
    static async upgradeBundle(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            const { bundleId } = req.body;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            if (!bundleId) {
                res.status(400).json({ success: false, error: 'Bundle ID required' });
                return;
            }
            const useCase = new UpgradeCompanyBundleUseCase_1.UpgradeCompanyBundleUseCase(bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.bundleRegistryRepository);
            const result = await useCase.execute({ companyId, bundleId });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CompanyBundleController = CompanyBundleController;
//# sourceMappingURL=CompanyBundleController.js.map