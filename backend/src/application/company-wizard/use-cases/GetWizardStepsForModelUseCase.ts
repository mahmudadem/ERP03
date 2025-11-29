import { CompanyWizardStep } from '../../../domain/company-wizard';
import { ICompanyWizardTemplateRepository } from '../../../repository/interfaces/company-wizard/ICompanyWizardTemplateRepository';

interface Input {
  model: string;
}

export class GetWizardStepsForModelUseCase {
  constructor(private templateRepo: ICompanyWizardTemplateRepository) {}

  private filter(steps: CompanyWizardStep[], model: string) {
    return steps
      .filter((step) => !step.modelKey || step.modelKey === model)
      .sort((a, b) => a.order - b.order);
  }

  async execute(input: Input): Promise<CompanyWizardStep[]> {
    const template = await this.templateRepo.getDefaultTemplateForModel(input.model);
    if (!template) throw new Error('No wizard template found for model');

    return this.filter(template.steps, input.model);
  }
}
