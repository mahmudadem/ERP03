"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubmitWizardStepUseCase = void 0;
class SubmitWizardStepUseCase {
    constructor(sessionRepo, templateRepo) {
        this.sessionRepo = sessionRepo;
        this.templateRepo = templateRepo;
    }
    filter(steps, model) {
        return steps
            .filter((step) => !step.modelKey || step.modelKey === model)
            .sort((a, b) => a.order - b.order);
    }
    validateRequired(step, values) {
        for (const field of step.fields) {
            if (field.required && (values[field.id] === undefined || values[field.id] === null || values[field.id] === '')) {
                throw new Error(`Field ${field.id} is required`);
            }
        }
    }
    async execute(input) {
        const session = await this.sessionRepo.getById(input.sessionId);
        if (!session)
            throw new Error('Session not found');
        if (session.userId !== input.userId) {
            throw new Error('Forbidden');
        }
        // Allow re-submission of the current/final step even if currentStepId was cleared previously
        if (session.currentStepId && session.currentStepId !== input.stepId) {
            throw new Error('Step mismatch');
        }
        const template = await this.templateRepo.getById(session.templateId);
        if (!template)
            throw new Error('Template not found for session');
        const steps = this.filter(template.steps, session.model);
        const currentIndex = steps.findIndex((s) => s.id === input.stepId);
        if (currentIndex === -1)
            throw new Error('Step not found');
        const currentStep = steps[currentIndex];
        this.validateRequired(currentStep, input.values);
        session.data = Object.assign(Object.assign({}, session.data), input.values);
        session.updatedAt = new Date();
        const nextStep = steps[currentIndex + 1];
        session.currentStepId = nextStep ? nextStep.id : input.stepId;
        await this.sessionRepo.update(session);
        return {
            nextStepId: nextStep === null || nextStep === void 0 ? void 0 : nextStep.id,
            isLastStep: !nextStep
        };
    }
}
exports.SubmitWizardStepUseCase = SubmitWizardStepUseCase;
//# sourceMappingURL=SubmitWizardStepUseCase.js.map