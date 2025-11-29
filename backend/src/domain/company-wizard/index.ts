export type CompanyModel = 'financial' | 'inventory' | 'pos' | 'manufacturing' | 'hr';

export interface CompanyWizardField {
  id: string;
  labelEn: string;
  labelAr: string;
  labelTr: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  required: boolean;
  optionsSource?: string;
}

export interface CompanyWizardStep {
  id: string;
  titleEn: string;
  titleAr: string;
  titleTr: string;
  order: number;
  modelKey?: string | null;
  fields: CompanyWizardField[];
}

export interface CompanyWizardTemplate {
  id: string;
  name: string;
  models: string[];
  steps: CompanyWizardStep[];
  isDefault: boolean;
}

export interface CompanyCreationSession {
  id: string;
  userId: string;
  model: string;
  templateId: string;
  currentStepId: string;
  data: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}
