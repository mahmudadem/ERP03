/**
 * validateForm.ts
 * Validates a form against its definition (Required, Min, Max, Regex).
 */
import { FormDefinition } from '../types/FormDefinition';

export interface ValidationErrors {
  [fieldId: string]: string;
}

export const validateForm = (
  definition: FormDefinition, 
  values: Record<string, any>
): ValidationErrors => {
  const errors: ValidationErrors = {};

  definition.fields.forEach(field => {
    const value = values[field.name];

    // 1. Required Check
    if (field.required) {
      if (value === null || value === undefined || value === '') {
        errors[field.name] = `${field.label} is required`;
        return;
      }
    }

    // Skip other validations if empty and not required
    if (value === null || value === undefined || value === '') return;

    // 2. Number Checks
    if (field.type === 'NUMBER') {
      if (field.min !== undefined && Number(value) < field.min) {
        errors[field.name] = `Value must be at least ${field.min}`;
      }
      if (field.max !== undefined && Number(value) > field.max) {
        errors[field.name] = `Value must be at most ${field.max}`;
      }
    }

    // 3. Pattern Check
    if (field.pattern) {
      const regex = new RegExp(field.pattern);
      if (!regex.test(String(value))) {
        errors[field.name] = `Invalid format`;
      }
    }
  });

  return errors;
};
