import { PrintDocumentType, PrintLayoutSchema } from '../../application/system-core/contracts/IPrintLayoutCore';

export interface PrintLayoutTemplateProps {
  id: string;
  companyId: string;
  name: string;
  documentType: PrintDocumentType;
  layout: PrintLayoutSchema;
  isDefault: boolean;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value || Date.now());
};

export class PrintLayoutTemplate {
  readonly id: string;
  readonly companyId: string;
  name: string;
  documentType: PrintDocumentType;
  layout: PrintLayoutSchema;
  isDefault: boolean;
  readonly createdBy: string;
  updatedBy?: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PrintLayoutTemplateProps) {
    if (!props.id?.trim()) throw new Error('Print layout template id is required');
    if (!props.companyId?.trim()) throw new Error('Print layout template companyId is required');
    if (!props.name?.trim()) throw new Error('Print layout template name is required');
    if (!props.documentType?.trim()) throw new Error('Print layout template documentType is required');
    if (!props.createdBy?.trim()) throw new Error('Print layout template createdBy is required');
    this.id = props.id;
    this.companyId = props.companyId;
    this.name = props.name.trim();
    this.documentType = props.documentType;
    this.layout = props.layout;
    this.isDefault = props.isDefault;
    this.createdBy = props.createdBy;
    this.updatedBy = props.updatedBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      name: this.name,
      documentType: this.documentType,
      layout: this.layout,
      isDefault: this.isDefault,
      createdBy: this.createdBy,
      updatedBy: this.updatedBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: any): PrintLayoutTemplate {
    return new PrintLayoutTemplate({
      id: data.id,
      companyId: data.companyId,
      name: data.name,
      documentType: data.documentType,
      layout: data.layout,
      isDefault: data.isDefault === true,
      createdBy: data.createdBy || 'SYSTEM',
      updatedBy: data.updatedBy,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    });
  }
}
