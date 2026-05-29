/**
 * Uniqueness Validator
 *
 * Validates that document name, ID, and prefix are unique within company scope.
 *
 * Modes:
 *  - In-memory (preferred): pass `existingForms` and we check against them.
 *    Used by the new Voucher Designer where the page already holds the full
 *    list of forms in React state and going back to Firestore from the
 *    client would either duplicate work or trip Firestore rules.
 *  - Firestore fallback (legacy): no `existingForms` passed -> reads from
 *    `companies/{cid}/documentTypes`. If that read fails (permission denied
 *    on the legacy collection, etc.) we degrade to `isValid: true` and let
 *    the backend save catch the conflict. Blocking a valid edit with a
 *    misleading "Failed to validate uniqueness" is worse than relying on
 *    the server's authoritative check.
 */

import { db } from '../../../../config/firebase';
import { collection, getDocs } from 'firebase/firestore';

export interface ValidationResult {
  isValid: boolean;
  errors: {
    name?: string;
    id?: string;
    prefix?: string;
  };
}

/** Minimal shape of an existing form we need to compare against. */
export interface ExistingFormForUniqueness {
  id?: string;
  name?: string;
  prefix?: string;
}

const equalsIgnoreCase = (a: string | undefined, b: string): boolean =>
  !!a && a.toLowerCase() === b.toLowerCase();

/**
 * Validate uniqueness of name, ID, and prefix within company.
 *
 * @param companyId  - Tenant id (only used in the Firestore fallback path).
 * @param name       - Proposed form name.
 * @param id         - Proposed form id.
 * @param prefix     - Proposed form prefix.
 * @param excludeDocumentId - When editing an existing form, skip comparing
 *                            it against itself.
 * @param existingForms - Optional in-memory list. When provided, skips the
 *                        Firestore read entirely.
 */
export async function validateUniqueness(
  companyId: string,
  name: string,
  id: string,
  prefix: string,
  excludeDocumentId?: string,
  existingForms?: ExistingFormForUniqueness[],
): Promise<ValidationResult> {
  const errors: ValidationResult['errors'] = {};

  // Preferred path: check against the in-memory forms list.
  if (Array.isArray(existingForms)) {
    for (const form of existingForms) {
      if (excludeDocumentId && form.id === excludeDocumentId) continue;
      if (equalsIgnoreCase(form.name, name)) {
        errors.name = 'A document with this name already exists';
      }
      if (equalsIgnoreCase(form.id, id)) {
        errors.id = 'This ID is already in use';
      }
      if (equalsIgnoreCase(form.prefix, prefix)) {
        errors.prefix = 'This prefix is already assigned to another document';
      }
    }
    return { isValid: Object.keys(errors).length === 0, errors };
  }

  // Legacy fallback: query the documentTypes collection. On any read error
  // we treat the check as a soft pass — the backend save will catch a real
  // duplicate.
  try {
    const documentsRef = collection(db, `companies/${companyId}/documentTypes`);
    const snapshot = await getDocs(documentsRef);

    snapshot.forEach(doc => {
      if (excludeDocumentId && doc.id === excludeDocumentId) return;

      const data = doc.data();
      if (equalsIgnoreCase(data.name, name)) {
        errors.name = 'A document with this name already exists';
      }
      if (equalsIgnoreCase(doc.id, id)) {
        errors.id = 'This ID is already in use';
      }
      if (equalsIgnoreCase(data.prefix, prefix)) {
        errors.prefix = 'This prefix is already assigned to another document';
      }
    });

    return { isValid: Object.keys(errors).length === 0, errors };
  } catch (error) {
    // Don't block the user when the legacy read fails — defer to the
    // backend save for the authoritative uniqueness check.
    console.warn('[validateUniqueness] Falling back to server-side check:', error);
    return { isValid: true, errors: {} };
  }
}

/**
 * Quick check if a specific field value is unique
 */
export async function isFieldUnique(
  companyId: string,
  fieldName: 'name' | 'id' | 'prefix',
  value: string,
  excludeDocumentId?: string
): Promise<boolean> {
  try {
    const documentsRef = collection(db, `companies/${companyId}/documentTypes`);
    const snapshot = await getDocs(documentsRef);
    
    const normalized = value.toLowerCase();
    
    for (const doc of snapshot.docs) {
      if (excludeDocumentId && doc.id === excludeDocumentId) {
        continue;
      }
      
      const data = doc.data();
      let fieldValue: string | undefined;
      
      if (fieldName === 'id') {
        fieldValue = doc.id;
      } else {
        fieldValue = data[fieldName];
      }
      
      if (fieldValue && fieldValue.toLowerCase() === normalized) {
        return false; // Not unique
      }
    }
    
    return true; // Unique
  } catch (error) {
    console.error('Field uniqueness check failed:', error);
    return false;
  }
}
