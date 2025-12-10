"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListBundlesUseCase = void 0;
class ListBundlesUseCase {
    constructor(bundleRepo) {
        this.bundleRepo = bundleRepo;
    }
    async execute() {
        return await this.bundleRepo.getAll();
    }
}
exports.ListBundlesUseCase = ListBundlesUseCase;
//# sourceMappingURL=ListBundlesUseCase.js.map