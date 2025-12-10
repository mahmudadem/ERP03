/**
 * PlanDefinition.ts
 * 
 * Subscription plan definition managed by Super Admin.
 * Plans appear during user account signup (not company creation).
 */

export interface PlanDefinition {
  id: string;
  name: string;
  description: string;
  price: number;
  status: 'active' | 'inactive' | 'deprecated';
  limits: {
    maxCompanies: number;
    maxUsersPerCompany: number;
    maxModulesAllowed: number;
    maxStorageMB: number;
    maxTransactionsPerMonth: number;
  };
  createdAt: Date;
  updatedAt: Date;
}
