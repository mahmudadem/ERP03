"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SuperAdminEntitlementsController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const GrantModuleToCompanyUseCase_1 = require("../../../application/super-admin/use-cases/GrantModuleToCompanyUseCase");
const RevokeModuleFromCompanyUseCase_1 = require("../../../application/super-admin/use-cases/RevokeModuleFromCompanyUseCase");
class SuperAdminEntitlementsController {
    /**
     * GET /super-admin/companies/:companyId/entitlements
     * List all entitled modules for a company
     */
    static async listModules(req, res, next) {
        try {
            const { companyId } = req.params;
            const entitledModules = await bindRepositories_1.diContainer.entitlementService.getEntitledModules(companyId);
            // Also get full entitlement details
            const entitlements = await bindRepositories_1.diContainer.companyEntitlementRepository.getActiveByCompanyId(companyId);
            res.json({ success: true, data: { modules: entitledModules, entitlements } });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /super-admin/companies/:companyId/entitlements/modules
     * Grant a module to a company
     */
    static async grantModule(req, res, next) {
        try {
            const { companyId } = req.params;
            const { moduleKey } = req.body;
            if (!moduleKey || typeof moduleKey !== 'string') {
                res.status(400).json({ success: false, message: 'moduleKey is required' });
                return;
            }
            const useCase = new GrantModuleToCompanyUseCase_1.GrantModuleToCompanyUseCase(bindRepositories_1.diContainer.entitlementService, bindRepositories_1.diContainer.moduleRegistryRepository);
            await useCase.execute(companyId, moduleKey);
            res.status(201).json({ success: true, message: `Module '${moduleKey}' granted to company.` });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * DELETE /super-admin/companies/:companyId/entitlements/modules/:moduleKey
     * Revoke a module from a company
     */
    static async revokeModule(req, res, next) {
        try {
            const { companyId, moduleKey } = req.params;
            const useCase = new RevokeModuleFromCompanyUseCase_1.RevokeModuleFromCompanyUseCase(bindRepositories_1.diContainer.entitlementService);
            await useCase.execute(companyId, moduleKey);
            res.json({ success: true, message: `Module '${moduleKey}' revoked from company.` });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.SuperAdminEntitlementsController = SuperAdminEntitlementsController;
//# sourceMappingURL=SuperAdminEntitlementsController.js.map