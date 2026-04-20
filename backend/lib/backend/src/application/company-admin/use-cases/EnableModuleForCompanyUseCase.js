"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnableModuleForCompanyUseCase = void 0;
const ModuleRegistry_1 = require("../../platform/ModuleRegistry");
const ApiError_1 = require("../../../api/errors/ApiError");
const CompanyModule_1 = require("../../../domain/company/entities/CompanyModule");
class EnableModuleForCompanyUseCase {
    constructor(companyRepository, companyModuleRepository) {
        this.companyRepository = companyRepository;
        this.companyModuleRepository = companyModuleRepository;
    }
    async execute(input) {
        var _a, _b;
        // Validate companyId + moduleName
        const moduleName = String(input.moduleName || '').trim().toLowerCase();
        if (!input.companyId || !moduleName) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        // Confirm module exists in ModuleRegistry
        const module = ModuleRegistry_1.ModuleRegistry.getInstance().getModule(moduleName);
        if (!module) {
            throw ApiError_1.ApiError.badRequest("Invalid module");
        }
        // Load company
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound("Company not found");
        }
        // If already enabled → return early
        const normalizedModules = (company.modules || [])
            .map((m) => String(m || '').trim().toLowerCase())
            .filter(Boolean);
        if (normalizedModules.includes(moduleName)) {
            const moduleState = await this.companyModuleRepository.get(input.companyId, moduleName);
            if (!moduleState) {
                await this.companyModuleRepository.create(CompanyModule_1.CompanyModuleEntity.create(input.companyId, moduleName));
            }
            else if ((_a = moduleState.config) === null || _a === void 0 ? void 0 : _a.isImplicit) {
                await this.companyModuleRepository.update(input.companyId, moduleName, {
                    config: Object.assign(Object.assign({}, moduleState.config), { isImplicit: false }),
                    updatedAt: new Date(),
                });
            }
            return { moduleName, status: 'already_enabled' };
        }
        // Update company active modules list
        const newModules = Array.from(new Set([...normalizedModules, moduleName]));
        await this.companyRepository.update(input.companyId, { modules: newModules });
        // Ensure module-state record exists for initialization workflow
        const moduleState = await this.companyModuleRepository.get(input.companyId, moduleName);
        if (!moduleState) {
            await this.companyModuleRepository.create(CompanyModule_1.CompanyModuleEntity.create(input.companyId, moduleName));
        }
        else if ((_b = moduleState.config) === null || _b === void 0 ? void 0 : _b.isImplicit) {
            await this.companyModuleRepository.update(input.companyId, moduleName, {
                config: Object.assign(Object.assign({}, moduleState.config), { isImplicit: false }),
                updatedAt: new Date(),
            });
        }
        // Return success DTO
        return { moduleName, status: 'enabled' };
    }
}
exports.EnableModuleForCompanyUseCase = EnableModuleForCompanyUseCase;
//# sourceMappingURL=EnableModuleForCompanyUseCase.js.map