/**
 * Generic Document Designer Service
 * 
 * Handles loading and saving document form configurations (Invoices, Orders, Vouchers, etc.)
 * across all ERP modules.
 */

import { DocumentFormConfig, AvailableField } from '../types';
import { documentUiToCanonical } from '../mappers/documentMapper';
import { db } from '../../../../config/firebase';
import { collection, doc, getDocs, getDoc, setDoc, updateDoc } from 'firebase/firestore';

/**
 * Remove undefined values from object (Firestore restriction)
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
 * Load company-specific document forms for a module
 * 
 * @param companyId - The ID of the current company
 * @param module - The module name (e.g., 'sales', 'purchases', 'inventory')
 */
export async function loadModuleDocumentForms(companyId: string, module: string): Promise<DocumentFormConfig[]> {
  try {
    const baseModule = module.toLowerCase();
    const collectionName = 'voucherForms';
    
    const formsRef = collection(db, `companies/${companyId}/${baseModule}/Settings/${collectionName}`);
    const snapshot = await getDocs(formsRef);
    
    const forms: DocumentFormConfig[] = [];
    snapshot.forEach(docSnap => {
      forms.push({ id: docSnap.id, ...docSnap.data() } as any);
    });
    
    return forms;
  } catch (error) {
    console.error(`[loadModuleDocumentForms] Failed for module ${module}:`, error);
    return [];
  }
}

/**
 * Load underlying document types (the strategy/definitions) for a module
 * e.g. "Sales Invoices", "Sales Orders"
 */
export async function loadModuleDocumentDefinitions(companyId: string, module: string): Promise<any[]> {
  try {
    const baseModule = module.toLowerCase();
    // Path: companies/{companyId}/{module}/Settings/voucher_types
    const typesRef = collection(db, `companies/${companyId}/${baseModule}/Settings/voucher_types`);
    const snapshot = await getDocs(typesRef);
    
    const definitions: any[] = [];
    snapshot.forEach(docSnap => {
      definitions.push({ id: docSnap.id, ...docSnap.data() });
    });
    
    return definitions;
  } catch (error) {
    console.error(`[loadModuleDocumentDefinitions] Failed for module ${module}:`, error);
    return [];
  }
}

/**
 * Save document form configuration
 */
export async function saveDocumentForm(
  companyId: string,
  module: string,
  config: DocumentFormConfig,
  metadata: { systemFields: AvailableField[]; availableFields: AvailableField[] },
  userId: string,
  isEdit: boolean = false
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    const baseModule = module.toLowerCase();
    const collectionName = 'voucherForms';
    
    // 1. Transform to Canonical for the designer-engine and backend
    const canonical = documentUiToCanonical(config, metadata, module.toUpperCase(), {
      companyId,
      userId,
      isEdit
    });
    
    // 2. Prepare the Firestore document following the established pattern
    const docData = {
      ...config,
      companyId,
      module: module.toUpperCase(),
      canonical, // Store canonical part for backend sync
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    };
    
    if (!isEdit) {
      docData.createdAt = new Date().toISOString();
      docData.createdBy = userId;
    }

    const formRef = doc(db, `companies/${companyId}/${baseModule}/Settings/${collectionName}`, config.id);
    await setDoc(formRef, removeUndefined(docData), { merge: true });
    
    return { success: true };
  } catch (error) {
    console.error(`[saveDocumentForm] Failed for module ${module}:`, error);
    return { success: false, errors: ['Failed to save document.'] };
  }
}

/**
 * Lightweight metadata update — does NOT run the full canonical mapper.
 * Use this for simple field updates like toggling `enabled`, renaming, etc.
 */
export async function updateFormMetadata(
  companyId: string,
  module: string,
  formId: string,
  fields: Record<string, any>,
  userId: string
): Promise<{ success: boolean; errors?: string[] }> {
  try {
    const baseModule = module.toLowerCase();
    const collectionName = 'voucherForms';

    const formRef = doc(db, `companies/${companyId}/${baseModule}/Settings/${collectionName}`, formId);

    await updateDoc(formRef, removeUndefined({
      ...fields,
      updatedAt: new Date().toISOString(),
      updatedBy: userId,
    }));

    return { success: true };
  } catch (error) {
    console.error(`[updateFormMetadata] Failed for module ${module}, form ${formId}:`, error);
    return { success: false, errors: [(error as Error).message || 'Failed to update form.'] };
  }
}
