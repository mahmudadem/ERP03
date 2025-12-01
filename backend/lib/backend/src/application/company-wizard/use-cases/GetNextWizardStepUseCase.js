"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetNextWizardStepUseCase = void 0;
const ApiError_1 = require("../../../api/errors/ApiError");
class GetNextWizardStepUseCase {
    constructor(sessionRepo, templateRepo) {
        this.sessionRepo = sessionRepo;
        this.templateRepo = templateRepo;
    }
    filter(steps, model) {
        return steps
            .filter((step) => !step.modelKey || step.modelKey === model)
            .sort((a, b) => a.order - b.order);
    }
    async execute({ sessionId, userId }) {
        const session = await this.sessionRepo.getById(sessionId);
        if (!session) {
            throw ApiError_1.ApiError.notFound('Session not found');
        }
        if (session.userId !== userId) {
            throw ApiError_1.ApiError.forbidden();
        }
        const template = await this.templateRepo.getById(session.templateId);
        if (!template) {
            throw ApiError_1.ApiError.notFound('Template not found for session');
        }
        const steps = this.filter(template.steps, session.model);
        const step = steps.find((s) => s.id === session.currentStepId);
        if (!step) {
            throw ApiError_1.ApiError.notFound('No further steps available');
        }
        return step;
    }
}
exports.GetNextWizardStepUseCase = GetNextWizardStepUseCase;
//# sourceMappingURL=GetNextWizardStepUseCase.js.map