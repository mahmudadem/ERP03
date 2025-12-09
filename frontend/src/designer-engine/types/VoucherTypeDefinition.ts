/**
 * VoucherTypeDefinition.ts
 * Defines the schema for transactional documents (Invoices, Bills).
 * Combines a Header Form + Line Items Table + Footer Summary.
 */
import { FormDefinition } from './FormDefinition';
import { TableDefinition } from './TableDefinition';
import { FieldDefinition } from './FieldDefinition';

export interface VoucherTypeDefinition {
  id?: string;
  companyId?: string;
  
  // Identity
  name: string; // Keeping name for backward comp. Prompt suggests translations but simple name is standard for now.
  nameTranslations?: Record<string, string>;
  code: string;
  abbreviation: string;
  color: string;
  
  // Configuration
  mode: 'single-line' | 'multi-line';
  
  // UI Metadata
  headerFields: FieldDefinition[];
  tableFields: any[]; // Formerly tableColumns
  layout: Record<string, any>;
  customFields?: any[]; // [{ key: string, type: string, label: any }]
  
  // Status
  status?: 'ACTIVE' | 'DRAFT';
}

// Removed VoucherActions interface entirely
