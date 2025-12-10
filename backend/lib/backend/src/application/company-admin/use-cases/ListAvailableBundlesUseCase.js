"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListAvailableBundlesUseCase = void 0;
class ListAvailableBundlesUseCase {
    constructor(bundleRepo) {
        this.bundleRepo = bundleRepo;
    }
    async execute() {
        // Return all bundles from Firestore
        const bundles = await this.bundleRepo.getAll();
        return bundles.map(bundle => (Object.assign({ bundleId: bundle.id }, bundle)));
    }
}
exports.ListAvailableBundlesUseCase = ListAvailableBundlesUseCase;
//# sourceMappingURL=ListAvailableBundlesUseCase.js.map