/**
 * Voucher Wizard Service
 * 
 * Handles loading and saving voucher type definitions
 * Integrates with Firestore and applies validation
 */

import { VoucherFormConfig } from '../types';
import { uiToCanonical, canonicalToUi, validateUiConfig } from '../mappers';
import { validateUniqueness } from '../validators/uniquenessValidator';

// Firebase imports
import { db } from '../../../../config/firebase';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc, query, where } from 'firebase/firestore';

/**
 * Load default system voucher templates from Firestore
 * Uses pattern: system_metadata/voucher_types/items/{voucherTypeId}
 */
export async function loadDefaultTemplates(): Promise<VoucherFormConfig[]> {
  try {
    const templatesRef = collection(db, 'system_metadata', 'voucher_types', 'items');
    const snapshot = await getDocs(templatesRef);
    
    const templates: VoucherFormConfig[] = [];
    
    snapshot.forEach(doc => {
      try {
        const canonical = { id: doc.id, ...doc.data() } as any;
        const uiConfig = canonicalToUi(canonical);
        templates.push(uiConfig);
      } catch (err) {
        // console.warn(`Failed to parse template ${doc.id}:`, err); // Removed debug console.warn
      }
    });
    
    return templates;
  } catch (error) {
    console.error('❌ Failed to load templates:', error);
    return [];
  }
}

/**
 * Load company-specific voucher forms
 */
export async function loadCompanyForms(companyId: string): Promise<VoucherFormConfig[]> {
  try {
    const formsRef = collection(db, `companies/${companyId}/accounting/Settings/voucherForms`);
    const snapshot = await getDocs(formsRef);
    
    const forms: VoucherFormConfig[] = [];
    
    snapshot.forEach(doc => {
      try {
        const canonical = { id: doc.id, ...doc.data() } as any;
        const uiConfig = canonicalToUi(canonical);
        forms.push(uiConfig);
      } catch (err) {
        console.error(`[loadCompanyForms] Failed to parse document ${doc.id}:`, err);
      }
    });
    
    return forms;
  } catch (error) {
    console.error('Failed to load company forms:', error);
    return [];
  }
}

/**
 * Remove undefined values from object (Firestore doesn't allow undefined)
 */
function removeUndefined(obj: any): any {
  if (obj === null || obj === undefined) return null;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(removeUndefined);
  
  const cleaned: any = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value !== undefined) {
      cleaned[key] = removeUndefined(value);
    }
  });
  return cleaned;
}

/**
 * Ensure uiModeOverrides is populated for all modes
 * Auto-generates layout if missing
 */
function ensureUIModeOverrides(config: VoucherFormConfig): VoucherFormConfig {
  if (config.uiModeOverrides && 
      config.uiModeOverrides.windows?.sections?.ACTIONS?.fields?.length > 0) {
    return config;
  }

  const newOverrides: any = {};
  const modes: ('windows' | 'classic')[] = ['windows', 'classic'];

  modes.forEach(mode => {
    const isWindows = mode === 'windows';
    const sections: any = {
      HEADER: [],
      BODY: [],
      EXTRA: [],
      ACTIONS: []
    };

    let headerRow = 0;
    let headerColCursor = 0;

    const systemFields = ['voucherNo', 'status', 'createdBy', 'createdAt'];
    systemFields.forEach(fieldId => {
      if (isWindows) {
        sections.HEADER.push({ fieldId, row: 0, col: headerColCursor, colSpan: 3 });
        headerColCursor += 3;
      } else {
        sections.HEADER.push({ fieldId, row: headerRow, col: 0, colSpan: 12 });
        headerRow++;
      }
    });
    if (isWindows) headerRow = 1;

    const headerFields = (config as any).headerFields || [];
    headerFields.forEach((fieldId: string) => {
      const span = isWindows ? 4 : 12;
      if (isWindows) {
        if (headerColCursor + span > 12) {
          headerRow++;
          headerColCursor = 0;
        }
        sections.HEADER.push({ fieldId, row: headerRow, col: headerColCursor, colSpan: span });
        headerColCursor += span;
      } else {
        sections.HEADER.push({ fieldId, row: headerRow, col: 0, colSpan: 12 });
        headerRow++;
      }
    });

    if ((config as any).isMultiLine !== false) {
      sections.BODY.push({ fieldId: 'lineItems', row: 0, col: 0, colSpan: 12 });
    }

    const enabledActions = (config.actions || []).filter(a => a.enabled);
    enabledActions.forEach((action, idx) => {
      const span = isWindows ? Math.floor(12 / Math.min(4, enabledActions.length)) : 12;
      const row = isWindows ? 0 : idx;
      const col = isWindows ? idx * span : 0;
      sections.ACTIONS.push({
        fieldId: `action_${action.type}`,
        labelOverride: action.label,
        row,
        col,
        colSpan: span
      });
    });

    newOverrides[mode] = {
      sections: {
        HEADER: { order: 0, fields: sections.HEADER },
        BODY: { order: 1, fields: sections.BODY },
        EXTRA: { order: 2, fields: sections.EXTRA },
        ACTIONS: { order: 3, fields: sections.ACTIONS }
      }
    };
  });

  return {
    ...config,
    uiModeOverrides: newOverrides
  };
}

