"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyModulesController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ListCompanyModulesUseCase_1 = require("../../../application/company-admin/use-cases/ListCompanyModulesUseCase");
const ListActiveCompanyModulesUseCase_1 = require("../../../application/company-admin/use-cases/ListActiveCompanyModulesUseCase");
const EnableModuleForCompanyUseCase_1 = require("../../../application/company-admin/use-cases/EnableModuleForCompanyUseCase");
const DisableModuleForCompanyUseCase_1 = require("../../../application/company-admin/use-cases/DisableModuleForCompanyUseCase");
/**
 * CompanyModulesController
 * Handles company module activation/deactivation
 */
class CompanyModulesController {
    /**
     * GET /company-admin/modules
     * List available modules
     */
    static async listModules(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            const useCase = new ListCompanyModulesUseCase_1.ListCompanyModulesUseCase();
            const result = await useCase.execute({ companyId });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /company-admin/modules/active
     * List active modules
     */
    static async listActiveModules(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            const useCase = new ListActiveCompanyModulesUseCase_1.ListActiveCompanyModulesUseCase(bindRepositories_1.diContainer.companyRepository);
            const result = await useCase.execute({ companyId });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /company-admin/modules/enable
     * Enable module
     */
    static async enableModule(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            const { moduleName } = req.body;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            if (!moduleName) {
                res.status(400).json({ success: false, error: 'Module name required' });
                return;
            }
            const useCase = new EnableModuleForCompanyUseCase_1.EnableModuleForCompanyUseCase(bindRepositories_1.diContainer.companyRepository);
            const result = await useCase.execute({ companyId, moduleName });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /company-admin/modules/disable
     * Disable module
     */
    static async disableModule(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            const { moduleName } = req.body;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            if (!moduleName) {
                res.status(400).json({ success: false, error: 'Module name required' });
                return;
            }
            const useCase = new DisableModuleForCompanyUseCase_1.DisableModuleForCompanyUseCase(bindRepositories_1.diContainer.companyRepository);
            const result = await useCase.execute({ companyId, moduleName });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CompanyModulesController = CompanyModulesController;
//# sourceMappingURL=CompanyModulesController.js.map