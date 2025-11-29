import { ModuleSettingsDefinition, ModuleSettingField } from '../../domain/system/ModuleSettingsDefinition';

export class ModuleSettingsValidator {
  static validate(definition: ModuleSettingsDefinition, payload: Record<string, any>) {
    const errors: string[] = [];
    const result: Record<string, any> = {};

    const checkField = (field: ModuleSettingField, value: any) => {
      if (value === undefined || value === null || value === '') {
        if (field.required) errors.push(`Field ${field.id} is required`);
        return;
      }
      switch (field.type) {
        case 'text':
          result[field.id] = String(value);
          break;
        case 'number':
          if (isNaN(Number(value))) errors.push(`Field ${field.id} must be a number`);
          else result[field.id] = Number(value);
          break;
        case 'boolean':
          result[field.id] = Boolean(value);
          break;
        case 'date':
          result[field.id] = new Date(value).toISOString();
          break;
        case 'select':
          result[field.id] = value;
          break;
        case 'multi-select':
          result[field.id] = Array.isArray(value) ? value : [value];
          break;
        default:
          result[field.id] = value;
      }
    };

    definition.fields.forEach((field) => {
      const val = payload[field.id] !== undefined ? payload[field.id] : field.default;
      checkField(field, val);
    });

    if (errors.length > 0) {
      const err = new Error(errors.join(', '));
      (err as any).errors = errors;
      throw err;
    }

    return result;
  }
}
