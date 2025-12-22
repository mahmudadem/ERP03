/**
 * Voucher Wizard Service
 * 
 * Handles loading and saving voucher type definitions
 * Integrates with Firestore and applies validation
 */

import { VoucherTypeConfig } from '../types';
import { uiToCanonical, canonicalToUi, validateUiConfig } from '../mappers';
import { validateUniqueness } from '../validators/uniquenessValidator';

// Firebase imports
import { db } from '../../../../config/firebase';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc, query, where } from 'firebase/firestore';

/**
 * Load default system voucher templates from Firestore
 * Uses pattern: system_metadata/voucher_types/items/{voucherTypeId}
 * (Same structure as system_metadata/plans/items/{planId})
 */
export async function loadDefaultTemplates(): Promise<VoucherTypeConfig[]> {
  try {
    // Load from system_metadata/voucher_types/items
    const templatesRef = collection(db, 'system_metadata', 'voucher_types', 'items');
    const snapshot = await getDocs(templatesRef);
    
    const templates: VoucherTypeConfig[] = [];
    
    snapshot.forEach(doc => {
      try {
        const canonical = doc.data() as any;
        const uiConfig = canonicalToUi(canonical);
        templates.push(uiConfig);
      } catch (err) {
        console.warn(`Failed to parse template ${doc.id}:`, err);
      }
    });
    
    console.log(`✅ Loaded ${templates.length} default voucher templates from Firestore`);
    return templates;
  } catch (error) {
    console.error('❌ Failed to load templates from system_metadata/voucher_types/items:', error);
    return [];
  }
}

/**
 * Load company-specific voucher types
 */
