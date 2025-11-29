import { httpClient } from '../../../../api/httpClient';

export interface WizardStepMeta {
  id: string;
  titleEn: string;
  titleAr: string;
  titleTr: string;
  order: number;
}

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

export const wizardApi = {
  getAvailableModels: () =>
    httpClient<Array<{ id: string; labelEn: string; labelAr: string; labelTr: string }>>(
      '/company-wizard/models'
    ),

  startWizard: (body: { companyName: string; model: string }) =>
    httpClient<{ sessionId: string; currentStepId: string; stepsMeta: WizardStepMeta[]; model: string; templateId: string }>(
      '/company-wizard/start',
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    ),

  getStepsForModel: (model: string) =>
    httpClient<CompanyWizardStep[]>(`/company-wizard/steps?model=${encodeURIComponent(model)}`),

  getCurrentStep: (sessionId: string) =>
    httpClient<CompanyWizardStep>(`/company-wizard/step?sessionId=${encodeURIComponent(sessionId)}`),

  submitStep: (body: { sessionId: string; stepId: string; values: Record<string, any> }) =>
    httpClient<{ nextStepId?: string; isLastStep: boolean }>('/company-wizard/step', {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getOptions: (sessionId: string, fieldId: string) =>
    httpClient<Array<{ id: string; label: string }> | null>(
      `/company-wizard/options?sessionId=${encodeURIComponent(sessionId)}&fieldId=${encodeURIComponent(fieldId)}`
    ),

  completeWizard: (sessionId: string) =>
    httpClient<{ companyId: string; activeCompanyId: string }>('/company-wizard/complete', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    }),
};
