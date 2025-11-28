
export type FieldType = 'STRING' | 'NUMBER' | 'DATE' | 'BOOLEAN' | 'SELECT' | 'REFERENCE';

export interface ValidationRule {
  type: 'REQUIRED' | 'MIN' | 'MAX' | 'REGEX';
  value?: any;
  message: string;
}

export interface VisibilityRule {
  field: string;
  operator: 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS';
  value: any;
}

export class FieldDefinition {
  constructor(
    public id: string,
    public name: string,
    public label: string,
    public type: FieldType,
    public required: boolean,
    public readOnly: boolean,
    public visibilityRules: VisibilityRule[] = [],
    public validationRules: ValidationRule[] = [],
    public defaultValue?: any
  ) {}
}
