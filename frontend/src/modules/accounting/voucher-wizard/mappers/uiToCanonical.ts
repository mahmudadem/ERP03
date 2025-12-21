/**
 * UI to Canonical Schema Mapper
 * 
 * Transforms VoucherTypeConfig (UI wizard output) → VoucherTypeDefinition (Schema V2)
 * 
 * This mapper applies accounting business rules and converts the pure UI config
 * into a complete canonical voucher type definition ready for database storage.
 */

import { VoucherTypeConfig, FieldLayout, VoucherAction, UIMode, SectionType } from '../types';

// TODO: Import actual VoucherTypeDefinition from your schema
interface VoucherTypeDefinition {
  id: string;
  code: string;
  name: string;
  schemaVersion: 2;
  prefix: string;
  nextNumber: number;
  enabled: boolean;
  isSystemDefault?: boolean;
  inUse?: boolean;
  
  // Layout
  layout: {
    classic: LayoutSchema;
    windows: LayoutSchema;
  };
  
  // Configuration
  isMultiLine: boolean;
  tableColumns?: string[];
  
  // Business rules (mapped from UI toggles)
  requiresApproval?: boolean;
  preventNegativeCash?: boolean;
  allowFutureDates?: boolean;
  mandatoryAttachments?: boolean;
  
  // Actions
  enabledActions: string[];
  
  // Metadata
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  companyId?: string;
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
        category?: string;
        mandatory?: boolean;
      }>;
    };
  };
}

/**
 * Transform UI config to canonical voucher type definition
 */
export function uiToCanonical(
  uiConfig: VoucherTypeConfig,
  companyId: string,
  userId: string,
  isEdit: boolean = false
): VoucherTypeDefinition {
  // Generate code from ID (uppercase, snake_case)
  const code = uiConfig.id.toUpperCase().replace(/[-\s]/g, '_');
  
  // Map UI rules to business rule flags
  const requiresApproval = uiConfig.rules.find(r => r.id === 'require_approval')?.enabled || false;
  const preventNegativeCash = uiConfig.rules.find(r => r.id === 'prevent_negative_cash')?.enabled || false;
  const allowFutureDates = uiConfig.rules.find(r => r.id === 'allow_future_date')?.enabled || false;
  const mandatoryAttachments = uiConfig.rules.find(r => r.id === 'mandatory_attachments')?.enabled || false;
  
  // Extract enabled actions
  const enabledActions = uiConfig.actions
    .filter((a: VoucherAction) => a.enabled)
    .map((a: VoucherAction) => a.type);
  
  // Transform layouts
  const layout = {
    classic: transformLayout(uiConfig.uiModeOverrides.classic, 'classic'),
    windows: transformLayout(uiConfig.uiModeOverrides.windows, 'windows')
  };
  
  // Build canonical definition
  const canonical: VoucherTypeDefinition = {
    id: uiConfig.id,
    code,
    name: uiConfig.name,
    schemaVersion: 2,
    prefix: uiConfig.prefix,
    nextNumber: uiConfig.startNumber,
    enabled: uiConfig.enabled !== undefined ? uiConfig.enabled : true,
    isSystemDefault: uiConfig.isSystemDefault || false,
    inUse: uiConfig.inUse || false,
    layout,
    isMultiLine: uiConfig.isMultiLine,
    tableColumns: uiConfig.tableColumns,
    requiresApproval,
    preventNegativeCash,
    allowFutureDates,
    mandatoryAttachments,
    enabledActions,
    companyId,
    updatedAt: new Date(),
    updatedBy: userId,
  };
  
  // Add creation metadata if new
  if (!isEdit) {
    canonical.createdAt = new Date();
    canonical.createdBy = userId;
  }
  
  return canonical;
}

/**
 * Transform UI layout to canonical layout schema
 */
function transformLayout(
  uiLayout: { sections: Record<SectionType, { order: number; fields: FieldLayout[] }> },
  mode: UIMode
): LayoutSchema {
  const sections: any = {};
  
  Object.entries(uiLayout.sections).forEach(([sectionName, sectionData]) => {
    sections[sectionName] = {
      order: sectionData.order,
      fields: sectionData.fields.map(field => ({
        fieldId: field.fieldId,
        row: field.row,
        col: field.col,
        colSpan: field.colSpan,
        label: field.labelOverride,
        // TODO: Add category from field metadata when available
      }))
    };
  });
  
  return { sections };
}

/**
 * Validate UI config before transformation
 */
export function validateUiConfig(config: VoucherTypeConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.id || config.id.trim() === '') {
    errors.push('Voucher ID is required');
  }
  
  if (!config.name || config.name.trim() === '') {
    errors.push('Voucher name is required');
  }
  
  if (!config.prefix || config.prefix.trim() === '') {
    errors.push('Prefix is required');
  }
  
  if (config.startNumber < 1) {
    errors.push('Start number must be at least 1');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
