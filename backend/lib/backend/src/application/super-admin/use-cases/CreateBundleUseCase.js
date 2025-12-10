"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBundleUseCase = void 0;
class CreateBundleUseCase {
    constructor(bundleRepo) {
        this.bundleRepo = bundleRepo;
    }
    async execute(input) {
        // Validate businessDomains is an array
        if (!Array.isArray(input.businessDomains)) {
            throw new Error('businessDomains must be an array');
        }
        // Validate modulesIncluded is an array
        if (!Array.isArray(input.modulesIncluded)) {
            throw new Error('modulesIncluded must be an array');
        }
        const bundle = Object.assign(Object.assign({}, input), { createdAt: new Date(), updatedAt: new Date() });
        await this.bundleRepo.create(bundle);
    }
}
exports.CreateBundleUseCase = CreateBundleUseCase;
//# sourceMappingURL=CreateBundleUseCase.js.map