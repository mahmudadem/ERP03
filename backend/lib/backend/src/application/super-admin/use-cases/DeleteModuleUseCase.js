"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeleteModuleUseCase = void 0;
const REQUIRED_MODULES = ['finance', 'inventory', 'hr'];
class DeleteModuleUseCase {
    constructor(moduleRepo) {
        this.moduleRepo = moduleRepo;
    }
    async execute(id) {
        // Prevent deletion of required modules
        if (REQUIRED_MODULES.includes(id)) {
            throw new Error(`Cannot delete required module: ${id}`);
        }
        await this.moduleRepo.delete(id);
    }
}
exports.DeleteModuleUseCase = DeleteModuleUseCase;
//# sourceMappingURL=DeleteModuleUseCase.js.map