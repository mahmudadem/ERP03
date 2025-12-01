"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartCompanyCreationWizardUseCase = void 0;
class StartCompanyCreationWizardUseCase {
    constructor(userRepo, templateRepo, sessionRepo, _companyRepo) {
        this.userRepo = userRepo;
        this.templateRepo = templateRepo;
        this.sessionRepo = sessionRepo;
        this._companyRepo = _companyRepo;
        void this._companyRepo;
    }
    filterSteps(steps, model) {
        return steps
            .filter((step) => !step.modelKey || step.modelKey === model)
            .sort((a, b) => a.order - b.order);
    }
    generateId(prefix) {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    }
    async execute(input) {
        var _a;
        // Best-effort fetch of user; do not block if missing in local dev
        const actor = await this.userRepo.getUserById(input.userId).catch(() => null);
        if (actor === null || actor === void 0 ? void 0 : actor.isAdmin()) {
            throw new Error('SUPER_ADMIN cannot run the user wizard');
        }
        const template = await this.templateRepo.getDefaultTemplateForModel(input.model);
        if (!template) {
            throw new Error(`No wizard template found for model '${input.model}'`);
        }
        const steps = this.filterSteps(template.steps, input.model);
        const currentStepId = ((_a = steps[0]) === null || _a === void 0 ? void 0 : _a.id) || '';
        const session = {
            id: this.generateId('ccs'),
            userId: input.userId,
            model: input.model,
            templateId: template.id,
            currentStepId,
            data: { companyName: input.companyName },
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        await this.sessionRepo.create(session);
        return {
            sessionId: session.id,
            model: session.model,
            templateId: session.templateId,
            currentStepId: session.currentStepId,
            stepsMeta: steps.map((s) => ({
                id: s.id,
                titleEn: s.titleEn,
                titleAr: s.titleAr,
                titleTr: s.titleTr,
                order: s.order,
            })),
        };
    }
}
exports.StartCompanyCreationWizardUseCase = StartCompanyCreationWizardUseCase;
//# sourceMappingURL=StartCompanyCreationWizardUseCase.js.map