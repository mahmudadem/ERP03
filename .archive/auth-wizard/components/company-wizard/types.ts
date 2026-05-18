
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

// New Bundles Mock Data (20 items)
export const AVAILABLE_BUNDLES: Bundle[] = [
  {
    id: "trading-basic",
    name: "General Trading",
    description: "Suitable for normal trading companies.",
    modules: ["Accounting", "Inventory"],
    recommended: false
  },
  {
    id: "trading-plus",
    name: "General Trading +",
    description: "Trading company with HR support.",
    modules: ["Accounting", "Inventory", "HR"],
    recommended: true
  },
  {
    id: "retail-pos",
    name: "Retail / POS",
    description: "For retail shops and supermarkets.",
    modules: ["POS", "Inventory", "Accounting"],
    recommended: false
  },
  {
    id: "wholesale",
    name: "Wholesale Trading",
    description: "For wholesalers and distribution companies.",
    modules: ["Inventory", "CRM", "Accounting", "Purchase"],
    recommended: false
  },
  {
    id: "services",
    name: "Services Company",
    description: "For IT, consulting, maintenance, etc.",
    modules: ["CRM", "HR", "Accounting"],
    recommended: false
  },
  {
    id: "restaurant",
    name: "Restaurant",
    description: "POS + Inventory + HR for restaurants.",
    modules: ["POS", "Inventory", "HR", "Accounting"],
    recommended: false
  },
  {
    id: "bakery",
    name: "Bakery / Food Production",
    description: "Suitable for bakeries and food factories.",
    modules: ["POS", "Inventory", "Manufacturing", "Accounting"],
    recommended: false
  },
  {
    id: "maintenance",
    name: "Maintenance Workshop",
    description: "Workshops handling repairs and service orders.",
    modules: ["CRM", "Inventory", "Accounting", "WorkOrders"],
    recommended: false
  },
  {
    id: "manufacturing-basic",
    name: "Manufacturing – Basic",
    description: "For small manufacturers.",
    modules: ["Inventory", "Manufacturing", "Accounting"],
    recommended: false
  },
  {
    id: "manufacturing-advanced",
    name: "Manufacturing – Advanced",
    description: "For medium and large factories.",
    modules: ["Inventory", "Manufacturing", "Accounting", "HR", "Purchase"],
    recommended: false
  },
  {
    id: "construction",
    name: "Construction / Contracting",
    description: "Contractors, builders, and project companies.",
    modules: ["Projects", "Accounting", "HR", "Inventory", "Procurement"],
    recommended: false
  },
  {
    id: "real-estate",
    name: "Real Estate Agency",
    description: "Real estate brokers and agencies.",
    modules: ["CRM", "Contracts", "Accounting"],
    recommended: false
  },
  {
    id: "education",
    name: "Education / Training Center",
    description: "Training institutes and educational centers.",
    modules: ["CRM", "HR", "Accounting", "Scheduling"],
    recommended: false
  },
  {
    id: "clinic",
    name: "Clinic / Medical Office",
    description: "Small medical practices.",
    modules: ["CRM", "Inventory", "HR", "Accounting"],
    recommended: false
  },
  {
    id: "logistics",
    name: "Logistics & Transportation",
    description: "Transport, delivery, and logistics services.",
    modules: ["Accounting", "Fleet", "HR", "CRM"],
    recommended: false
  },
  {
    id: "ecommerce",
    name: "E-Commerce Seller",
    description: "Online sellers and marketplace merchants.",
    modules: ["Inventory", "CRM", "Orders", "Accounting"],
    recommended: false
  },
  {
    id: "freelancer",
    name: "Freelancer / Solo Entrepreneur",
    description: "For individual freelancers.",
    modules: ["Accounting", "CRM"],
    recommended: false
  },
  {
    id: "nonprofit",
    name: "Non-Profit Organization",
    description: "For NGOs and non-profit entities.",
    modules: ["Accounting", "CRM", "HR"],
    recommended: false
  },
  {
    id: "salon",
    name: "Beauty Salon & Spa",
    description: "For salons, spas, and beauty centers.",
    modules: ["POS", "Inventory", "HR", "Scheduling"],
    recommended: false
  },
  {
    id: "empty-company",
    name: "Empty Company",
    description: "Start with no modules and configure manually.",
    modules: [],
    recommended: false
  }
];
