"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListCompanyFeaturesUseCase = void 0;
const FeatureRegistry_1 = require("../../../domain/platform/FeatureRegistry");
class ListCompanyFeaturesUseCase {
    async execute() {
        // Return full feature list from registry
        return Object.entries(FeatureRegistry_1.Features).map(([id, config]) => (Object.assign({ featureId: id }, config)));
    }
}
exports.ListCompanyFeaturesUseCase = ListCompanyFeaturesUseCase;
//# sourceMappingURL=ListCompanyFeaturesUseCase.js.map