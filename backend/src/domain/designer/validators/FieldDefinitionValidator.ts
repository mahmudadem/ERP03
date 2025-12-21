import { FieldDefinition } from '../entities/FieldDefinition';
import { PostingRole } from '../entities/PostingRole';

/**
 * FieldDefinitionValidator
 * 
 * Validates that FieldDefinition complies with Schema Version 2 requirements.
 * Enforces posting vs non-posting field classification.
 */
export class FieldDefinitionValidator {
  /**
   * Validates a single FieldDefinition
   * @throws Error with specific validation message
   */
  static validate(field: FieldDefinition): void {
    // V1: isPosting must exist and be boolean
    if (typeof field.isPosting !== 'boolean') {
      throw new Error(`Field '${field.id}' missing required 'isPosting' property`);
    }

    // V2: postingRole property must exist
    if (!('postingRole' in (field as any))) {
      throw new Error(`Field '${(field as any).id}' missing required 'postingRole' property`);
    }

    // V3: If isPosting = true, postingRole must not be null
    if (field.isPosting && field.postingRole === null) {
      throw new Error(`Posting field '${field.id}' requires a valid postingRole`);
    }

    // V4: If isPosting = false, postingRole must be null
    if (!field.isPosting && field.postingRole !== null) {
      throw new Error(`Non-posting field '${field.id}' cannot have postingRole`);
    }

    // V5: postingRole must be valid enum value or null
    if (field.postingRole !== null && !Object.values(PostingRole).includes(field.postingRole)) {
      throw new Error(`Invalid postingRole '${field.postingRole}' for field '${field.id}'`);
    }
  }

  /**
   * Validates an array of FieldDefinitions
   * @throws Error on first validation failure
   */
  static validateAll(fields: FieldDefinition[]): void {
    for (const field of fields) {
      this.validate(field);
    }
  }
}
