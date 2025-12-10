"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListModulesUseCase = void 0;
class ListModulesUseCase {
    constructor(moduleRepo) {
        this.moduleRepo = moduleRepo;
    }
    async execute() {
        return await this.moduleRepo.getAll();
    }
}
exports.ListModulesUseCase = ListModulesUseCase;
//# sourceMappingURL=ListModulesUseCase.js.map