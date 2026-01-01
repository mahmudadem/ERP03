import { VoucherTypeDefinition } from '../../designer/entities/VoucherTypeDefinition';
import { PostingRole } from '../../designer/entities/PostingRole';

/**
 * PostingFieldExtractor
 * 
 * Security layer that filters voucher data to include ONLY posting fields.
 * Prevents PostingStrategies from accidentally reading non-posting metadata.
 */
export class PostingFieldExtractor {
  /**
   * Extracts only posting fields from header data
   * @param header Raw header data from user input
   * @param definition Voucher type definition with field classifications
   * @returns Filtered object containing only posting fields
   * @throws Error if required posting fields are missing
   */
  static extractPostingFields(header: any, definition: VoucherTypeDefinition): any {
    const postingFields: any = {};
    
    // Collect all posting field IDs
    const postingFieldIds = new Set<string>();
    const requiredFields = new Map<string, PostingRole>();
    
    for (const field of definition.headerFields) {
      if (field.isPosting && field.postingRole) {
        postingFieldIds.add(field.id);
        if (field.required) {
          requiredFields.set(field.id, field.postingRole);
        }
      }
    }
    
    // V10: Validate all required posting fields are present
    for (const [fieldId, role] of requiredFields.entries()) {
      if (!(fieldId in header) || header[fieldId] === null || header[fieldId] === undefined) {
        throw new Error(`Required posting field '${fieldId}' (${role}) not provided`);
      }
    }
    
    // Filter: copy only posting fields to result
    for (const [key, value] of Object.entries(header)) {
      if (postingFieldIds.has(key)) {
        postingFields[key] = value;
      }
    }
    
    return postingFields;
  }

  /**
   * Extracts posting fields from line items
   * @param lines Array of line items
   * @param definition Voucher type definition
   * @returns Filtered array with only posting fields per line
   */
  static extractPostingFieldsFromLines(lines: any[], definition: VoucherTypeDefinition): any[] {
    // For line items, field definitions come from table structure
    // This is a simplified version - extend based on your line field definitions
    return lines.map(line => {
      const filtered: any = {};
      // V2 Posting Fields (canonical for all line-based vouchers)
      const postingFieldKeys = ['accountId', 'side', 'amount', 'baseAmount', 
                                'currency', 'lineCurrency', 'exchangeRate', 'description', 'notes'];
      
      for (const key of postingFieldKeys) {
        if (key in line) {
          filtered[key] = line[key];
        }
      }
      
      return filtered;
    });
  }
}
