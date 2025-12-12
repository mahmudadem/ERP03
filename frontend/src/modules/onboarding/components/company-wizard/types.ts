
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
  email: string; // Added email field
  logo: File | null;
  logoPreviewUrl: string | null;
  selectedBundleId: string | null;
  createdCompanyId?: string;
}

export enum WizardStep {
  BasicInfo = 0,
  BundleSelection = 1,
  ContactInfo = 2, // New Step
  Review = 3,
  Success = 4,
}

export interface WizardStepProps {
  data: CompanyFormData;
  updateData: (fields: Partial<CompanyFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  bundles?: Bundle[];
  loading?: boolean;
}


export const COUNTRIES = [
  "United States",
  "United Kingdom",
  "Canada",
  "Germany",
  "France",
  "Australia",
  "United Arab Emirates",
  "Saudi Arabia",
  "India",
  "Singapore",
  "Japan"
];

// End of types
