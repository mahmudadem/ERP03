export type PartyRole = 'VENDOR' | 'CUSTOMER';

export interface PartyProps {
  id: string;
  companyId: string;
  code: string;
  legalName: string;
  displayName: string;
  roles: PartyRole[];
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays?: number;
  defaultCurrency?: string;
  defaultAPAccountId?: string;
  defaultARAccountId?: string;
  active: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const PARTY_ROLES: PartyRole[] = ['VENDOR', 'CUSTOMER'];

const toDate = (value: any): Date => {
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class Party {
  readonly id: string;
  readonly companyId: string;
  code: string;
  legalName: string;
  displayName: string;
  roles: PartyRole[];
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  paymentTermsDays?: number;
  defaultCurrency?: string;
  defaultAPAccountId?: string;
  defaultARAccountId?: string;
  active: boolean;
  readonly createdBy: string;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PartyProps) {
    if (!props.id?.trim()) throw new Error('Party id is required');
    if (!props.companyId?.trim()) throw new Error('Party companyId is required');
    if (!props.code?.trim()) throw new Error('Party code is required');
    if (!props.legalName?.trim()) throw new Error('Party legalName is required');
    if (!props.displayName?.trim()) throw new Error('Party displayName is required');
    if (!props.createdBy?.trim()) throw new Error('Party createdBy is required');

    if (!Array.isArray(props.roles) || props.roles.length === 0) {
      throw new Error('Party roles must contain at least one role');
    }

    const normalizedRoles = props.roles.map((role) => String(role).trim().toUpperCase());
    const invalidRoles = normalizedRoles.filter((role) => !PARTY_ROLES.includes(role as PartyRole));
    if (invalidRoles.length > 0) {
      throw new Error(`Invalid party roles: ${invalidRoles.join(', ')}`);
    }

    this.id = props.id;
    this.companyId = props.companyId;
    this.code = props.code.trim();
    this.legalName = props.legalName.trim();
    this.displayName = props.displayName.trim();
    this.roles = Array.from(new Set(normalizedRoles)) as PartyRole[];
    this.contactPerson = props.contactPerson;
    this.phone = props.phone;
    this.email = props.email;
    this.address = props.address;
    this.taxId = props.taxId;
    this.paymentTermsDays = props.paymentTermsDays;
    this.defaultCurrency = props.defaultCurrency;
    this.defaultAPAccountId = props.defaultAPAccountId;
    this.defaultARAccountId = props.defaultARAccountId;
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
      legalName: this.legalName,
      displayName: this.displayName,
      roles: [...this.roles],
      contactPerson: this.contactPerson,
      phone: this.phone,
      email: this.email,
      address: this.address,
      taxId: this.taxId,
      paymentTermsDays: this.paymentTermsDays,
      defaultCurrency: this.defaultCurrency,
      defaultAPAccountId: this.defaultAPAccountId,
      defaultARAccountId: this.defaultARAccountId,
      active: this.active,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: any): Party {
    return new Party({
      id: data.id,
      companyId: data.companyId,
      code: data.code,
      legalName: data.legalName,
      displayName: data.displayName,
      roles: data.roles || [],
      contactPerson: data.contactPerson,
      phone: data.phone,
      email: data.email,
      address: data.address,
      taxId: data.taxId,
      paymentTermsDays: data.paymentTermsDays,
      defaultCurrency: data.defaultCurrency,
      defaultAPAccountId: data.defaultAPAccountId,
      defaultARAccountId: data.defaultARAccountId,
      active: data.active ?? true,
      createdBy: data.createdBy || 'SYSTEM',
      createdAt: toDate(data.createdAt || new Date()),
      updatedAt: toDate(data.updatedAt || new Date()),
    });
  }
}
