"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListActiveCompanyModulesUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class ListActiveCompanyModulesUseCase {
    constructor(companyRepository, companyModuleRepository) {
        this.companyRepository = companyRepository;
        this.companyModuleRepository = companyModuleRepository;
    }
    async execute(input) {
        // Validate companyId
        if (!input.companyId) {
            throw ApiError_1.ApiError.badRequest("Missing companyId");
        }
        // Load company
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound("Company not found");
        }
        if (this.companyModuleRepository) {
            const moduleStates = await this.companyModuleRepository.listByCompany(input.companyId);
            if (moduleStates.length > 0) {
                return moduleStates
                    .filter((moduleState) => moduleState.isEnabled)
                    .map((moduleState) => moduleState.moduleCode);
            }
        }
        // Legacy fallback for companies not yet backfilled to CompanyModule.
        const active = company.modules || [];
        // Return plain string array of active module IDs
        return active;
    }
}
exports.ListActiveCompanyModulesUseCase = ListActiveCompanyModulesUseCase;
//# sourceMappingURL=ListActiveCompanyModulesUseCase.js.map