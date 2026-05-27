import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

export interface CustomerGroupProps {
  id?: string;
  companyId: string;
  name: string;
  description?: string;
  defaultPriceListId?: string;
  defaultPaymentTermsDays?: number;
  defaultCreditLimit?: number;
  taxExempt?: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export class CustomerGroup {
  readonly id: string;
  readonly companyId: string;
  name: string;
  description?: string;
  defaultPriceListId?: string;
  defaultPaymentTermsDays?: number;
  defaultCreditLimit?: number;
  taxExempt: boolean;
  status: 'ACTIVE' | 'INACTIVE';
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: CustomerGroupProps) {
    // --- required field validation ---
    if (!props.name?.trim()) {
      throw new Error('CustomerGroup name is required');
    }

    // --- numeric range validations ---
    if (
      props.defaultPaymentTermsDays !== undefined &&
      props.defaultPaymentTermsDays < 0
    ) {
      throw new Error('CustomerGroup defaultPaymentTermsDays must be >= 0');
    }
    if (
      props.defaultCreditLimit !== undefined &&
      props.defaultCreditLimit < 0
    ) {
      throw new Error('CustomerGroup defaultCreditLimit must be >= 0');
    }

    this.id = props.id ?? randomUUID();
    this.companyId = props.companyId;
    this.name = props.name.trim();
    this.description = props.description;
    this.defaultPriceListId = props.defaultPriceListId;
    this.defaultPaymentTermsDays = props.defaultPaymentTermsDays;
    this.defaultCreditLimit = props.defaultCreditLimit;
    this.taxExempt = props.taxExempt ?? false;
    this.status = props.status;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  // -------------------------------------------------------------------------
  // Serialisation
  // -------------------------------------------------------------------------

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      name: this.name,
      description: this.description ?? null,
      defaultPriceListId: this.defaultPriceListId ?? null,
      defaultPaymentTermsDays: this.defaultPaymentTermsDays ?? null,
      defaultCreditLimit: this.defaultCreditLimit ?? null,
      taxExempt: this.taxExempt,
      status: this.status,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): CustomerGroup {
    return new CustomerGroup({
      id: data.id as string,
      companyId: data.companyId as string,
      name: data.name as string,
      description: data.description != null ? (data.description as string) : undefined,
      defaultPriceListId: data.defaultPriceListId != null ? (data.defaultPriceListId as string) : undefined,
      defaultPaymentTermsDays: data.defaultPaymentTermsDays != null
        ? (data.defaultPaymentTermsDays as number)
        : undefined,
      defaultCreditLimit: data.defaultCreditLimit != null
        ? (data.defaultCreditLimit as number)
        : undefined,
      taxExempt: Boolean(data.taxExempt),
      status: data.status as 'ACTIVE' | 'INACTIVE',
      createdBy: data.createdBy as string,
      createdAt: data.createdAt ? new Date(data.createdAt as string) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt as string) : undefined,
    });
  }
}
