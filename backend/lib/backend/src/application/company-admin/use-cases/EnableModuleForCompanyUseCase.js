"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnableModuleForCompanyUseCase = void 0;
const ModuleAvailabilityService_1 = require("../../platform/ModuleAvailabilityService");
const ApiError_1 = require("../../../api/errors/ApiError");
const CompanyModule_1 = require("../../../domain/company/entities/CompanyModule");
class EnableModuleForCompanyUseCase {
    constructor(companyRepository, companyModuleRepository, entitlementRepository) {
        this.companyRepository = companyRepository;
        this.companyModuleRepository = companyModuleRepository;
        this.entitlementRepository = entitlementRepository;
    }
    async execute(input) {
        const moduleName = String(input.moduleName || '').trim().toLowerCase();
        if (!input.companyId || !moduleName) {
            throw ApiError_1.ApiError.badRequest('Missing required fields');
        }
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound('Company not found');
        }
        const service = ModuleAvailabilityService_1.ModuleAvailabilityService.getInstance();
        const availability = await service.isAvailableForCompany(moduleName, input.companyId);
        if (!availability.available) {
            switch (availability.state) {
                case ModuleAvailabilityService_1.ModuleAvailabilityState.DB_ONLY:
                    throw ApiError_1.ApiError.badRequest('Module implementation not found. Contact SuperAdmin.');
                case ModuleAvailabilityService_1.ModuleAvailabilityState.CODE_ONLY:
                    throw ApiError_1.ApiError.badRequest('Module not registered in the system. Contact SuperAdmin.');
                case ModuleAvailabilityService_1.ModuleAvailabilityState.IMPLEMENTATION_FAILED:
                    throw ApiError_1.ApiError.badRequest(`Module implementation check failed: ${availability.reason}`);
                case ModuleAvailabilityService_1.ModuleAvailabilityState.NOT_READY:
                    throw ApiError_1.ApiError.badRequest(`Module is not ready for use: ${availability.reason}`);
                case ModuleAvailabilityService_1.ModuleAvailabilityState.SUSPENDED:
                    throw ApiError_1.ApiError.custom(423, `Module is suspended: ${availability.reason}`);
                default:
                    throw ApiError_1.ApiError.badRequest(`Cannot enable module: ${availability.reason}`);
            }
        }
        const isEntitled = await this.entitlementRepository.hasModule(input.companyId, moduleName);
        if (!isEntitled) {
            throw ApiError_1.ApiError.forbidden('Company is not entitled to this module. Contact SuperAdmin to add subscription.');
        }
        const moduleState = await this.companyModuleRepository.get(input.companyId, moduleName);
        if (moduleState && moduleState.isEnabled) {
            return { moduleName, status: 'already_enabled' };
        }
        if (moduleState) {
            await this.companyModuleRepository.update(input.companyId, moduleName, {
                isEnabled: true,
                updatedAt: new Date(),
            });
        }
        else {
            await this.companyModuleRepository.create(CompanyModule_1.CompanyModuleEntity.create(input.companyId, moduleName));
        }
        return { moduleName, status: 'enabled' };
    }
}
exports.EnableModuleForCompanyUseCase = EnableModuleForCompanyUseCase;
//# sourceMappingURL=EnableModuleForCompanyUseCase.js.map