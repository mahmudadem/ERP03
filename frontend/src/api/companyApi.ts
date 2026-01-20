import client from './client';

export type UIMode = 'classic' | 'windows';

export interface CompanySettings {
  companyId: string;
  strictApprovalMode: boolean;
  baseCurrency: string; // The company's reporting currency (e.g., USD)
  uiMode?: UIMode;
  timezone?: string; // e.g., 'UTC', 'Europe/Istanbul'
  dateFormat?: string; // e.g., 'YYYY-MM-DD', 'DD/MM/YYYY'

}

export const companyApi = {
  getSettings: (companyId: string): Promise<CompanySettings> => {
    return client.get(`/core/company/settings?companyId=${encodeURIComponent(companyId)}`);
  },

  updateSettings: (companyId: string, settings: Partial<CompanySettings>): Promise<void> => {
    return client.post('/core/company/settings', { ...settings, companyId });
  }
};
