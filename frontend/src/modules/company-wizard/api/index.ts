import client from '../../../api/client';

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
  getAvailableModels: async (): Promise<Array<{ id: string; labelEn: string; labelAr: string; labelTr: string }>> => {
    const resp = await client.get<any>('/company-wizard/models');
    if (Array.isArray(resp)) return resp;
    if (resp && Array.isArray(resp.data)) return resp.data;
    if (resp && Array.isArray(resp.models)) return resp.models;
    if (resp && resp.data && Array.isArray(resp.data.models)) return resp.data.models;
    return [];
  },

  startWizard: async (
    body: { companyName: string; model: string }
  ): Promise<{ sessionId: string; currentStepId: string; stepsMeta: WizardStepMeta[]; model: string; templateId: string }> => {
    const resp = await client.post<any>('/company-wizard/start', body);
    return resp?.data ?? resp;
  },

  getStepsForModel: async (model: string): Promise<CompanyWizardStep[]> => {
    const resp = await client.get<any>(`/company-wizard/steps?model=${encodeURIComponent(model)}`);
    return resp?.data ?? resp ?? [];
  },

  getCurrentStep: async (sessionId: string): Promise<CompanyWizardStep> => {
    const resp = await client.get<any>(`/company-wizard/step?sessionId=${encodeURIComponent(sessionId)}`);
    return resp?.data ?? resp;
  },

  submitStep: async (
    body: { sessionId: string; stepId: string; values: Record<string, any> }
  ): Promise<{ nextStepId?: string; isLastStep: boolean }> => {
    const resp = await client.post<any>('/company-wizard/step', body);
    // Support either { success, data } envelope or bare object
    if (resp && typeof resp === 'object' && 'data' in resp) {
      return (resp as any).data;
    }
    return resp;
  },

  getOptions: async (sessionId: string, fieldId: string): Promise<Array<{ id: string; label: string }> | null> => {
    const resp = await client.get<any>(
      `/company-wizard/options?sessionId=${encodeURIComponent(sessionId)}&fieldId=${encodeURIComponent(fieldId)}`
    );
    return resp?.data ?? resp ?? null;
  },

  completeWizard: async (sessionId: string): Promise<{ companyId: string; activeCompanyId: string }> => {
    const resp = await client.post<any>('/company-wizard/complete', { sessionId });
    return resp?.data ?? resp;
  },
};
