/**
 * VoucherTypeDefinition.ts
 * Defines the schema for transactional documents (Invoices, Bills).
 * Combines a Header Form + Line Items Table + Footer Summary.
 */
import { FormDefinition } from './FormDefinition';
import { TableDefinition } from './TableDefinition';
import { FieldDefinition } from './FieldDefinition';

export interface VoucherTypeDefinition {
  id: string;
  name: string;
  code: string; // e.g. 'INV'
  module: 'ACCOUNTING' | 'INVENTORY' | 'POS';

  header: FormDefinition; // The top part (Customer, Date, Due Date)
  lines: TableDefinition; // The middle part (Items grid)
  
  // Footer / Summary fields are typically computed (Subtotal, Tax, Total)
  summaryFields: FieldDefinition[]; 
}
