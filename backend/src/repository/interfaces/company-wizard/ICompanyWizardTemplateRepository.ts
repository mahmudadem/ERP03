import { CompanyWizardTemplate } from '../../../domain/company-wizard';

export interface ICompanyWizardTemplateRepository {
  getDefaultTemplateForModel(model: string): Promise<CompanyWizardTemplate | null>;
  getById(id: string): Promise<CompanyWizardTemplate | null>;
  listAll(): Promise<CompanyWizardTemplate[]>;
}
