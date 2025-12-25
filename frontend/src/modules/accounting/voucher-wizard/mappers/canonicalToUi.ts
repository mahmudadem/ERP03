/**
 * Canonical to UI Mapper
 * 
 * Transforms VoucherTypeDefinition (from DB) → VoucherFormConfig (for wizard)
 * 
 * This allows editing existing voucher forms by loading them into the wizard.
 */

import { VoucherFormConfig, VoucherRule, VoucherAction, FieldLayout, SectionLayout, SectionType } from '../types';

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
  tableColumns?: Array<{
    fieldId: string;
    width?: string;
    labelOverride?: string;
  }>;
  
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
export function canonicalToUi(canonical: VoucherTypeDefinition): VoucherFormConfig {
  // Map business rules back to UI toggles
  const rules = DEFAULT_RULES.map(rule => ({
    ...rule,
    enabled: getRuleEnabled(canonical, rule.id)
  }));
  
  // Map enabled actions
  const actions = ALL_ACTIONS.map(action => {
    // Check both canonical and UI-specific format for resilience
    const isEnabled = canonical.enabledActions?.includes(action.type) || 
                     (canonical as any).actions?.find((a: any) => a.type === action.type)?.enabled || 
                     false;
    return {
      ...action,
      enabled: isEnabled
    };
  });
  
  // Transform layouts
  const uiModeOverrides = {
    classic: transformCanonicalLayout(canonical.layout?.classic || { sections: {} }),
    windows: transformCanonicalLayout(canonical.layout?.windows || { sections: {} })
  };
  
  const uiConfig: VoucherFormConfig = {
    id: canonical.id,
    name: canonical.name,
    prefix: canonical.prefix,
    startNumber: canonical.nextNumber,
    rules,
    isMultiLine: canonical.isMultiLine,
    tableColumns: (canonical.tableColumns || []).map((col: any) => {
      if (typeof col === 'string') return { id: col };
      return {
        id: col.fieldId || col.id,
        width: col.width,
        labelOverride: col.labelOverride || ''
      };
    }),
    actions,
    uiModeOverrides,
    enabled: canonical.enabled,
    isSystemDefault: canonical.isSystemDefault || (canonical as any).isSystemGenerated || (canonical as any).isDefault,
    isLocked: canonical.isSystemDefault || (canonical as any).isLocked,
    inUse: canonical.inUse,
    baseType: (canonical as any).baseType || canonical.code || canonical.id,
    metadata: (canonical as any).metadata || {}
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
      // Fallback: check the UI-specific rules array if it exists
      const uiRule = (canonical as any).rules?.find((r: any) => r.id === ruleId);
      return uiRule ? uiRule.enabled : false;
  }
}

/**
 * Transform canonical layout to UI layout
 */
function transformCanonicalLayout(canonicalLayout: LayoutSchema): { sections: Record<SectionType, SectionLayout> } {
  const sections: any = {
    HEADER: { order: 0, fields: [] },
    BODY: { order: 1, fields: [] },
    EXTRA: { order: 2, fields: [] },
    ACTIONS: { order: 3, fields: [] }
  };
  
  if (canonicalLayout?.sections) {
    Object.entries(canonicalLayout.sections).forEach(([sectionName, sectionData]) => {
      if (sections[sectionName as SectionType]) {
        sections[sectionName as SectionType] = {
          order: sectionData.order,
          fields: (sectionData.fields || []).map(field => ({
            fieldId: field.fieldId,
            row: field.row,
            col: field.col,
            colSpan: field.colSpan,
            labelOverride: field.label
          }))
        };
      }
    });
  }
  
  return { sections };
}
