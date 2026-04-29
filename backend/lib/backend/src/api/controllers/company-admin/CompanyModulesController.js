"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompanyModulesController = void 0;
const bindRepositories_1 = require("../../../infrastructure/di/bindRepositories");
const ListCompanyModulesUseCase_1 = require("../../../application/company-admin/use-cases/ListCompanyModulesUseCase");
const ListActiveCompanyModulesUseCase_1 = require("../../../application/company-admin/use-cases/ListActiveCompanyModulesUseCase");
const EnableModuleForCompanyUseCase_1 = require("../../../application/company-admin/use-cases/EnableModuleForCompanyUseCase");
const DisableModuleForCompanyUseCase_1 = require("../../../application/company-admin/use-cases/DisableModuleForCompanyUseCase");
const EnableCapabilityForCompanyUseCase_1 = require("../../../application/company-admin/use-cases/EnableCapabilityForCompanyUseCase");
const DisableCapabilityForCompanyUseCase_1 = require("../../../application/company-admin/use-cases/DisableCapabilityForCompanyUseCase");
const CompanyVoucherTemplateSyncService_1 = require("../../../application/system/services/CompanyVoucherTemplateSyncService");
const CompanyModuleAccessResolver_1 = require("../../../application/company-admin/services/CompanyModuleAccessResolver");
const CompanyCapabilityAccessResolver_1 = require("../../../application/company-admin/services/CompanyCapabilityAccessResolver");
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
            const useCase = new ListCompanyModulesUseCase_1.ListCompanyModulesUseCase(bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.companyModuleRepository);
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
            const useCase = new ListActiveCompanyModulesUseCase_1.ListActiveCompanyModulesUseCase(bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.companyModuleRepository);
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
            const useCase = new EnableModuleForCompanyUseCase_1.EnableModuleForCompanyUseCase(bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.companyModuleRepository, bindRepositories_1.diContainer.companyEntitlementRepository);
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
            const useCase = new DisableModuleForCompanyUseCase_1.DisableModuleForCompanyUseCase(bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.companyModuleRepository);
            const result = await useCase.execute({ companyId, moduleName });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * GET /company-admin/capabilities
     * List available capabilities for company
     */
    static async listCapabilities(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            const company = await bindRepositories_1.diContainer.companyRepository.findById(companyId);
            if (!company) {
                res.status(404).json({ success: false, error: 'Company not found' });
                return;
            }
            const companyModules = await bindRepositories_1.diContainer.companyModuleRepository.listByCompany(companyId);
            const entitledModules = await bindRepositories_1.diContainer.entitlementService.getEntitledModules(companyId);
            const companyEnabledModules = (0, CompanyModuleAccessResolver_1.resolveCompanyEnabledModules)({
                companyModules,
                legacyModules: (company.modules || []),
                entitledModules,
            });
            const availableParentModules = await (0, CompanyModuleAccessResolver_1.filterRuntimeAvailableModules)(companyId, companyEnabledModules);
            const result = await (0, CompanyCapabilityAccessResolver_1.resolveCompanyCapabilityAccess)({
                companyId,
                accessibleModules: availableParentModules,
                capabilityRepository: bindRepositories_1.diContainer.capabilityRegistryRepository,
                entitlementRepository: bindRepositories_1.diContainer.companyEntitlementRepository,
            });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /company-admin/capabilities/enable
     * Enable a capability
     */
    static async enableCapability(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            const { capabilityCode } = req.body;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            if (!capabilityCode) {
                res.status(400).json({ success: false, error: 'Capability code required' });
                return;
            }
            const useCase = new EnableCapabilityForCompanyUseCase_1.EnableCapabilityForCompanyUseCase(bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.capabilityRegistryRepository, bindRepositories_1.diContainer.companyEntitlementRepository, bindRepositories_1.diContainer.companyModuleRepository);
            const result = await useCase.execute({ companyId, capabilityCode });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /company-admin/capabilities/disable
     * Disable a capability
     */
    static async disableCapability(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            const { capabilityCode } = req.body;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            if (!capabilityCode) {
                res.status(400).json({ success: false, error: 'Capability code required' });
                return;
            }
            const useCase = new DisableCapabilityForCompanyUseCase_1.DisableCapabilityForCompanyUseCase(bindRepositories_1.diContainer.companyRepository, bindRepositories_1.diContainer.capabilityRegistryRepository);
            const result = await useCase.execute({ companyId, capabilityCode });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
    /**
     * POST /company-admin/modules/:module/sync-voucher-types
     * Sync voucher types from system catalog for a specific module
     */
    static async syncVoucherTypes(req, res, next) {
        var _a;
        try {
            const companyId = (_a = req.tenantContext) === null || _a === void 0 ? void 0 : _a.companyId;
            const { module } = req.params;
            if (!companyId) {
                res.status(400).json({ success: false, error: 'Company ID required' });
                return;
            }
            if (!module) {
                res.status(400).json({ success: false, error: 'Module name required' });
                return;
            }
            const result = await (0, CompanyVoucherTemplateSyncService_1.syncCompanyVoucherTemplatesFromSystem)({
                companyId,
                modules: [module],
                createdBy: 'SYSTEM',
                voucherTypeRepo: bindRepositories_1.diContainer.voucherTypeDefinitionRepository,
                voucherFormRepo: bindRepositories_1.diContainer.voucherFormRepository,
            });
            res.json({ success: true, data: result });
        }
        catch (error) {
            next(error);
        }
    }
}
exports.CompanyModulesController = CompanyModulesController;
//# sourceMappingURL=CompanyModulesController.js.map