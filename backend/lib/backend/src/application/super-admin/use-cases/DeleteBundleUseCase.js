"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteBundleUseCase = void 0;
class DeleteBundleUseCase {
    constructor(bundleRepo) {
        this.bundleRepo = bundleRepo;
    }
    async execute(id) {
        await this.bundleRepo.delete(id);
    }
}
exports.DeleteBundleUseCase = DeleteBundleUseCase;
//# sourceMappingURL=DeleteBundleUseCase.js.map