import { CompanyWizardStep } from '../../../domain/company-wizard';
import { ICompanyCreationSessionRepository } from '../../../repository/interfaces/company-wizard/ICompanyCreationSessionRepository';
import { ICompanyWizardTemplateRepository } from '../../../repository/interfaces/company-wizard/ICompanyWizardTemplateRepository';

interface Input {
  sessionId: string;
  stepId: string;
  values: Record<string, any>;
  userId: string;
}

interface Output {
  nextStepId?: string;
  isLastStep: boolean;
}

export class SubmitWizardStepUseCase {
  constructor(
    private sessionRepo: ICompanyCreationSessionRepository,
    private templateRepo: ICompanyWizardTemplateRepository
  ) {}

  private filter(steps: CompanyWizardStep[], model: string) {
    return steps
      .filter((step) => !step.modelKey || step.modelKey === model)
      .sort((a, b) => a.order - b.order);
  }

  private validateRequired(step: CompanyWizardStep, values: Record<string, any>) {
    for (const field of step.fields) {
      if (field.required && (values[field.id] === undefined || values[field.id] === null || values[field.id] === '')) {
        throw new Error(`Field ${field.id} is required`);
      }
    }
  }

  async execute(input: Input): Promise<Output> {
    const session = await this.sessionRepo.getById(input.sessionId);
    if (!session) throw new Error('Session not found');
    if (session.userId !== input.userId) {
      throw new Error('Forbidden');
    }

    if (session.currentStepId !== input.stepId) {
      throw new Error('Step mismatch');
    }

    const template = await this.templateRepo.getById(session.templateId);
    if (!template) throw new Error('Template not found for session');

    const steps = this.filter(template.steps, session.model);
    const currentIndex = steps.findIndex((s) => s.id === input.stepId);
    if (currentIndex === -1) throw new Error('Step not found');

    const currentStep = steps[currentIndex];
    this.validateRequired(currentStep, input.values);

    session.data = { ...session.data, ...input.values };
    session.updatedAt = new Date();

    const nextStep = steps[currentIndex + 1];
    if (nextStep) {
      session.currentStepId = nextStep.id;
    } else {
      session.currentStepId = '';
    }

    await this.sessionRepo.update(session);

    return {
      nextStepId: nextStep?.id,
      isLastStep: !nextStep
    };
  }
}