/**
 * Save voucher form configuration
 */
export async function saveVoucherForm(
  companyId: string,
  config: VoucherFormConfig,
  userId: string,
  isEdit: boolean = false
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    config = ensureUIModeOverrides(config);
    
    // Validate UI config
    const uiValidation = validateUiConfig(config);
    if (!uiValidation.valid) {
      return { success: false, errors: uiValidation.errors };
    }
    
    // Check uniqueness
    const uniquenessResult = await validateUniqueness(
      companyId,
      config.name,
      config.id,
      config.prefix,
      isEdit ? config.id : undefined
    );
    
    if (!uniquenessResult.isValid) {
      const errors = Object.values(uniquenessResult.errors).filter(Boolean) as string[];
      return { success: false, errors };
    }
    
    // Transform to canonical - We keep this to extract layout but we DO NOT save to voucher_types
    // as per refined architecture: Backend types are fixed strategies.
    const canonical = uiToCanonical(config, companyId, userId, isEdit);
    
    // Save to voucherForms for modern UI usage
    const extractHeaderFields = () => {
      const windowsLayout = config.uiModeOverrides?.windows?.sections?.HEADER?.fields || [];
      const classicLayout = config.uiModeOverrides?.classic?.sections?.HEADER?.fields || [];
      const fields = windowsLayout.length > 0 ? windowsLayout : classicLayout;
      return fields.map((f: any) => ({
        id: f.fieldId,
        label: f.labelOverride || f.fieldId,
        type: 'text',
        order: f.row || 0
      }));
    };

    const extractTableColumns = () => {
      if (config.tableColumns && Array.isArray(config.tableColumns)) {
        return config.tableColumns.map((col: any) => {
          const id = typeof col === 'string' ? col : (col.id || col.fieldId);
          const label = typeof col === 'string' ? col : (col.labelOverride || col.label || id);
          const width = typeof col === 'string' ? undefined : col.width;
          
          return {
            id,
            fieldId: id,
            label,
            labelOverride: label,
            width,
            type: 'text',
            order: 0
          };
        });
      }
      return [];
    };

    const formData = {
      id: config.id,
      companyId,
      typeId: (config as any).baseType || config.id,
      baseType: (canonical as any).baseType || canonical.code || canonical.id,
      name: config.name,
      code: config.id,
      prefix: config.prefix || config.id?.slice(0, 3).toUpperCase() || 'V',
      isDefault: false,
      isSystemGenerated: false,
      isLocked: false,
      enabled: config.enabled !== false,
      headerFields: extractHeaderFields(),
      tableColumns: extractTableColumns(),
      uiModeOverrides: config.uiModeOverrides || null,
      // IMPORTANT: Add layout here so canonicalToUi can restore it!
      layout: canonical.layout,
      tableStyle: config.tableStyle || 'web',
      rules: config.rules || [],
      actions: config.actions || [],
      enabledActions: canonical.enabledActions || [],
      requiresApproval: canonical.requiresApproval || false,
      preventNegativeCash: canonical.preventNegativeCash || false,
      allowFutureDates: canonical.allowFutureDates ?? true,
      mandatoryAttachments: canonical.mandatoryAttachments || false,
      isMultiLine: config.isMultiLine ?? true,
      defaultCurrency: config.defaultCurrency || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId
    };
    
    const formRef = doc(db, `companies/${companyId}/accounting/Settings/voucherForms`, config.id);
    await setDoc(formRef, removeUndefined(formData), { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save voucher form:', error);
    return { success: false, errors: ['Failed to save voucher form. Please try again.'] };
  }
}

/**
 * Clone a voucher form template
 */
export async function cloneVoucherForm(
  sourceFormId: string,
  companyId: string,
  isSystemDefault: boolean = false
): Promise<VoucherFormConfig | null> {
  try {
    let sourceDoc;
    if (isSystemDefault) {
      sourceDoc = await getDoc(doc(db, 'systemVoucherTemplates', sourceFormId));
    } else {
      sourceDoc = await getDoc(doc(db, `companies/${companyId}/accounting/Settings/voucherForms`, sourceFormId));
    }
    
    if (!sourceDoc.exists()) {
      console.error('Source form not found');
      return null;
    }
    
    const canonical = sourceDoc.data() as any;
    const uiConfig = canonicalToUi(canonical);
    
    uiConfig.id = `${uiConfig.id}_copy_${Date.now()}`;
    uiConfig.name = `${uiConfig.name} (Copy)`;
    uiConfig.isSystemDefault = false;
    uiConfig.isLocked = false;
    uiConfig.inUse = false;
    
    return uiConfig;
  } catch (error) {
    console.error('Failed to clone form:', error);
    return null;
  }
}

/**
 * Toggle form enabled/disabled state
 */
export async function toggleFormEnabled(
  companyId: string,
  formId: string,
  enabled: boolean
): Promise<boolean> {
  try {
    const formRef = doc(db, `companies/${companyId}/accounting/Settings/voucherForms`, formId);
    await updateDoc(formRef, { enabled });
    return true;
  } catch (error) {
    console.error('Failed to toggle form:', error);
    return false;
  }
}

/**
 * Check if form can be deleted
 */
export async function checkFormDeletable(
  companyId: string,
  formId: string
): Promise<{ canDelete: boolean; reason?: string }> {
  try {
    const formRef = doc(db, `companies/${companyId}/accounting/Settings/voucherForms`, formId);
    const formDoc = await getDoc(formRef);
    
    if (!formDoc.exists()) {
      return { canDelete: false, reason: 'Form not found' };
    }
    
    const data = formDoc.data();
    if (data.isSystemDefault) {
      return { canDelete: false, reason: 'System templates cannot be deleted' };
    }
    
    if (data.inUse) {
      return { canDelete: false, reason: 'This form is in use and cannot be deleted. You can disable it instead.' };
    }
    
    return { canDelete: true };
  } catch (error) {
    return { canDelete: false, reason: 'Error checking form status' };
  }
}

/**
 * Delete a voucher form
 */
// Import API client
import client from '../../../../api/client';

/**
 * Delete a voucher form
 * 
 * Uses secure Backend API to enforce usage checks.
 */
export async function deleteVoucherForm(companyId: string, formId: string): Promise<boolean> {
  try {
    // New Secure Method: Call Backend API
    await client.delete(`/tenant/accounting/voucher-forms/${formId}`);
    return true;
  } catch (error) {
    console.error('Failed to delete form via API:', error);
    // Explicitly re-throw if it's a conflict (409) so UI can show the specific message
    const status = (error as any).response?.status;
    if (status === 409 || status === 403) {
      throw error;
    }
    return false;
  }
}

/**
 * Get a specific voucher form by ID
 */
export async function getVoucherFormById(companyId: string, formId: string): Promise<VoucherFormConfig | null> {
  try {
    const formRef = doc(db, `companies/${companyId}/accounting/Settings/voucherForms`, formId);
    const snap = await getDoc(formRef);
    
    if (snap.exists()) {
      const canonical = snap.data() as any;
      return canonicalToUi(canonical);
    }
    return null;
  } catch (error) {
    console.error('Failed to load voucher form:', error);
    return null;
  }
}
