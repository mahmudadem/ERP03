
import type { StarterPolicySummary } from '../../api/onboardingApi';
import type { InventoryAccountingMode } from '../../../../api/inventoryApi';

export interface Bundle {
  id: string;
  name: string;
  description: string;
  modules: string[];
  recommended: boolean;
}

export interface CompanyFormData {
  companyName: string;
  description: string;
  country: string;
  email: string;
  timezone?: string;
  currency?: string;
  language?: string;
  dateFormat?: string;
  logo: File | null;
  logoPreviewUrl: string | null;
  selectedBundleId: string | null;
  autoInitializeModules?: boolean;
  starterTemplateId?: 'simple-trading-company';
  accountingMode?: InventoryAccountingMode;
  // NOTE-01: optional starter-policy overrides. When the user leaves any
  // field undefined in the wizard, the existing mode → policy mapping is
  // the default.
  coaTemplate?: 'periodic_trading' | 'standard';
  costingBasis?: 'GLOBAL' | 'WAREHOUSE';
  defaultWarehouseCode?: string;
  defaultWarehouseName?: string;
  salesWorkflowMode?: 'SIMPLE' | 'OPERATIONAL';
  purchaseWorkflowMode?: 'SIMPLE' | 'OPERATIONAL';
  starterPolicySummary?: StarterPolicySummary | null;
  createdCompanyId?: string;
}

export enum WizardStep {
  BasicInfo = 0,
  BundleSelection = 1,
  ContactInfo = 2,
  BasicNeeds = 3,
  Review = 4,
  Success = 5,
}

export interface WizardStepProps {
  data: CompanyFormData;
  updateData: (fields: Partial<CompanyFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  bundles?: Bundle[];
  loading?: boolean;
}
