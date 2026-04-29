"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteModuleUseCase = void 0;
class DeleteModuleUseCase {
    constructor(moduleRepo) {
        this.moduleRepo = moduleRepo;
    }
    async execute(id) {
        const module = await this.moduleRepo.getById(id);
        if (!module) {
            throw new Error('Module not found');
        }
        if (module.lifecycleStatus === 'ready') {
            throw new Error('Cannot delete a module with lifecycleStatus=ready. Deprecate it first.');
        }
        await this.moduleRepo.delete(id);
    }
}
exports.DeleteModuleUseCase = DeleteModuleUseCase;
//# sourceMappingURL=DeleteModuleUseCase.js.map