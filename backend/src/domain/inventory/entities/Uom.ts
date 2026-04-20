export type UomDimension =
  | 'COUNT'
  | 'WEIGHT'
  | 'VOLUME'
  | 'LENGTH'
  | 'AREA'
  | 'TIME'
  | 'OTHER';

export interface UomProps {
  id: string;
  companyId: string;
  code: string;
  name: string;
  dimension: UomDimension;
  decimalPlaces: number;
  active: boolean;
  isSystem: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const UOM_DIMENSIONS: UomDimension[] = ['COUNT', 'WEIGHT', 'VOLUME', 'LENGTH', 'AREA', 'TIME', 'OTHER'];

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class Uom {
  readonly id: string;
  readonly companyId: string;
  code: string;
  name: string;
  dimension: UomDimension;
  decimalPlaces: number;
  active: boolean;
  isSystem: boolean;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: UomProps) {
    if (!props.id?.trim()) throw new Error('Uom id is required');
    if (!props.companyId?.trim()) throw new Error('Uom companyId is required');
    if (!props.code?.trim()) throw new Error('Uom code is required');
    if (!props.name?.trim()) throw new Error('Uom name is required');
    if (!props.createdBy?.trim()) throw new Error('Uom createdBy is required');
    if (!UOM_DIMENSIONS.includes(props.dimension)) {
      throw new Error(`Invalid Uom dimension: ${props.dimension}`);
    }
    if (!Number.isInteger(props.decimalPlaces) || props.decimalPlaces < 0 || props.decimalPlaces > 6) {
      throw new Error('Uom decimalPlaces must be an integer between 0 and 6');
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.code = props.code.trim().toUpperCase();
    this.name = props.name.trim();
    this.dimension = props.dimension;
    this.decimalPlaces = props.decimalPlaces;
    this.active = props.active;
    this.isSystem = props.isSystem;
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
      dimension: this.dimension,
      decimalPlaces: this.decimalPlaces,
      active: this.active,
      isSystem: this.isSystem,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: any): Uom {
    return new Uom({
      id: data.id,
      companyId: data.companyId,
      code: data.code,
      name: data.name,
      dimension: data.dimension || 'OTHER',
      decimalPlaces: Number.isInteger(data.decimalPlaces) ? data.decimalPlaces : 0,
      active: data.active ?? true,
      isSystem: data.isSystem ?? false,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt || new Date()),
      updatedAt: toDate(data.updatedAt || new Date()),
    });
  }
}
