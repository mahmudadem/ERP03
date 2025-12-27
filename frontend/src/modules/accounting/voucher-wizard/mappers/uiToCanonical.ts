/**
 * UI to Canonical Schema Mapper
 * 
 * Transforms VoucherFormConfig (UI wizard output) → VoucherTypeDefinition (Schema V2)
 * 
 * This mapper applies accounting business rules and converts the pure UI config
 * into a complete canonical voucher definition ready for database storage.
 */

import { VoucherFormConfig, FieldLayout, VoucherAction, UIMode, SectionType } from '../types';
import { SYSTEM_FIELDS, AVAILABLE_FIELDS } from '../components/VoucherDesigner';

// TODO: Import actual VoucherTypeDefinition from your schema
interface VoucherTypeDefinition {
  id: string;
  code: string;
  module: string;
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
  headerFields: Array<{
    id: string;
    name: string;
    label: string;
    type: string;
    required: boolean;
    readOnly: boolean;
    isPosting: boolean;
    postingRole: string | null;
    schemaVersion: number;
  }>;
  
  // Configuration
  isMultiLine: boolean;
  tableColumns?: Array<{
    fieldId: string;
    width?: string;
    labelOverride?: string;
  }>;
  tableStyle?: 'web' | 'classic';
  
  // Business rules (mapped from UI toggles)
  requiresApproval?: boolean;
  preventNegativeCash?: boolean;
  allowFutureDates?: boolean;
  mandatoryAttachments?: boolean;
  
  // Actions
  enabledActions: string[];
  
  // Strategy
  baseType?: string;
  
  // Metadata
  metadata?: Record<string, any>;
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
 * Transform UI config to canonical voucher definition
 */
export function uiToCanonical(
  uiConfig: VoucherFormConfig,
  companyId: string,
  userId: string,
  isEdit: boolean = false
): VoucherTypeDefinition {
  // Map UI types to Backend FieldType enum
  const mapFieldType = (type: string): string => {
    switch (type) {
      case 'number': return 'NUMBER';
      case 'date': return 'DATE';
      case 'checkbox': return 'BOOLEAN';
      case 'select': return 'SELECT';
      case 'account-selector': return 'REFERENCE';
      default: return 'STRING';
    }
  };

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

  // Extract header fields from all layouts
  const headerFieldsMap = new Map<string, any>();
  const allFields = [...SYSTEM_FIELDS, ...AVAILABLE_FIELDS];
  
  const collectFields = (modeOverride: any) => {
    if (!modeOverride?.sections) return;
    Object.values(modeOverride.sections).forEach((section: any) => {
      if (section.fields) {
        section.fields.forEach((f: any) => {
          if (!headerFieldsMap.has(f.fieldId)) {
            const meta = allFields.find(af => af.id === f.fieldId);
            if (meta) {
              headerFieldsMap.set(f.fieldId, {
                id: f.fieldId,
                name: f.fieldId,
                label: f.labelOverride || meta.label,
                type: mapFieldType(meta.type || 'text'),
                required: meta.mandatory || false,
                readOnly: meta.type === 'system',
                isPosting: false, // Default to false
                postingRole: null, // Default to null
                schemaVersion: 2
              });
            }
          }
        });
      }
    });
  };

  collectFields(uiConfig.uiModeOverrides.classic);
  collectFields(uiConfig.uiModeOverrides.windows);
  
  // Build canonical definition
  const canonical: VoucherTypeDefinition = {
    id: uiConfig.id,
    code: uiConfig.id, // Keep case consistent with ID
    module: 'accounting', // Required by backend entities
    name: uiConfig.name,
    schemaVersion: 2,
    prefix: uiConfig.prefix,
    nextNumber: uiConfig.startNumber,
    enabled: uiConfig.enabled !== undefined ? uiConfig.enabled : true,
    isSystemDefault: uiConfig.isSystemDefault || false,
    inUse: uiConfig.inUse || false,
    layout,
    // Populate headerFields required by backend validator
    headerFields: Array.from(headerFieldsMap.values()),
    isMultiLine: uiConfig.isMultiLine,
    tableColumns: (uiConfig.tableColumns || []).map((col: any) => {
      if (typeof col === 'string') {
        return { fieldId: col };
      }
      return {
        fieldId: col.id || col.fieldId,
        width: col.width,
        labelOverride: col.labelOverride
      };
    }),
    tableStyle: uiConfig.tableStyle || 'web',
    baseType: uiConfig.baseType || uiConfig.id, // Ensure base strategy is preserved
    requiresApproval,
    preventNegativeCash,
    allowFutureDates,
    mandatoryAttachments,
    enabledActions,
    companyId,
    updatedAt: new Date(),
    updatedBy: userId,
  };
  
  // Pack additional metadata if present in uiConfig
  // Pack additional metadata if present in uiConfig
  const sharedFields = new Set<string>();
  
  // Helper to extract shared fields from a layout
  const extractShared = (modeOverride: any) => {
    if (!modeOverride?.sections) return;
    Object.values(modeOverride.sections).forEach((section: any) => {
      if (section.fields) {
        section.fields.forEach((f: any) => {
          const fieldMeta = AVAILABLE_FIELDS.find(af => af.id === f.fieldId);
          if (fieldMeta?.category === 'shared') {
            sharedFields.add(f.fieldId);
          }
        });
      }
    });
  };

  extractShared(uiConfig.uiModeOverrides.classic);
  extractShared(uiConfig.uiModeOverrides.windows);

  canonical.metadata = {
    ...(canonical.metadata || {}),
    ...(uiConfig.metadata || {}),
    sharedFields: Array.from(sharedFields)
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
      fields: sectionData.fields.map(field => {
        // Find field metadata to get category
        const fieldMeta = [...SYSTEM_FIELDS, ...AVAILABLE_FIELDS]
          .find(f => f.id === field.fieldId);
        
        return {
          fieldId: field.fieldId,
          row: field.row,
          col: field.col,
          colSpan: field.colSpan,
          label: field.labelOverride,
          category: fieldMeta?.category,
          mandatory: fieldMeta?.mandatory
        };
      })
    };
  });
  
  return { sections };
}

/**
 * Validate UI config before transformation
 */
export function validateUiConfig(config: VoucherFormConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.id || config.id.trim() === '') {
    errors.push('Form ID is required');
  }
  
  if (!config.name || config.name.trim() === '') {
    errors.push('Form name is required');
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
