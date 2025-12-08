"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListActiveCompanyModulesUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class ListActiveCompanyModulesUseCase {
    constructor(companyRepository) {
        this.companyRepository = companyRepository;
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
        // Active modules array
        const active = company.modules || [];
        // Return enriched output
        return active.map(name => ({
            moduleName: name
        }));
    }
}
exports.ListActiveCompanyModulesUseCase = ListActiveCompanyModulesUseCase;
//# sourceMappingURL=ListActiveCompanyModulesUseCase.js.map