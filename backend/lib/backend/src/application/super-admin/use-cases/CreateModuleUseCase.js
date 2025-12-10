"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateModuleUseCase = void 0;
class CreateModuleUseCase {
    constructor(moduleRepo) {
        this.moduleRepo = moduleRepo;
    }
    async execute(input) {
        // Prevent creation of core or companyAdmin modules
        if (input.id === 'core' || input.id === 'companyAdmin') {
            throw new Error('Cannot create "core" or "companyAdmin" as modules - these are system components');
        }
        const module = Object.assign(Object.assign({}, input), { createdAt: new Date(), updatedAt: new Date() });
        await this.moduleRepo.create(module);
    }
}
exports.CreateModuleUseCase = CreateModuleUseCase;
//# sourceMappingURL=CreateModuleUseCase.js.map