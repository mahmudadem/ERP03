"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetCompanyBundleUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class GetCompanyBundleUseCase {
    constructor(companyRepository, bundleRepo) {
        this.companyRepository = companyRepository;
        this.bundleRepo = bundleRepo;
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
        const bundleId = company.subscriptionPlan;
        if (!bundleId) {
            return null;
        }
        // Load bundle metadata from Firestore
        const bundle = await this.bundleRepo.getById(bundleId);
        if (!bundle) {
            // Bundle not found
            return null;
        }
        // Return
        return Object.assign({ bundleId: bundle.id }, bundle);
    }
}
exports.GetCompanyBundleUseCase = GetCompanyBundleUseCase;
//# sourceMappingURL=GetCompanyBundleUseCase.js.map