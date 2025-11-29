
export interface CompanyRole {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  permissions: string[];
  moduleBundles?: string[];
  explicitPermissions?: string[];
  resolvedPermissions?: string[];
  sourceTemplateId?: string;
  isDefaultForNewUsers?: boolean;
}
