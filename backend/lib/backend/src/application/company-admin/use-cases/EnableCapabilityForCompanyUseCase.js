"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnableCapabilityForCompanyUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
const CompanyModuleAccessResolver_1 = require("../services/CompanyModuleAccessResolver");
class EnableCapabilityForCompanyUseCase {
    constructor(companyRepository, capabilityRepository, entitlementRepository, companyModuleRepository) {
        this.companyRepository = companyRepository;
        this.capabilityRepository = capabilityRepository;
        this.entitlementRepository = entitlementRepository;
        this.companyModuleRepository = companyModuleRepository;
    }
    async execute(input) {
        const capabilityCode = String(input.capabilityCode || '').trim().toLowerCase();
        if (!input.companyId || !capabilityCode) {
            throw ApiError_1.ApiError.badRequest('Missing required fields');
        }
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound('Company not found');
        }
        const capability = await this.capabilityRepository.getByCode(capabilityCode);
        if (!capability) {
            throw ApiError_1.ApiError.notFound('Capability not found');
        }
        if (capability.lifecycleStatus !== 'ready') {
            throw ApiError_1.ApiError.badRequest(`Capability is not ready for use: ${capability.lifecycleStatus}`);
        }
        if (capability.runtimeStatus !== 'available') {
            throw ApiError_1.ApiError.custom(423, `Capability is suspended`);
        }
        if (capability.implementationStatus !== 'passed') {
            throw ApiError_1.ApiError.badRequest('Capability implementation check not passed');
        }
        if (capability.enablementPolicy !== 'company_admin_optional') {
            throw ApiError_1.ApiError.forbidden('This capability cannot be enabled by Company Admin');
        }
        const isEntitled = await this.entitlementRepository.hasCapability(input.companyId, capabilityCode);
        if (!isEntitled) {
            throw ApiError_1.ApiError.forbidden('Company is not entitled to this capability');
        }
        const [companyModules, entitledModules] = await Promise.all([
            this.companyModuleRepository.listByCompany(input.companyId),
            this.entitlementRepository.getEffectiveModules(input.companyId),
        ]);
        const companyEnabledModules = (0, CompanyModuleAccessResolver_1.resolveCompanyEnabledModules)({
            companyModules,
            legacyModules: (company.modules || []),
            entitledModules,
        });
        const availableParentModules = await (0, CompanyModuleAccessResolver_1.filterRuntimeAvailableModules)(input.companyId, companyEnabledModules);
        if (!availableParentModules.includes(capability.moduleId.toLowerCase())) {
            throw ApiError_1.ApiError.badRequest(`Parent module ${capability.moduleId} must be enabled and available first`);
        }
        await this.capabilityRepository.setEnabled(input.companyId, capabilityCode, true);
        return { capabilityCode, status: 'enabled' };
    }
}
exports.EnableCapabilityForCompanyUseCase = EnableCapabilityForCompanyUseCase;
//# sourceMappingURL=EnableCapabilityForCompanyUseCase.js.map