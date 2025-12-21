import client from '../../../../api/client';
import { VoucherTypeDefinition } from '../../../../designer-engine/types/VoucherTypeDefinition';

/**
 * Validates that a VoucherTypeDefinition conforms to Canonical Schema V2
 * Throws error if validation fails
 */
function validateSchemaV2(definition: any, context: string): asserts definition is VoucherTypeDefinition {
  const errors: string[] = [];

  // V1: schemaVersion must exist and be 2
  if (typeof definition.schemaVersion !== 'number') {
    errors.push('Missing schemaVersion property');
  } else if (definition.schemaVersion < 2) {
    errors.push(`Legacy schema version ${definition.schemaVersion} not supported (must be 2)`);
  }

  // V2: Required fields must exist
  if (!definition.id || typeof definition.id !== 'string') {
    errors.push('Missing or invalid id');
  }
  if (!definition.companyId || typeof definition.companyId !== 'string') {
    errors.push('Missing or invalid companyId');
  }
  if (!definition.name || typeof definition.name !== 'string') {
    errors.push('Missing or invalid name');
  }
  if (!definition.code || typeof definition.code !== 'string') {
    errors.push('Missing or invalid code');
  }
  if (!definition.module || typeof definition.module !== 'string') {
    errors.push('Missing or invalid module');
  }

  // V3: Arrays must exist
  if (!Array.isArray(definition.headerFields)) {
    errors.push('Missing or invalid headerFields array');
  }
  if (!Array.isArray(definition.tableColumns)) {
    errors.push('Missing or invalid tableColumns array');
  }

  // V4: All headerFields must have isPosting and postingRole
  if (Array.isArray(definition.headerFields)) {
    definition.headerFields.forEach((field: any, index: number) => {
      if (typeof field.isPosting !== 'boolean') {
        errors.push(`headerFields[${index}] missing isPosting property`);
      }
      if (!('postingRole' in field)) {
        errors.push(`headerFields[${index}] missing postingRole property`);
      }
    });
  }

  // V5: Reject legacy fields
  const legacyFields = ['abbreviation', 'color', 'mode', 'status', 'customFields', 'tableFields', 'nameTranslations'];
  legacyFields.forEach(field => {
    if (field in definition) {
      errors.push(`Legacy field '${field}' not allowed in Schema V2`);
    }
  });

  if (errors.length > 0) {
    throw new Error(`Schema V2 validation failed (${context}):\n- ${errors.join('\n- ')}`);
  }
}

export interface IVoucherTypeRepository {
  get(code: string): Promise<VoucherTypeDefinition>;
  create(definition: VoucherTypeDefinition): Promise<VoucherTypeDefinition>;
  update(code: string, definition: VoucherTypeDefinition): Promise<void>;
  list(): Promise<VoucherTypeDefinition[]>;
}

export class VoucherTypeRepository implements IVoucherTypeRepository {
  /**
   * Load Lock: Reject any definition without schemaVersion = 2
   */
  async get(code: string): Promise<VoucherTypeDefinition> {
    const response = await client.get(`/tenant/accounting/designer/voucher-types/${code}`);
    validateSchemaV2(response, `load:${code}`);
    return response;
  }

  /**
   * Save Lock: Enforce schemaVersion = 2 before sending to API
   */
  async create(definition: VoucherTypeDefinition): Promise<VoucherTypeDefinition> {
    // Client-side validation before API call
    const payload = { ...definition, schemaVersion: 2 };
    validateSchemaV2(payload, 'create');
    
    const response = await client.post('/tenant/accounting/designer/voucher-types', payload);
    validateSchemaV2(response, 'create:response');
    return response;
  }

  /**
   * Save Lock: Enforce schemaVersion = 2 before sending to API
   */
  async update(code: string, definition: VoucherTypeDefinition): Promise<void> {
    // Client-side validation before API call
    const payload = { ...definition, schemaVersion: 2 };
    validateSchemaV2(payload, `update:${code}`);
    
    await client.put(`/tenant/accounting/designer/voucher-types/${code}`, payload);
  }

  /**
   * Load Lock: Reject any definitions without schemaVersion = 2
   */
  async list(): Promise<VoucherTypeDefinition[]> {
    const response = await client.get('/tenant/accounting/designer/voucher-types');
    
    if (!Array.isArray(response)) {
      throw new Error('Invalid response: expected array of VoucherTypeDefinitions');
    }

    // Validate each definition, exclude invalid ones
    const validated: VoucherTypeDefinition[] = [];
    const errors: string[] = [];

    response.forEach((def: any, index: number) => {
      try {
        validateSchemaV2(def, `list[${index}]`);
        validated.push(def);
      } catch (error: any) {
        errors.push(`Excluded invalid definition at index ${index}: ${error.message}`);
      }
    });

    if (errors.length > 0) {
      console.warn('[VoucherTypeRepository] Invalid definitions excluded from list:', errors);
    }

    return validated;
  }
}

export const voucherTypeRepository = new VoucherTypeRepository();
