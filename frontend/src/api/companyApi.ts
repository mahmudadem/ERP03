
import { httpClient } from './httpClient';

export interface CompanySettings {
  companyId: string;
  strictApprovalMode: boolean;
}

export const companyApi = {
  getSettings: async (): Promise<CompanySettings> => {
    return httpClient<CompanySettings>('/company/settings');
  },

  updateSettings: async (settings: Partial<CompanySettings>): Promise<void> => {
    return httpClient<void>('/company/settings', {
      method: 'POST',
      body: JSON.stringify(settings)
    });
  }
};
