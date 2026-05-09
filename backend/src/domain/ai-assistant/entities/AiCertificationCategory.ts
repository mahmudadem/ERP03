export type AiCertificationCategory =
  | 'GENERAL_CHAT'
  | 'ACCOUNTING'
  | 'FINANCE_REPORTING'
  | 'SALES'
  | 'PURCHASES'
  | 'INVENTORY'
  | 'HR'
  | 'CRM'
  | 'TOOL_CALLING'
  | 'DATA_FILTERING'
  | 'PROPOSAL_DRAFT'
  | 'ANALYTICS';

export const AI_CERTIFICATION_CATEGORIES: Record<AiCertificationCategory, { label: string }> = {
  GENERAL_CHAT: { label: 'General chat' },
  ACCOUNTING: { label: 'Accounting' },
  FINANCE_REPORTING: { label: 'Finance reporting' },
  SALES: { label: 'Sales' },
  PURCHASES: { label: 'Purchases' },
  INVENTORY: { label: 'Inventory' },
  HR: { label: 'HR' },
  CRM: { label: 'CRM' },
  TOOL_CALLING: { label: 'Tool calling' },
  DATA_FILTERING: { label: 'Data filtering' },
  PROPOSAL_DRAFT: { label: 'Proposal draft' },
  ANALYTICS: { label: 'Analytics' },
};

export function isAiCertificationCategory(value: string): value is AiCertificationCategory {
  return Object.prototype.hasOwnProperty.call(AI_CERTIFICATION_CATEGORIES, value);
}
