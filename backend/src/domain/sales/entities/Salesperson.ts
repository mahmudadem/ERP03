import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Value types
// ---------------------------------------------------------------------------

export interface SalespersonProps {
  id?: string;
  companyId: string;
  code: string;
  name: string;
  email?: string;
  defaultCommissionPct: number;
  commissionPayableAccountId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// ---------------------------------------------------------------------------
// Entity
// ---------------------------------------------------------------------------

export class Salesperson {
  readonly id: string;
  readonly companyId: string;
  code: string;
  name: string;
  email?: string;
  defaultCommissionPct: number;
  commissionPayableAccountId?: string;
  status: 'ACTIVE' | 'INACTIVE';
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: SalespersonProps) {
    // --- required field validation ---
    if (!props.code?.trim()) {
      throw new Error('Salesperson code is required');
    }
    if (!props.name?.trim()) {
      throw new Error('Salesperson name is required');
    }

    // --- range validation ---
    if (
      props.defaultCommissionPct < 0 ||
      props.defaultCommissionPct > 100 ||
      Number.isNaN(props.defaultCommissionPct)
    ) {
      throw new Error('Salesperson defaultCommissionPct must be between 0 and 100 inclusive');
    }

    this.id = props.id ?? randomUUID();
    this.companyId = props.companyId;
    this.code = props.code.trim();
    this.name = props.name.trim();
    this.email = props.email;
    this.defaultCommissionPct = props.defaultCommissionPct;
    this.commissionPayableAccountId = props.commissionPayableAccountId;
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
      code: this.code,
      name: this.name,
      email: this.email ?? null,
      defaultCommissionPct: this.defaultCommissionPct,
      commissionPayableAccountId: this.commissionPayableAccountId ?? null,
      status: this.status,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): Salesperson {
    return new Salesperson({
      id: data.id as string,
      companyId: data.companyId as string,
      code: data.code as string,
      name: data.name as string,
      email: data.email != null ? (data.email as string) : undefined,
      defaultCommissionPct: data.defaultCommissionPct as number,
      commissionPayableAccountId:
        data.commissionPayableAccountId != null
          ? (data.commissionPayableAccountId as string)
          : undefined,
      status: data.status as 'ACTIVE' | 'INACTIVE',
      createdBy: data.createdBy as string,
      createdAt: data.createdAt ? new Date(data.createdAt as string) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt as string) : undefined,
    });
  }
}
