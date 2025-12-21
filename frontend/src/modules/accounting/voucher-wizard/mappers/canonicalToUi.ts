/**
 * Canonical to UI Mapper
 * 
 * Transforms VoucherTypeDefinition (from DB) → VoucherTypeConfig (for wizard)
 * 
 * This allows editing existing voucher types by loading them into the wizard.
 */

import { VoucherTypeConfig, VoucherRule, VoucherAction, FieldLayout, SectionLayout, SectionType } from '../types';

// TODO: Import actual VoucherTypeDefinition from your schema
interface VoucherTypeDefinition {
  id: string;
  code: string;
  name: string;
  schemaVersion: number;
  prefix: string;
  nextNumber: number;
  enabled?: boolean;
  isSystemDefault?: boolean;
  inUse?: boolean;
  
  layout: {
    classic: LayoutSchema;
    windows: LayoutSchema;
  };
  
  isMultiLine: boolean;
  tableColumns?: string[];
  
  requiresApproval?: boolean;
  preventNegativeCash?: boolean;
  allowFutureDates?: boolean;
  mandatoryAttachments?: boolean;
  
  enabledActions: string[];
}

interface LayoutSchema {
  sections: {
    [key: string]: {
      order: number;
      fields: Array<{
        fieldId: string;
        row: number;
        col: number;
        colSpan: number;
        label?: string;
      }>;
    };
  };
}

// Default rules structure
const DEFAULT_RULES: VoucherRule[] = [
  { id: 'require_approval', label: 'Require Approval Workflow', enabled: false, description: 'Vouchers must be approved by a supervisor.' },
  { id: 'prevent_negative_cash', label: 'Prevent Negative Cash', enabled: false, description: 'Block saving if cash accounts go negative.' },
  { id: 'allow_future_date', label: 'Allow Future Posting Dates', enabled: true, description: 'Users can select dates in the future.' },
  { id: 'mandatory_attachments', label: 'Mandatory Attachments', enabled: false, description: 'Require at least one file upload.' },
];

// Default actions structure
const ALL_ACTIONS: VoucherAction[] = [
  { type: 'print', label: 'Print Voucher', enabled: false },
  { type: 'email', label: 'Email PDF', enabled: false },
  { type: 'download_pdf', label: 'Download PDF', enabled: false },
  { type: 'download_excel', label: 'Download Excel', enabled: false },
  { type: 'import_csv', label: 'Import Lines (CSV)', enabled: false },
  { type: 'export_json', label: 'Export JSON', enabled: false },
];

/**
 * Transform canonical voucher definition to UI config
 */
export function canonicalToUi(canonical: VoucherTypeDefinition): VoucherTypeConfig {
  // Map business rules back to UI toggles
  const rules = DEFAULT_RULES.map(rule => ({
    ...rule,
    enabled: getRuleEnabled(canonical, rule.id)
  }));
  
  // Map enabled actions
  const actions = ALL_ACTIONS.map(action => ({
    ...action,
    enabled: canonical.enabledActions.includes(action.type)
  }));
  
  // Transform layouts
  const uiModeOverrides = {
    classic: transformCanonicalLayout(canonical.layout.classic),
    windows: transformCanonicalLayout(canonical.layout.windows)
  };
  
  const uiConfig: VoucherTypeConfig = {
    id: canonical.id,
    name: canonical.name,
    prefix: canonical.prefix,
    startNumber: canonical.nextNumber,
    rules,
    isMultiLine: canonical.isMultiLine,
    tableColumns: canonical.tableColumns,
    actions,
    uiModeOverrides,
    enabled: canonical.enabled,
    isSystemDefault: canonical.isSystemDefault,
    isLocked: canonical.isSystemDefault, // System defaults are locked
    inUse: canonical.inUse,
  };
  
  return uiConfig;
}

/**
 * Get rule enabled status from canonical
 */
function getRuleEnabled(canonical: VoucherTypeDefinition, ruleId: string): boolean {
  switch (ruleId) {
    case 'require_approval':
      return canonical.requiresApproval || false;
    case 'prevent_negative_cash':
      return canonical.preventNegativeCash || false;
    case 'allow_future_date':
      return canonical.allowFutureDates !== undefined ? canonical.allowFutureDates : true;
    case 'mandatory_attachments':
      return canonical.mandatoryAttachments || false;
    default:
      return false;
  }
}

/**
 * Transform canonical layout to UI layout
 */
function transformCanonicalLayout(canonicalLayout: LayoutSchema): { sections: Record<SectionType, SectionLayout> } {
  const sections: any = {};
  
  Object.entries(canonicalLayout.sections).forEach(([sectionName, sectionData]) => {
    sections[sectionName as SectionType] = {
      order: sectionData.order,
      fields: sectionData.fields.map(field => ({
        fieldId: field.fieldId,
        row: field.row,
        col: field.col,
        colSpan: field.colSpan,
        labelOverride: field.label
      }))
    };
  });
  
  return { sections };
}
