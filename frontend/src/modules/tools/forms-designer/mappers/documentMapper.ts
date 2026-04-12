import { DocumentFormConfig, FieldLayout, DocumentAction, UIMode, SectionType, AvailableField } from '../types';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';
import { FieldDefinition } from '../../../../designer-engine/types/FieldDefinition';

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
 * Universal Mapper: UI Config → Canonical Schema (Document/VoucherTypeDefinition)
 * 
 * @param uiConfig - The raw output from the form designer
 * @param metadata - The domain metadata (system fields and available module fields)
 * @param module - The module name (accounting, sales, etc.)
 * @param context - Additional context (companyId, userId, etc.)
 */
export function documentUiToCanonical(
  uiConfig: DocumentFormConfig,
  metadata: {
     systemFields: AvailableField[];
     availableFields: AvailableField[];
  },
  module: string,
  context: {
    companyId: string;
    userId: string;
    isEdit?: boolean;
  }
): VoucherTypeDefinition {
  const { companyId, userId, isEdit = false } = context;
  const allFields = [...metadata.systemFields, ...metadata.availableFields];

  // Map UI types to Backend FieldType enum
  const mapFieldType = (type: string): FieldDefinition['type'] => {
    switch (type) {
      case 'number': return 'NUMBER';
      case 'date': return 'DATE';
      case 'checkbox': return 'CHECKBOX';
      case 'select': return 'SELECT';
      case 'account-selector': return 'account-selector';
      case 'cost-center-selector': return 'cost-center-selector';
      case 'textarea': return 'TEXTAREA';
      case 'relation': return 'RELATION';
      default: return 'TEXT';
    }
  };

  // Maps rules to simple flags if they exist
  const getRuleFlag = (ruleId: string) => (uiConfig.rules || []).find(r => r.id === ruleId)?.enabled || false;
  
  // Normalize uiModeOverrides to prevent null reference errors
  const uiOverrides = uiConfig.uiModeOverrides || {
    classic: { sections: { HEADER: { order: 0, fields: [] }, BODY: { order: 1, fields: [] }, EXTRA: { order: 2, fields: [] }, ACTIONS: { order: 3, fields: [] } } },
    windows: { sections: { HEADER: { order: 0, fields: [] }, BODY: { order: 1, fields: [] }, EXTRA: { order: 2, fields: [] }, ACTIONS: { order: 3, fields: [] } } }
  };

  // Layout transformation
  const layout = {
    classic: transformLayout(uiOverrides.classic, 'classic', allFields),
    windows: transformLayout(uiOverrides.windows, 'windows', allFields)
  };

  // Collect all unique fields used across layouts to build the flat FieldDefinition list
  const headerFieldsMap = new Map<string, FieldDefinition>();
  
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
                isPosting: (meta as any).isPosting || false,
                postingRole: (meta as any).postingRole || null,
                schemaVersion: 2
              } as FieldDefinition);
            }
          }
        });
      }
    });
  };

  collectFields(uiOverrides.classic);
  collectFields(uiOverrides.windows);
  
  const canonical: VoucherTypeDefinition = {
    id: uiConfig.id,
    code: uiConfig.id,
    module,
    name: uiConfig.name,
    schemaVersion: 2,
    prefix: uiConfig.prefix,
    nextNumber: uiConfig.startNumber,
    enabled: uiConfig.enabled !== undefined ? uiConfig.enabled : true,
    isSystemDefault: uiConfig.isSystemDefault || false,
    inUse: uiConfig.inUse || false,
    layout,
    headerFields: Array.from(headerFieldsMap.values()),
    isMultiLine: uiConfig.isMultiLine,
    tableColumns: (uiConfig.tableColumns || []).map((col: any) => ({
        fieldId: typeof col === 'string' ? col : (col.id || col.fieldId),
        width: typeof col === 'string' ? undefined : col.width,
        labelOverride: typeof col === 'string' ? undefined : col.labelOverride
    })),
    tableStyle: uiConfig.tableStyle || 'web',
    baseType: uiConfig.baseType || uiConfig.id,
    
    // Feature flags
    requiresApproval: getRuleFlag('require_approval'),
    preventNegativeCash: getRuleFlag('prevent_negative_cash'),
    allowFutureDates: getRuleFlag('allow_future_date'),
    mandatoryAttachments: getRuleFlag('mandatory_attachments'),
    
    enabledActions: uiConfig.actions
        .filter((a: DocumentAction) => a.enabled)
        .map((a: DocumentAction) => a.type),
        
    companyId,
    updatedAt: new Date(),
    updatedBy: userId,
    createdAt: isEdit ? undefined : new Date(),
    createdBy: isEdit ? undefined : userId,
  };
  
  // Track shared fields (non-core fields that might be used across vouchers)
  const sharedFields = new Set<string>();
  allFields.filter(f => f.category === 'shared').forEach(f => {
      // If used in any layout
      const usedInClassic = uiOverrides.classic?.sections?.HEADER?.fields?.some(lf => lf.fieldId === f.id); 
      // For simplicity, we just check if it exists in the headerFieldsMap we built
      if (headerFieldsMap.has(f.id)) {
          sharedFields.add(f.id);
      }
  });

  canonical.metadata = {
    ...(uiConfig.metadata || {}),
    sharedFields: Array.from(sharedFields)
  };
  
  return canonical;
}

function transformLayout(
  uiLayout: { sections: Record<SectionType, { order: number; fields: FieldLayout[] }> },
  mode: UIMode,
  allFields: AvailableField[]
): LayoutSchema {
  const sections: any = {};
  
  Object.entries(uiLayout.sections).forEach(([sectionName, sectionData]) => {
    sections[sectionName] = {
      order: sectionData.order,
      fields: sectionData.fields.map(field => {
        const fieldMeta = allFields.find(f => f.id === field.fieldId);
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
