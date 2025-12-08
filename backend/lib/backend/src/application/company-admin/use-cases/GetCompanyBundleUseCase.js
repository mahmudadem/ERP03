"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCompanyBundleUseCase = void 0;
const Bundle_1 = require("../../../domain/platform/Bundle");
const ApiError_1 = require("../../../api/errors/ApiError");
class GetCompanyBundleUseCase {
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
        // Bundle value is stored in company.subscriptionPlan
        const bundleId = company.subscriptionPlan || 'starter';
        // Load bundle metadata from Bundles registry
        const bundle = Bundle_1.BUNDLES.find(b => b.id === bundleId);
        if (!bundle) {
            // Fallback to starter if bundle not found
            const starterBundle = Bundle_1.BUNDLES.find(b => b.id === 'starter');
            return Object.assign({ bundleId: 'starter' }, starterBundle);
        }
        // Return
        return Object.assign({ bundleId: bundle.id }, bundle);
    }
}
exports.GetCompanyBundleUseCase = GetCompanyBundleUseCase;
//# sourceMappingURL=GetCompanyBundleUseCase.js.map