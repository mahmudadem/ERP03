/**
 * PosRegister — A Point-of-Sale terminal/till definition.
 *
 * Links a physical register to a branch (free-string id), a warehouse
 * (the inventory source for sales posted from this till), and a cash
 * drawer GL account (the settlement side of cash sales).
 */
export type PosRegisterStatus = 'ACTIVE' | 'INACTIVE';
export type PosRegisterPaymentMethodCode = 'CASH' | 'CARD' | 'BANK_TRANSFER' | 'CUSTOM';
export type PosRegisterSettlementAccounts = Partial<Record<PosRegisterPaymentMethodCode, string>>;

export interface PosRegisterProps {
  id: string;
  companyId: string;
  code: string;
  name: string;
  branchId?: string;
  warehouseId: string;
  cashDrawerAccountId: string;
  settlementAccountIds?: PosRegisterSettlementAccounts;
  status: PosRegisterStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class PosRegister {
  readonly id: string;
  readonly companyId: string;
  code: string;
  name: string;
  branchId?: string;
  warehouseId: string;
  cashDrawerAccountId: string;
  settlementAccountIds: PosRegisterSettlementAccounts;
  status: PosRegisterStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: PosRegisterProps) {
    if (!props.id?.trim()) throw new Error('PosRegister id is required');
    if (!props.companyId?.trim()) throw new Error('PosRegister companyId is required');
    if (!props.code?.trim()) throw new Error('PosRegister code is required');
    if (!props.name?.trim()) throw new Error('PosRegister name is required');
    if (!props.warehouseId?.trim()) throw new Error('PosRegister warehouseId is required');
    if (!props.cashDrawerAccountId?.trim()) throw new Error('PosRegister cashDrawerAccountId is required');
    const status: PosRegisterStatus = props.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.id = props.id;
    this.companyId = props.companyId;
    this.code = props.code;
    this.name = props.name;
    this.branchId = props.branchId?.trim() || undefined;
    this.warehouseId = props.warehouseId;
    this.cashDrawerAccountId = props.cashDrawerAccountId;
    this.settlementAccountIds = Object.fromEntries(
      Object.entries(props.settlementAccountIds || {})
        .map(([method, accountId]) => [method, String(accountId || '').trim()])
        .filter(([, accountId]) => !!accountId)
    ) as PosRegisterSettlementAccounts;
    this.status = status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  toJSON(): Record<string, any> {
    return {
      id: this.id,
      companyId: this.companyId,
      code: this.code,
      name: this.name,
      branchId: this.branchId,
      warehouseId: this.warehouseId,
      cashDrawerAccountId: this.cashDrawerAccountId,
      settlementAccountIds: this.settlementAccountIds,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static fromJSON(data: any): PosRegister {
    return new PosRegister({
      id: data.id,
      companyId: data.companyId,
      code: data.code,
      name: data.name,
      branchId: data.branchId,
      warehouseId: data.warehouseId,
      cashDrawerAccountId: data.cashDrawerAccountId,
      settlementAccountIds: data.settlementAccountIds,
      status: data.status,
      createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
      updatedAt: data.updatedAt ? new Date(data.updatedAt) : new Date(),
    });
  }
}
