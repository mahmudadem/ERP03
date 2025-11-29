
export interface CompanyRole {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  permissions: string[];
  sourceTemplateId?: string;
  isDefaultForNewUsers?: boolean;
}
