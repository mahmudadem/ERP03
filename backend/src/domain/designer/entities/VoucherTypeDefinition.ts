
import { FieldDefinition } from './FieldDefinition';

export interface TableColumn {
  fieldId: string;
  width?: string;
}

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
    public workflow?: any // Workflow metadata
  ) {}
}
