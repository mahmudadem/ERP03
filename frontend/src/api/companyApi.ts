import client from './client';

export type UIMode = 'classic' | 'windows';

export interface CompanySettings {
  companyId: string;
  strictApprovalMode: boolean;
  uiMode?: UIMode; // System-wide UI mode preference
}

export const companyApi = {
  getSettings: (companyId: string): Promise<CompanySettings> => {
    return client.get(`/core/company/settings?companyId=${encodeURIComponent(companyId)}`);
  },

  updateSettings: (companyId: string, settings: Partial<CompanySettings>): Promise<void> => {
    return client.post('/core/company/settings', { ...settings, companyId });
  }
};
