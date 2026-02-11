export type BudgetStatus = 'DRAFT' | 'APPROVED' | 'CLOSED';

export interface BudgetLine {
  accountId: string;
  costCenterId?: string;
  monthlyAmounts: number[]; // length 12
  annualTotal: number;
}

export class Budget {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly fiscalYearId: string,
    public readonly name: string,
    public readonly version: number,
    public readonly status: BudgetStatus,
    public readonly lines: BudgetLine[],
    public readonly createdAt: Date,
    public readonly createdBy: string,
    public readonly updatedAt?: Date,
    public readonly updatedBy?: string
  ) {
    if (!lines || lines.length === 0) {
      throw new Error('Budget must contain at least one line');
    }
    lines.forEach((l, idx) => {
      if (!Array.isArray(l.monthlyAmounts) || l.monthlyAmounts.length !== 12) {
        throw new Error(`Line ${idx + 1} must have 12 monthly amounts`);
      }
      const total = l.monthlyAmounts.reduce((s, v) => s + (Number(v) || 0), 0);
      if (Math.abs(total - l.annualTotal) > 0.0001) {
        throw new Error(`Line ${idx + 1} annualTotal does not match sum of monthly amounts`);
      }
    });
  }

  approve(by: string, at: Date) {
    return new Budget(
      this.id,
      this.companyId,
      this.fiscalYearId,
      this.name,
      this.version,
      'APPROVED',
      this.lines,
      this.createdAt,
      this.createdBy,
      at,
      by
    );
  }

  close(by: string, at: Date) {
    return new Budget(
      this.id,
      this.companyId,
      this.fiscalYearId,
      this.name,
      this.version,
      'CLOSED',
      this.lines,
      this.createdAt,
      this.createdBy,
      at,
      by
    );
  }
}
