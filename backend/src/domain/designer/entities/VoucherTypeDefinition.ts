
import { FieldDefinition } from './FieldDefinition';
import { PostingRole } from './PostingRole';

export interface TableColumn {
  fieldId: string;
  width?: string;
  labelOverride?: string;
  type?: string;
  required?: boolean;
  mandatory?: boolean;
  readOnly?: boolean;
  calculated?: boolean;
  autoManaged?: boolean;
  options?: Array<{ value: string | number; label: string }>;
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
    public layout: Record<string, any>,
    public schemaVersion: number = 2,
    public requiredPostingRoles?: PostingRole[],
    public workflow?: any,
    public uiModeOverrides?: any,
    public isMultiLine?: boolean,
    public rules?: any[],
    public actions?: any[],
    public defaultCurrency?: string,
    public voucherType?: string,
    public persona?: string,
    /**
     * Sidebar group label this voucher type's default form should land under
     * (e.g. "Documents", "Vouchers"). When null/undefined the form is rendered
     * as a top-level sidebar entry. Propagates to VoucherFormDefinition at copy.
     */
    public sidebarGroup?: string
  ) {}
}
