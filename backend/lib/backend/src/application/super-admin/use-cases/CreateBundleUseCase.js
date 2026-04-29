"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateBundleUseCase = void 0;
class CreateBundleUseCase {
    constructor(bundleRepo) {
        this.bundleRepo = bundleRepo;
    }
    async execute(input) {
        if (!Array.isArray(input.businessDomains)) {
            throw new Error('businessDomains must be an array');
        }
        if (!Array.isArray(input.modulesIncluded)) {
            throw new Error('modulesIncluded must be an array');
        }
        if (input.capabilities !== undefined && !Array.isArray(input.capabilities)) {
            throw new Error('capabilities must be an array');
        }
        const bundle = {
            id: input.id,
            code: input.id,
            name: input.name,
            description: input.description,
            businessDomains: input.businessDomains,
            modulesIncluded: input.modulesIncluded,
            capabilities: input.capabilities || [],
            lifecycleStatus: input.lifecycleStatus || 'draft',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await this.bundleRepo.create(bundle);
    }
}
exports.CreateBundleUseCase = CreateBundleUseCase;
//# sourceMappingURL=CreateBundleUseCase.js.map