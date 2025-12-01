"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GetWizardStepsForModelUseCase = void 0;
class GetWizardStepsForModelUseCase {
    constructor(templateRepo) {
        this.templateRepo = templateRepo;
    }
    filter(steps, model) {
        return steps
            .filter((step) => !step.modelKey || step.modelKey === model)
            .sort((a, b) => a.order - b.order);
    }
    async execute(input) {
        const template = await this.templateRepo.getDefaultTemplateForModel(input.model);
        if (!template)
            throw new Error('No wizard template found for model');
        return this.filter(template.steps, input.model);
    }
}
exports.GetWizardStepsForModelUseCase = GetWizardStepsForModelUseCase;
//# sourceMappingURL=GetWizardStepsForModelUseCase.js.map