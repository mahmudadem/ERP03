"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreatePlanUseCase = void 0;
class CreatePlanUseCase {
    constructor(planRepo) {
        this.planRepo = planRepo;
    }
    async execute(input) {
        const plan = Object.assign(Object.assign({}, input), { createdAt: new Date(), updatedAt: new Date() });
        await this.planRepo.create(plan);
    }
}
exports.CreatePlanUseCase = CreatePlanUseCase;
//# sourceMappingURL=CreatePlanUseCase.js.map