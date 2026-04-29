"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListAvailableBundlesUseCase = void 0;
class ListAvailableBundlesUseCase {
    constructor(bundleRepo) {
        this.bundleRepo = bundleRepo;
    }
    async execute() {
        const bundles = await this.bundleRepo.getReady();
        return bundles.map(bundle => (Object.assign({ bundleId: bundle.id }, bundle)));
    }
}
exports.ListAvailableBundlesUseCase = ListAvailableBundlesUseCase;
//# sourceMappingURL=ListAvailableBundlesUseCase.js.map