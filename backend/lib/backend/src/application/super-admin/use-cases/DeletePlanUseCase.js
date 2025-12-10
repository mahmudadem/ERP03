"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeletePlanUseCase = void 0;
class DeletePlanUseCase {
    constructor(planRepo) {
        this.planRepo = planRepo;
    }
    async execute(id) {
        await this.planRepo.delete(id);
    }
}
exports.DeletePlanUseCase = DeletePlanUseCase;
//# sourceMappingURL=DeletePlanUseCase.js.map