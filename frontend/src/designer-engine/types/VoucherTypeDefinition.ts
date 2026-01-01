/**
 * VoucherTypeDefinition.ts
 * 
 * CANONICAL SCHEMA V2 (matches backend exactly)
 * Source of Truth: backend/src/domain/designer/entities/VoucherTypeDefinition.ts
 * 
 * All voucher type definitions must conform to Schema Version 2:
 * - Every field must have isPosting and postingRole
 * - schemaVersion must be 2
 */
import { FieldDefinition } from './FieldDefinition';
import { PostingRole } from './PostingRole';

export interface TableColumn {
  fieldId: string;
  width?: string;
  labelOverride?: string;
}

/**
 * Canonical VoucherTypeDefinition (Schema Version 2)
 * 
 * This is the ONLY allowed schema for voucher type definitions.
 * Enforced at backend validation layer.
 */
export interface VoucherTypeDefinition {
  // Identity (REQUIRED)
  id: string;
  companyId: string;
  name: string;
  code: string; // Must match VoucherType enum value
  module: string; // 'ACCOUNTING', 'INVENTORY', 'POS'
  
  // Field Definitions (REQUIRED - Schema V2 with classifications)
  headerFields: FieldDefinition[];
  tableColumns: TableColumn[];
  tableStyle?: 'web' | 'classic';
  
  // Layout Configuration (REQUIRED - JSON serialized)
  layout: Record<string, any>;
  
  // Schema Version (REQUIRED - Must be 2)
  schemaVersion: number;
  
  // Posting Validation (OPTIONAL)
  requiredPostingRoles?: PostingRole[];
  
  // Workflow Metadata (OPTIONAL)
  workflow?: any;
  uiModeOverrides?: any;
  isMultiLine?: boolean;
  rules?: any[];
  actions?: any[];
  defaultCurrency?: string;
  prefix?: string;
  nextNumber?: number;
  enabled?: boolean;
  inUse?: boolean;
  isSystemDefault?: boolean;
  metadata?: Record<string, any>;
  createdAt?: Date;
  updatedAt?: Date;
  createdBy?: string;
  updatedBy?: string;
  requiresApproval?: boolean;
  preventNegativeCash?: boolean;
  allowFutureDates?: boolean;
  mandatoryAttachments?: boolean;
  enabledActions?: string[];
  baseType?: string;
}
