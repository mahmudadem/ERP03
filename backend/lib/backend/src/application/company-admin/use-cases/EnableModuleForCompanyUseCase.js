"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EnableModuleForCompanyUseCase = void 0;
const ModuleRegistry_1 = require("../../platform/ModuleRegistry");
const ApiError_1 = require("../../../api/errors/ApiError");
class EnableModuleForCompanyUseCase {
    constructor(companyRepository) {
        this.companyRepository = companyRepository;
    }
    async execute(input) {
        // Validate companyId + moduleName
        if (!input.companyId || !input.moduleName) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        // Confirm module exists in ModuleRegistry
        const module = ModuleRegistry_1.ModuleRegistry.getInstance().getModule(input.moduleName);
        if (!module) {
            throw ApiError_1.ApiError.badRequest("Invalid module");
        }
        // Load company
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound("Company not found");
        }
        // If already enabled → return early
        if (company.modules && company.modules.includes(input.moduleName)) {
            return { moduleName: input.moduleName, status: 'already_enabled' };
        }
        // Update
        const newModules = [...(company.modules || []), input.moduleName];
        await this.companyRepository.update(input.companyId, { modules: newModules });
        // Return success DTO
        return { moduleName: input.moduleName, status: 'enabled' };
    }
}
exports.EnableModuleForCompanyUseCase = EnableModuleForCompanyUseCase;
//# sourceMappingURL=EnableModuleForCompanyUseCase.js.map