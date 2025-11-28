/**
 * FormDefinition.ts
 * The master schema for a dynamic form.
 */
import { FieldDefinition } from './FieldDefinition';
import { SectionDefinition } from './SectionDefinition';
import { RuleDefinition } from './RuleDefinition';

export interface FormDefinition {
  id: string;
  name: string;
  module: string; // e.g., 'CORE', 'ACCOUNTING'
  version: number;
  
  fields: FieldDefinition[];
  sections: SectionDefinition[];
  rules: RuleDefinition[];
}
