import { randomUUID } from 'crypto';

export interface VendorGroupProps {
  id?: string;
  companyId: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export class VendorGroup {
  readonly id: string;
  readonly companyId: string;
  name: string;
  description?: string;
  status: 'ACTIVE' | 'INACTIVE';
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: VendorGroupProps) {
    if (!props.name?.trim()) {
      throw new Error('VendorGroup name is required');
    }

    this.id = props.id ?? randomUUID();
    this.companyId = props.companyId;
    this.name = props.name.trim();
    this.description = props.description;
    this.status = props.status;
    this.createdBy = props.createdBy;
    this.createdAt = props.createdAt ?? new Date();
    this.updatedAt = props.updatedAt ?? new Date();
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      companyId: this.companyId,
      name: this.name,
      description: this.description ?? null,
      status: this.status,
      createdBy: this.createdBy,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: Record<string, unknown>): VendorGroup {
    return new VendorGroup({
      id: data.id as string,
      companyId: data.companyId as string,
      name: data.name as string,
      description: data.description != null ? (data.description as string) : undefined,
      status: data.status as 'ACTIVE' | 'INACTIVE',
      createdBy: data.createdBy as string,
      createdAt: data.createdAt ? new Date(data.createdAt as string) : undefined,
      updatedAt: data.updatedAt ? new Date(data.updatedAt as string) : undefined,
    });
  }
}
