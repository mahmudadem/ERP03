"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListActiveCompanyFeaturesUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class ListActiveCompanyFeaturesUseCase {
    constructor(companyRepository) {
        this.companyRepository = companyRepository;
    }
    async execute(input) {
        var _a;
        // Validate companyId
        if (!input.companyId) {
            throw ApiError_1.ApiError.badRequest("Missing companyId");
        }
        // Load company
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound("Company not found");
        }
        // Ensure company.features exists
        const active = (_a = company.features) !== null && _a !== void 0 ? _a : [];
        // Return
        return active;
    }
}
exports.ListActiveCompanyFeaturesUseCase = ListActiveCompanyFeaturesUseCase;
//# sourceMappingURL=ListActiveCompanyFeaturesUseCase.js.map