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
import { voucherFormApi } from '../../../../api/voucherFormApi';

function normalizeModule(value: any): string {
  const raw = String(value || '').trim().toUpperCase();
  if (raw === 'PURCHASES') return 'PURCHASE';
  if (raw === 'SALES_MODULE') return 'SALES';
  return raw;
}

function inferFormModule(form: any): string {
  const explicit = normalizeModule(form.module);
  if (explicit) return explicit;

  const candidates = [
    form.formType,
    form.baseType,
    form.voucherType,
    form.typeId,
    form.code,
    form.id,
  ].map((value) => String(value || '').toLowerCase());

  if (candidates.some((value) => value.startsWith('sales_') || value === 'sales_invoice')) {
    return 'SALES';
  }

  if (candidates.some((value) => value.startsWith('purchase_') || value === 'purchase_invoice')) {
    return 'PURCHASE';
  }

  return 'ACCOUNTING';
}

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
    const targetModule = normalizeModule(module);
    try {
      const apiForms = await voucherFormApi.list();
      const filteredApiForms = apiForms
        .filter((form: any) => inferFormModule(form) === targetModule)
        .map((form: any) => ({ ...form, id: form.id } as DocumentFormConfig));

      if (filteredApiForms.length > 0) {
        return filteredApiForms;
      }
    } catch (apiError) {
      console.warn('[loadModuleDocumentForms] API load failed, falling back to Firestore path:', apiError);
    }

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
 * Load system-level voucher type definitions from the platform catalog
 * 
 * @param module - The module name (e.g., 'ACCOUNTING', 'SALES', 'PURCHASE')
 */
export async function loadSystemVoucherTypes(module: string): Promise<any[]> {
  try {
    const { collection, getDocs } = await import('firebase/firestore');
    const { db } = await import('../../../../config/firebase');

    const normalizeModule = (value: any): string => {
      const raw = String(value || '').trim().toUpperCase();
      if (raw === 'PURCHASES') return 'PURCHASE';
      return raw;
    };
    const targetModule = normalizeModule(module);
    
    const typesRef = collection(db, 'system_metadata/voucher_types/items');
    const snapshot = await getDocs(typesRef);
    
    const definitions: any[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const moduleCandidates = [
        data.module,
        data.moduleCode,
        data.moduleId,
        data.domain,
      ];
      const matched = moduleCandidates.some((candidate) => normalizeModule(candidate) === targetModule);
      if (matched) {
        definitions.push({ id: docSnap.id, ...data, isSystemCatalog: true });
      }
    });
    
    return definitions;
  } catch (error) {
    console.error(`[loadSystemVoucherTypes] Failed for module ${module}:`, error);
    return [];
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
