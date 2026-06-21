export interface POSTerminalPolicyProps {
  registerId: string;
  allowDirectSales?: boolean;
}

export interface CashierRolePolicyProps {
  roleId: string;
  requireApprovalForDirectSales?: boolean;
}

export interface POSPolicyProps {
  companyId: string;
  allowPosDirectSales?: boolean;
  terminalPolicies?: POSTerminalPolicyProps[];
  cashierRolePolicies?: CashierRolePolicyProps[];
  createdAt?: Date;
  updatedAt?: Date;
}

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value instanceof Date) return value;
  if (value?.toDate && typeof value.toDate === 'function') return value.toDate();
  return new Date(value);
};

export class POSTerminalPolicy {
  readonly registerId: string;
  readonly allowDirectSales?: boolean;

  constructor(props: POSTerminalPolicyProps) {
    if (!props.registerId?.trim()) throw new Error('POSTerminalPolicy registerId is required');
    this.registerId = props.registerId.trim();
    this.allowDirectSales = props.allowDirectSales === undefined ? undefined : props.allowDirectSales === true;
  }

  toJSON(): POSTerminalPolicyProps {
    return {
      registerId: this.registerId,
      allowDirectSales: this.allowDirectSales,
    };
  }
}

export class CashierRolePolicy {
  readonly roleId: string;
  readonly requireApprovalForDirectSales: boolean;

  constructor(props: CashierRolePolicyProps) {
    if (!props.roleId?.trim()) throw new Error('CashierRolePolicy roleId is required');
    this.roleId = props.roleId.trim();
    this.requireApprovalForDirectSales = props.requireApprovalForDirectSales === true;
  }

  toJSON(): CashierRolePolicyProps {
    return {
      roleId: this.roleId,
      requireApprovalForDirectSales: this.requireApprovalForDirectSales,
    };
  }
}

export class POSPolicy {
  readonly companyId: string;
  allowPosDirectSales: boolean;
  terminalPolicies: POSTerminalPolicy[];
  cashierRolePolicies: CashierRolePolicy[];
  readonly createdAt: Date;
  updatedAt: Date;

  constructor(props: POSPolicyProps) {
    if (!props.companyId?.trim()) throw new Error('POSPolicy companyId is required');
    this.companyId = props.companyId.trim();
    this.allowPosDirectSales = props.allowPosDirectSales === true;
    this.terminalPolicies = (props.terminalPolicies || []).map((policy) => new POSTerminalPolicy(policy));
    this.cashierRolePolicies = (props.cashierRolePolicies || []).map((policy) => new CashierRolePolicy(policy));
    this.createdAt = toDate(props.createdAt);
    this.updatedAt = toDate(props.updatedAt);
  }

  static createDefault(companyId: string): POSPolicy {
    return new POSPolicy({ companyId, allowPosDirectSales: false });
  }

  findTerminalPolicy(registerId?: string): POSTerminalPolicy | undefined {
    if (!registerId) return undefined;
    return this.terminalPolicies.find((policy) => policy.registerId === registerId);
  }

  findCashierRolePolicy(roleId?: string): CashierRolePolicy | undefined {
    if (!roleId) return undefined;
    return this.cashierRolePolicies.find((policy) => policy.roleId === roleId);
  }

  toJSON(): Record<string, any> {
    return {
      companyId: this.companyId,
      allowPosDirectSales: this.allowPosDirectSales,
      terminalPolicies: this.terminalPolicies.map((policy) => policy.toJSON()),
      cashierRolePolicies: this.cashierRolePolicies.map((policy) => policy.toJSON()),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  static fromJSON(data: any): POSPolicy {
    return new POSPolicy({
      companyId: data.companyId,
      allowPosDirectSales: data.allowPosDirectSales === true,
      terminalPolicies: Array.isArray(data.terminalPolicies) ? data.terminalPolicies : [],
      cashierRolePolicies: Array.isArray(data.cashierRolePolicies) ? data.cashierRolePolicies : [],
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    });
  }
}