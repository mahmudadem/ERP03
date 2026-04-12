/**
 * Uniqueness Validator
 * 
 * Validates that document name, ID, and prefix are unique within company scope
 */

import { db } from '../../../../config/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

export interface ValidationResult {
  isValid: boolean;
  errors: {
    name?: string;
    id?: string;
    prefix?: string;
  };
}

/**
 * Validate uniqueness of name, ID, and prefix within company
 */
export async function validateUniqueness(
  companyId: string,
  name: string,
  id: string,
  prefix: string,
  excludeDocumentId?: string
): Promise<ValidationResult> {
  const errors: ValidationResult['errors'] = {};
  
  try {
    const documentsRef = collection(db, `companies/${companyId}/documentTypes`);
    const snapshot = await getDocs(documentsRef);
    
    snapshot.forEach(doc => {
      // Skip the document being edited
      if (excludeDocumentId && doc.id === excludeDocumentId) {
        return;
      }
      
      const data = doc.data();
      
      // Check name (case-insensitive)
      if (data.name && data.name.toLowerCase() === name.toLowerCase()) {
        errors.name = 'A document with this name already exists';
      }
      
      // Check ID (case-insensitive)
      if (doc.id && doc.id.toLowerCase() === id.toLowerCase()) {
        errors.id = 'This ID is already in use';
        console.error('[validateUniqueness] ❌ ID CONFLICT:', doc.id, 'matches', id);
      }
      
      // Check prefix (case-insensitive)
      if (data.prefix && data.prefix.toLowerCase() === prefix.toLowerCase()) {
        errors.prefix = 'This prefix is already assigned to another document';
      }
    });
    
    const result = {
      isValid: Object.keys(errors).length === 0,
      errors
    };
    return result;
  } catch (error) {
    console.error('Uniqueness validation failed:', error);
    return {
      isValid: false,
      errors: { name: 'Failed to validate uniqueness. Please try again.' }
    };
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
