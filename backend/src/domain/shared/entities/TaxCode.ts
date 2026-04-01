export type TaxType = 'VAT' | 'GST' | 'EXEMPT' | 'ZERO_RATED';
export type TaxScope = 'PURCHASE' | 'SALES' | 'BOTH';

export interface TaxCodeProps {
  id: string;
  companyId: string;
  code: string;
  name: string;
  rate: number;
  taxType: TaxType;
  scope: TaxScope;
  purchaseTaxAccountId?: string;
  salesTaxAccountId?: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const TAX_TYPES: TaxType[] = ['VAT', 'GST', 'EXEMPT', 'ZERO_RATED'];
const TAX_SCOPES: TaxScope[] = ['PURCHASE', 'SALES', 'BOTH'];

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class TaxCode {
  readonly id: string;
  readonly companyId: string;
  code: string;
  name: string;
  rate: number;
  taxType: TaxType;
  scope: TaxScope;
  purchaseTaxAccountId?: string;
  salesTaxAccountId?: string;
  active: boolean;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: TaxCodeProps) {
    if (!props.id?.trim()) throw new Error('TaxCode id is required');
    if (!props.companyId?.trim()) throw new Error('TaxCode companyId is required');
    if (!props.code?.trim()) throw new Error('TaxCode code is required');
    if (!props.name?.trim()) throw new Error('TaxCode name is required');
    if (!props.createdBy?.trim()) throw new Error('TaxCode createdBy is required');
    if (!TAX_TYPES.includes(props.taxType)) throw new Error(`Invalid taxType: ${props.taxType}`);
    if (!TAX_SCOPES.includes(props.scope)) throw new Error(`Invalid scope: ${props.scope}`);
    if (Number.isNaN(props.rate) || props.rate < 0) {
      throw new Error('TaxCode rate must be greater than or equal to 0');
    }
    if ((props.taxType === 'EXEMPT' || props.taxType === 'ZERO_RATED') && props.rate !== 0) {
      throw new Error(`TaxCode rate must be 0 when taxType is ${props.taxType}`);
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.code = props.code.trim();
    this.name = props.name.trim();
    this.rate = props.rate;
    this.taxType = props.taxType;
    this.scope = props.scope;
    this.purchaseTaxAccountId = props.purchaseTaxAccountId;
    this.salesTaxAccountId = props.salesTaxAccountId;
    this.active = props.active;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      code: this.code,
      name: this.name,
      rate: this.rate,
      taxType: this.taxType,
      scope: this.scope,
      purchaseTaxAccountId: this.purchaseTaxAccountId,
      salesTaxAccountId: this.salesTaxAccountId,
      active: this.active,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: any): TaxCode {
    return new TaxCode({
      id: data.id,
      companyId: data.companyId,
      code: data.code,
      name: data.name,
      rate: data.rate ?? 0,
      taxType: data.taxType,
      scope: data.scope,
      purchaseTaxAccountId: data.purchaseTaxAccountId,
      salesTaxAccountId: data.salesTaxAccountId,
      active: data.active ?? true,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt || new Date()),
      updatedAt: toDate(data.updatedAt || new Date()),
    });
  }
}
