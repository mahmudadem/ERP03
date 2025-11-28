/**
 * TableDefinition.ts
 * Defines the structure for line items (e.g., Invoice Items).
 */
import { FieldDefinition } from './FieldDefinition';

export interface TableDefinition {
  id: string;
  name: string; // Data key (e.g., 'items')
  columns: FieldDefinition[]; // Fields that act as columns
  
  // UI Configuration
  addRowLabel?: string;
  removeRowLabel?: string;
  minRows?: number;
  maxRows?: number;
}
