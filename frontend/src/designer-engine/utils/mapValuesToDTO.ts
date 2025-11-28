/**
 * mapValuesToDTO.ts
 * Converts raw form state (strings, etc) into typed DTOs ready for the API.
 */
import { FieldDefinition } from '../types/FieldDefinition';

export const mapValuesToDTO = (fields: FieldDefinition[], values: Record<string, any>) => {
  const dto: Record<string, any> = {};

  fields.forEach(field => {
    const rawValue = values[field.name];

    if (rawValue === undefined || rawValue === '') {
      dto[field.name] = null;
      return;
    }

    switch (field.type) {
      case 'NUMBER':
        dto[field.name] = Number(rawValue);
        break;
      case 'CHECKBOX':
        dto[field.name] = Boolean(rawValue);
        break;
      case 'DATE':
        dto[field.name] = new Date(rawValue).toISOString();
        break;
      default:
        dto[field.name] = rawValue;
    }
  });

  return dto;
};
