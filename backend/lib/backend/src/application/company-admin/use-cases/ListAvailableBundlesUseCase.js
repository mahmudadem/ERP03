"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListAvailableBundlesUseCase = void 0;
const Bundle_1 = require("../../../domain/platform/Bundle");
class ListAvailableBundlesUseCase {
    async execute() {
        // Return all bundles from registry
        return Bundle_1.BUNDLES.map(bundle => (Object.assign({ bundleId: bundle.id }, bundle)));
    }
}
exports.ListAvailableBundlesUseCase = ListAvailableBundlesUseCase;
//# sourceMappingURL=ListAvailableBundlesUseCase.js.map