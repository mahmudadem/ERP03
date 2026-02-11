export interface ReconciliationAdjustment {
  id: string;
  type: 'BANK_FEE' | 'INTEREST' | 'OTHER';
  description: string;
  amount: number;
  currency: string;
  voucherId?: string;
}

export type ReconciliationStatus = 'IN_PROGRESS' | 'COMPLETED';

export class Reconciliation {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly accountId: string,
    public readonly bankStatementId: string,
    public readonly periodEnd: string,
    public readonly bookBalance: number,
    public readonly bankBalance: number,
    public readonly adjustments: ReconciliationAdjustment[] = [],
    public readonly status: ReconciliationStatus = 'IN_PROGRESS',
    public readonly completedAt?: Date,
    public readonly completedBy?: string
  ) {}

  complete(byUser: string, completedAt: Date) {
    return new Reconciliation(
      this.id,
      this.companyId,
      this.accountId,
      this.bankStatementId,
      this.periodEnd,
      this.bookBalance,
      this.bankBalance,
      this.adjustments,
      'COMPLETED',
      completedAt,
      byUser
    );
  }

  withAdjustments(adjustments: ReconciliationAdjustment[]) {
    return new Reconciliation(
      this.id,
      this.companyId,
      this.accountId,
      this.bankStatementId,
      this.periodEnd,
      this.bookBalance,
      this.bankBalance,
      adjustments,
      this.status,
      this.completedAt,
      this.completedBy
    );
  }
}
