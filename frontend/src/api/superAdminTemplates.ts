import client from './client';

export const superAdminTemplatesApi = {
  listWizardTemplates: () => client.get('/super-admin/templates/wizard-templates'),
  listCoaTemplates: () => client.get('/super-admin/templates/coa-templates'),
  listCurrencies: () => client.get('/super-admin/templates/currencies'),
};

export interface WizardTemplateSummary {
  id: string;
  name: string;
  models?: string[];
}

export interface CoaTemplateSummary {
  id: string;
  name: string;
}

export interface CurrencySummary {
  id: string;
  name: string;
}
