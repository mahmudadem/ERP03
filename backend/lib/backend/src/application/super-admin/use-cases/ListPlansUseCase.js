"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListPlansUseCase = void 0;
class ListPlansUseCase {
    constructor(planRepo) {
        this.planRepo = planRepo;
    }
    async execute() {
        return await this.planRepo.getAll();
    }
}
exports.ListPlansUseCase = ListPlansUseCase;
//# sourceMappingURL=ListPlansUseCase.js.map