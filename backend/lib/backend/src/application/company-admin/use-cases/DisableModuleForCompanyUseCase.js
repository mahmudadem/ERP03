"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisableModuleForCompanyUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class DisableModuleForCompanyUseCase {
    constructor(companyRepository) {
        this.companyRepository = companyRepository;
    }
    async execute(input) {
        // Validate companyId + moduleName
        if (!input.companyId || !input.moduleName) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        // Load company
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound("Company not found");
        }
        // If module not active → throw error
        if (!company.modules || !company.modules.includes(input.moduleName)) {
            throw ApiError_1.ApiError.badRequest("Module is not enabled for this company");
        }
        // Ensure safe modules (DO NOT allow disabling "core" module)
        if (input.moduleName === 'core') {
            throw ApiError_1.ApiError.forbidden("Cannot disable core module");
        }
        // Remove from list
        const newModules = company.modules.filter(m => m !== input.moduleName);
        await this.companyRepository.update(input.companyId, { modules: newModules });
        // Return success DTO
        return { moduleName: input.moduleName, status: 'disabled' };
    }
}
exports.DisableModuleForCompanyUseCase = DisableModuleForCompanyUseCase;
//# sourceMappingURL=DisableModuleForCompanyUseCase.js.map