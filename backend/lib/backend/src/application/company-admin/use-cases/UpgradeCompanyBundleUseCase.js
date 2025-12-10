"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpgradeCompanyBundleUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class UpgradeCompanyBundleUseCase {
    constructor(companyRepository, bundleRepo) {
        this.companyRepository = companyRepository;
        this.bundleRepo = bundleRepo;
    }
    async execute(input) {
        // Validate companyId + bundleId
        if (!input.companyId || !input.bundleId) {
            throw ApiError_1.ApiError.badRequest("Missing required fields");
        }
        // Confirm new bundle exists in Firestore
        const bundle = await this.bundleRepo.getById(input.bundleId);
        if (!bundle) {
            throw ApiError_1.ApiError.badRequest("Invalid bundle");
        }
        // Load company
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound("Company not found");
        }
        // If already on this bundle → return early
        if (company.subscriptionPlan === input.bundleId) {
            return { bundleId: input.bundleId, status: 'already_active' };
        }
        // Update
        await this.companyRepository.update(input.companyId, {
            subscriptionPlan: input.bundleId,
            modules: bundle.modulesIncluded
        });
        // Return success DTO
        return { bundleId: input.bundleId, status: 'upgraded' };
    }
}
exports.UpgradeCompanyBundleUseCase = UpgradeCompanyBundleUseCase;
//# sourceMappingURL=UpgradeCompanyBundleUseCase.js.map