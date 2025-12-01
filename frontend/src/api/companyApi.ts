
import client from './client';

export interface CompanySettings {
  companyId: string;
  strictApprovalMode: boolean;
}

export const companyApi = {
  getSettings: (companyId: string): Promise<CompanySettings> => {
    return client.get(`/core/company/settings?companyId=${encodeURIComponent(companyId)}`);
  },

  updateSettings: (companyId: string, settings: Partial<CompanySettings>): Promise<void> => {
    return client.post('/core/company/settings', { ...settings, companyId });
  }
};
