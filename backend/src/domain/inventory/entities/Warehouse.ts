
export interface WarehouseProps {
  id: string;
  companyId: string;
  name: string;
  code: string;
  parentId?: string | null;
  address?: string;
  active: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class Warehouse {
  readonly id: string;
  readonly companyId: string;
  name: string;
  code: string;
  parentId: string | null;
  address?: string;
  active: boolean;
  isDefault: boolean;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: WarehouseProps) {
    if (!props.id?.trim()) throw new Error('Warehouse id is required');
    if (!props.companyId?.trim()) throw new Error('Warehouse companyId is required');
    if (!props.name?.trim()) throw new Error('Warehouse name is required');
    if (!props.code?.trim()) throw new Error('Warehouse code is required');

    this.id = props.id;
    this.companyId = props.companyId;
    this.name = props.name.trim();
    this.code = props.code.trim();
    this.parentId = props.parentId?.trim() || null;
    this.address = props.address;
    this.active = props.active;
    this.isDefault = props.isDefault;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      name: this.name,
      code: this.code,
      parentId: this.parentId ?? null,
      address: this.address,
      active: this.active,
      isDefault: this.isDefault,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: any): Warehouse {
    return new Warehouse({
      id: data.id,
      companyId: data.companyId,
      name: data.name,
      code: data.code || data.name,
      parentId: data.parentId ?? null,
      address: data.address || data.location,
      active: data.active ?? true,
      isDefault: data.isDefault ?? false,
      createdAt: toDate(data.createdAt || new Date()),
      updatedAt: toDate(data.updatedAt || new Date()),
    });
  }
}
