
import { FieldDefinition } from './FieldDefinition';
import { PostingRole } from './PostingRole';

export interface TableColumn {
  fieldId: string;
  width?: string;
}

/**
 * VoucherTypeDefinition
 * 
 * Defines a voucher type with explicit field classification.
 * Schema Version 2: All fields must be classified as posting or non-posting.
 */
export class VoucherTypeDefinition {
  constructor(
    public id: string,
    public companyId: string,
    public name: string,
    public code: string,
    public module: string,
    public headerFields: FieldDefinition[],
    public tableColumns: TableColumn[],
    public layout: Record<string, any>, // JSON layout config
    public schemaVersion: number = 2,
    public requiredPostingRoles?: PostingRole[],
    public workflow?: any // Workflow metadata
  ) {}
}
