"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateModuleUseCase = void 0;
class CreateModuleUseCase {
    constructor(moduleRepo) {
        this.moduleRepo = moduleRepo;
    }
    async execute(input) {
        if (['core', 'companyadmin', 'system'].includes(input.id.toLowerCase())) {
            throw new Error('Cannot create platform/system components as business modules');
        }
        if (!input.version || input.version.trim() === '') {
            throw new Error('Version is required for module creation');
        }
        const module = {
            id: input.id,
            code: input.id,
            name: input.name,
            description: input.description,
            version: input.version,
            releaseNotes: input.releaseNotes,
            lifecycleStatus: 'draft',
            runtimeStatus: 'available',
            implementationStatus: 'unchecked',
            dependencies: [],
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await this.moduleRepo.create(module);
    }
}
exports.CreateModuleUseCase = CreateModuleUseCase;
//# sourceMappingURL=CreateModuleUseCase.js.map