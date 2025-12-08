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
  companyId?: string;
  name: string;
  code: string; // e.g. 'INV'
  module: 'ACCOUNTING' | 'INVENTORY' | 'POS';

  // Backend structure
  headerFields: FieldDefinition[];
  tableColumns: any[]; // TableColumn[]
  layout: Record<string, any>;
  workflow?: any;

  // Deprecated / Computed on frontend?
  header?: FormDefinition; 
  lines?: TableDefinition; 
  summaryFields?: FieldDefinition[]; 
}
