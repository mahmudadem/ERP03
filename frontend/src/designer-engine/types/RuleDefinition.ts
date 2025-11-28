/**
 * RuleDefinition.ts
 * Defines logic for dynamic behavior in forms.
 */

export type RuleType = 'VISIBILITY' | 'VALIDATION' | 'COMPUTED';
export type RuleOperator = 'EQUALS' | 'NOT_EQUALS' | 'CONTAINS' | 'GREATER_THAN' | 'LESS_THAN' | 'IS_EMPTY' | 'IS_NOT_EMPTY';

export interface RuleDefinition {
  id: string;
  type: RuleType;
  targetFieldId: string; // The field this rule affects
  errorMessage?: string; // For validation rules
  
  // Logic
  conditions: RuleCondition[];
  matchType: 'AND' | 'OR'; // If multiple conditions exist
}

export interface RuleCondition {
  fieldId: string; // The field to check
  operator: RuleOperator;
  value?: any; // The value to compare against
}
