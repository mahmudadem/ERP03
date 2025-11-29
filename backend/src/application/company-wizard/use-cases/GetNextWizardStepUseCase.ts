import { CompanyWizardStep } from '../../../domain/company-wizard';
import { ICompanyCreationSessionRepository } from '../../../repository/interfaces/company-wizard/ICompanyCreationSessionRepository';
import { ICompanyWizardTemplateRepository } from '../../../repository/interfaces/company-wizard/ICompanyWizardTemplateRepository';

interface Input {
  sessionId: string;
  userId: string;
}

export class GetNextWizardStepUseCase {
  constructor(
    private sessionRepo: ICompanyCreationSessionRepository,
    private templateRepo: ICompanyWizardTemplateRepository
  ) {}

  private filter(steps: CompanyWizardStep[], model: string) {
    return steps
      .filter((step) => !step.modelKey || step.modelKey === model)
      .sort((a, b) => a.order - b.order);
  }

  async execute({ sessionId, userId }: Input): Promise<CompanyWizardStep> {
    const session = await this.sessionRepo.getById(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.userId !== userId) throw new Error('Forbidden');

    const template = await this.templateRepo.getById(session.templateId);
    if (!template) throw new Error('Template not found for session');

    const steps = this.filter(template.steps, session.model);
    const step = steps.find((s) => s.id === session.currentStepId);
    if (!step) {
      throw new Error('No further steps available');
    }

    return step;
  }
}
