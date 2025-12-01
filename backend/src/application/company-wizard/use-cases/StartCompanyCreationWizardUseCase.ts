import { CompanyCreationSession, CompanyWizardStep } from '../../../domain/company-wizard';
import { ICompanyWizardTemplateRepository } from '../../../repository/interfaces/company-wizard/ICompanyWizardTemplateRepository';
import { ICompanyCreationSessionRepository } from '../../../repository/interfaces/company-wizard/ICompanyCreationSessionRepository';
import { IUserRepository } from '../../../repository/interfaces/core/IUserRepository';
import { ICompanyRepository } from '../../../repository/interfaces/core/ICompanyRepository';

interface StartWizardInput {
  userId: string;
  companyName: string;
  model: string;
}

interface StartWizardOutput {
  sessionId: string;
  model: string;
  templateId: string;
  currentStepId: string;
  stepsMeta: Array<{ id: string; titleEn: string; titleAr: string; titleTr: string; order: number }>;
}

export class StartCompanyCreationWizardUseCase {
  constructor(
    private userRepo: IUserRepository,
    private templateRepo: ICompanyWizardTemplateRepository,
    private sessionRepo: ICompanyCreationSessionRepository,
    private _companyRepo: ICompanyRepository
  ) {
    void this._companyRepo;
  }

  private filterSteps(steps: CompanyWizardStep[], model: string): CompanyWizardStep[] {
    return steps
      .filter((step) => !step.modelKey || step.modelKey === model)
      .sort((a, b) => a.order - b.order);
  }

  private generateId(prefix: string) {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  async execute(input: StartWizardInput): Promise<StartWizardOutput> {
    // Best-effort fetch of user; do not block if missing in local dev
    const actor = await this.userRepo.getUserById(input.userId).catch(() => null);
    if (actor?.isAdmin()) {
      throw new Error('SUPER_ADMIN cannot run the user wizard');
    }

    const template = await this.templateRepo.getDefaultTemplateForModel(input.model);
    if (!template) {
      throw new Error(`No wizard template found for model '${input.model}'`);
    }

    const steps = this.filterSteps(template.steps, input.model);
    const currentStepId = steps[0]?.id || '';

    const session: CompanyCreationSession = {
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
