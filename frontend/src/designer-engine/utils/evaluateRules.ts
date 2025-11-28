/**
 * evaluateRules.ts
 * Logic to determine field visibility and validation based on rules.
 */
import { RuleDefinition, RuleCondition } from '../types/RuleDefinition';

export const checkCondition = (condition: RuleCondition, values: Record<string, any>): boolean => {
  const fieldValue = values[condition.fieldId];
  const targetValue = condition.value;

  switch (condition.operator) {
    case 'EQUALS':
      return fieldValue == targetValue; // Loose equality for numbers/strings
    case 'NOT_EQUALS':
      return fieldValue != targetValue;
    case 'CONTAINS':
      return String(fieldValue || '').includes(String(targetValue));
    case 'IS_EMPTY':
      return fieldValue === null || fieldValue === undefined || fieldValue === '';
    case 'IS_NOT_EMPTY':
      return fieldValue !== null && fieldValue !== undefined && fieldValue !== '';
    case 'GREATER_THAN':
      return Number(fieldValue) > Number(targetValue);
    case 'LESS_THAN':
      return Number(fieldValue) < Number(targetValue);
    default:
      return false;
  }
};

/**
 * Returns a set of Field IDs that should be HIDDEN based on current values.
 */
export const evaluateVisibility = (rules: RuleDefinition[], values: Record<string, any>): Set<string> => {
  const hiddenFields = new Set<string>();

  const visibilityRules = rules.filter(r => r.type === 'VISIBILITY');

  visibilityRules.forEach(rule => {
    let isMatch = false;
    
    // Check match based on AND/OR
    if (rule.matchType === 'AND') {
      isMatch = rule.conditions.every(c => checkCondition(c, values));
    } else {
      isMatch = rule.conditions.some(c => checkCondition(c, values));
    }

    // If rule matches (conditions met), it typically means "Show" or "Hide".
    // Convention: Visibility rules define when to HIDE a field (or show specific ones).
    // For this engine: If conditions MET -> HIDE the field.
    if (isMatch) {
      hiddenFields.add(rule.targetFieldId);
    }
  });

  return hiddenFields;
};
