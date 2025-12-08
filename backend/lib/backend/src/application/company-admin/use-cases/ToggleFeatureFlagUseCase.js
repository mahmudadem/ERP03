"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToggleFeatureFlagUseCase = void 0;
const FeatureRegistry_1 = require("../../../domain/platform/FeatureRegistry");
const ApiError_1 = require("../../../api/errors/ApiError");
class ToggleFeatureFlagUseCase {
    constructor(companyRepository) {
        this.companyRepository = companyRepository;
    }
    async execute(input) {
        var _a;
        // Validate featureName exists in registry
        const feature = FeatureRegistry_1.Features[input.featureName];
        if (!feature) {
            throw ApiError_1.ApiError.badRequest("Invalid feature");
        }
        // Load company
        const company = await this.companyRepository.findById(input.companyId);
        if (!company) {
            throw ApiError_1.ApiError.notFound("Company not found");
        }
        // Ensure company.features exists
        const features = ((_a = company.features) !== null && _a !== void 0 ? _a : []);
        // Toggle logic
        if (input.enabled) {
            if (!features.includes(input.featureName)) {
                features.push(input.featureName);
            }
        }
        else {
            const idx = features.indexOf(input.featureName);
            if (idx !== -1) {
                features.splice(idx, 1);
            }
        }
        // Save
        await this.companyRepository.update(input.companyId, { features });
        // Return
        return {
            companyId: input.companyId,
            featureName: input.featureName,
            enabled: input.enabled,
            activeFeatures: features
        };
    }
}
exports.ToggleFeatureFlagUseCase = ToggleFeatureFlagUseCase;
//# sourceMappingURL=ToggleFeatureFlagUseCase.js.map