export async function loadCompanyVouchers(companyId: string): Promise<VoucherTypeConfig[]> {
  try {
    const vouchersRef = collection(db, `companies/${companyId}/voucherTypes`);
    const snapshot = await getDocs(vouchersRef);
    
    const vouchers: VoucherTypeConfig[] = [];
    
    snapshot.forEach(doc => {
      try {
        const canonical = doc.data() as any; 
        const uiConfig = canonicalToUi(canonical);
        vouchers.push(uiConfig);
      } catch (err) {
        console.error(`[loadCompanyVouchers] Failed to parse document ${doc.id}:`, err);
      }
    });
    
    return vouchers;
  } catch (error) {
    console.error('Failed to load company vouchers:', error);
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
 * Save voucher type (create or update)
 */
export async function saveVoucher(
  companyId: string,
  config: VoucherTypeConfig,
  userId: string,
  isEdit: boolean = false
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    // Validate UI config
    const uiValidation = validateUiConfig(config);
    if (!uiValidation.valid) {
      return { success: false, errors: uiValidation.errors };
    }
    
    // Check uniqueness (name, ID, prefix)
    const uniquenessResult = await validateUniqueness(
      companyId,
      config.name,
      config.id,
      config.prefix,
      isEdit ? config.id : undefined // Exclude self when editing
    );
    
    console.log('[saveVoucher] Uniqueness validation result:', uniquenessResult);
    
    if (!uniquenessResult.isValid) {
      const errors = Object.values(uniquenessResult.errors).filter(Boolean) as string[];
      console.error('[saveVoucher] Uniqueness validation failed:', errors);
      return { success: false, errors };
    }
    
    // Transform to canonical
    const canonical = uiToCanonical(config, companyId, userId, isEdit);
    
    // Remove undefined values (Firestore doesn't allow them)
    const cleanedData = removeUndefined(canonical);
    
    // Save to voucherTypes (legacy, for backend type info)
    const voucherTypeRef = doc(db, `companies/${companyId}/voucherTypes`, config.id);
    
    if (isEdit) {
      await updateDoc(voucherTypeRef, cleanedData);
    } else {
      await setDoc(voucherTypeRef, cleanedData);
    }
    
    // ALSO save to voucherForms (new, for sidebar and rendering)
    // Extract headerFields from wizard layout (convert uiModeOverrides to flat fields)
    const extractHeaderFields = () => {
      const windowsLayout = config.uiModeOverrides?.windows?.sections?.HEADER?.fields || [];
      const classicLayout = config.uiModeOverrides?.classic?.sections?.HEADER?.fields || [];
      // Prefer windows layout, fallback to classic
      const fields = windowsLayout.length > 0 ? windowsLayout : classicLayout;
      return fields.map((f: any) => ({
        id: f.fieldId,
        label: f.labelOverride || f.fieldId,
        type: 'text', // Default type, can be enhanced later
        order: f.row || 0
      }));
    };

    // Extract tableColumns from wizard config
    const extractTableColumns = () => {
      if (config.tableColumns && Array.isArray(config.tableColumns)) {
        return config.tableColumns.map((col: any) => ({
          id: typeof col === 'string' ? col : col.fieldId || col.id,
          label: typeof col === 'string' ? col : col.label || col.fieldId,
          type: 'text',
          order: 0
        }));
      }
      return [];
    };

    const formData = {
      id: config.id,
      companyId,
      typeId: (config as any).baseType || config.id, // Use baseType for cloned forms, otherwise id
      baseType: (config as any).baseType || config.code || config.id, // Store base type explicitly
      name: config.name,
      code: config.id,
      prefix: config.prefix || config.id?.slice(0, 3).toUpperCase() || 'V',
      isDefault: false,
      isSystemGenerated: false,
      isLocked: false,
      enabled: config.enabled !== false,
      // Layout data
      headerFields: extractHeaderFields(),
      tableColumns: extractTableColumns(),
      // Full layout for custom rendering
      uiModeOverrides: config.uiModeOverrides || null,
      // Rules and actions
      rules: config.rules || [],
      actions: config.actions || [],
      isMultiLine: config.isMultiLine ?? true,
      defaultCurrency: config.defaultCurrency || 'USD',
      layout: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: userId
    };
    
    const formRef = doc(db, `companies/${companyId}/voucherForms`, config.id);
    
    if (isEdit) {
      await updateDoc(formRef, removeUndefined(formData));
    } else {
      await setDoc(formRef, removeUndefined(formData));
    }
    
    console.log('[saveVoucher] Saved to both voucherTypes and voucherForms');
    
    return { success: true };
  } catch (error) {
    console.error('Failed to save voucher:', error);
    return { success: false, errors: ['Failed to save voucher. Please try again.'] };
  }
}

/**
 * Clone a voucher (typically from system defaults)
 */
export async function cloneVoucher(
  sourceVoucherId: string,
  companyId: string,
  isSystemDefault: boolean = false
): Promise<VoucherTypeConfig | null> {
  try {
    let sourceDoc;
    
    if (isSystemDefault) {
      // Load from system templates
      sourceDoc = await getDoc(doc(db, 'systemVoucherTemplates', sourceVoucherId));
    } else {
      // Load from company vouchers
      sourceDoc = await getDoc(doc(db, `companies/${companyId}/voucherTypes`, sourceVoucherId));
    }
    
    if (!sourceDoc.exists()) {
      console.error('Source voucher not found');
      return null;
    }
    
    const canonical = sourceDoc.data() as any; // TODO: Use proper type
    const uiConfig = canonicalToUi(canonical);
    
    // Modify for cloning
    uiConfig.id = `${uiConfig.id}_copy_${Date.now()}`;
    uiConfig.name = `${uiConfig.name} (Copy)`;
    uiConfig.isSystemDefault = false;
    uiConfig.isLocked = false;
    uiConfig.inUse = false;
    
    return uiConfig;
  } catch (error) {
    console.error('Failed to clone voucher:', error);
    return null;
  }
}

/**
 * Toggle voucher enabled/disabled state
 */
export async function toggleVoucherEnabled(
  companyId: string,
  voucherId: string,
  enabled: boolean
): Promise<boolean> {
  try {
    const voucherRef = doc(db, `companies/${companyId}/voucherTypes`, voucherId);
    await updateDoc(voucherRef, { enabled });
    return true;
  } catch (error) {
    console.error('Failed to toggle voucher:', error);
    return false;
  }
}

/**
 * Check if voucher can be deleted
 * Returns: { canDelete: boolean, reason?: string }
 */
export async function checkDeletable(
  companyId: string,
  voucherId: string
): Promise<{ canDelete: boolean; reason?: string }> {
  try {
    const voucherRef = doc(db, `companies/${companyId}/voucherTypes`, voucherId);
    const voucherDoc = await getDoc(voucherRef);
    
    if (!voucherDoc.exists()) {
      return { canDelete: false, reason: 'Voucher not found' };
    }
    
    const data = voucherDoc.data();
    
    if (data.isSystemDefault) {
      return { canDelete: false, reason: 'System defaults cannot be deleted' };
    }
    
    if (data.inUse) {
      return { canDelete: false, reason: 'Voucher is in use and cannot be deleted. You can disable it instead.' };
    }
    
    return { canDelete: true };
  } catch (error) {
    console.error('Failed to check deletable:', error);
    return { canDelete: false, reason: 'Error checking voucher status' };
  }
}
