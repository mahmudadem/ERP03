export enum FiscalYearStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  LOCKED = 'LOCKED',
}

export enum PeriodStatus {
  OPEN = 'OPEN',
  CLOSED = 'CLOSED',
  LOCKED = 'LOCKED',
}

export interface FiscalPeriod {
  id: string; // e.g., "2026-01"
  name: string; // e.g., "January 2026"
  startDate: string; // "2026-01-01"
  endDate: string; // "2026-01-31"
  status: PeriodStatus;
  closedAt?: Date;
  closedBy?: string;
  lockedAt?: Date;
  lockedBy?: string;
}

/**
 * Fiscal Year aggregate to manage period-based posting control and year-end closing.
 */
export class FiscalYear {
  constructor(
    public readonly id: string, // e.g., "FY2026"
    public readonly companyId: string,
    public readonly name: string,
    public readonly startDate: string,
    public readonly endDate: string,
    public readonly status: FiscalYearStatus,
    public readonly periods: FiscalPeriod[],
    public readonly closingVoucherId?: string,
    public readonly createdAt?: Date,
    public readonly createdBy?: string
  ) {}

  /**
   * Get period that contains the given ISO date.
   */
  getPeriodForDate(dateIso: string): FiscalPeriod | undefined {
    const ts = new Date(dateIso).getTime();
    if (Number.isNaN(ts)) return undefined;
    return this.periods.find((p) => {
      const start = new Date(p.startDate).getTime();
      const end = new Date(p.endDate).getTime();
      return ts >= start && ts <= end;
    });
  }

  /**
   * Returns true if the date falls in an OPEN period.
   */
  isDatePostable(dateIso: string): boolean {
    const period = this.getPeriodForDate(dateIso);
    if (!period) return false;
    return period.status === PeriodStatus.OPEN;
  }

  /**
   * Close a specific period; returns a new FiscalYear instance with updated period.
   */
  closePeriod(periodId: string, closedBy: string): FiscalYear {
    const updated = this.periods.map((p) =>
      p.id === periodId
        ? {
            ...p,
            status: PeriodStatus.CLOSED,
            closedAt: new Date(),
            closedBy,
          }
        : p
    );
    return new FiscalYear(
      this.id,
      this.companyId,
      this.name,
      this.startDate,
      this.endDate,
      this.status,
      updated,
      this.closingVoucherId,
      this.createdAt,
      this.createdBy
    );
  }

  /**
   * Reopen a closed (not locked) period.
   */
  reopenPeriod(periodId: string): FiscalYear {
    const updated = this.periods.map((p) =>
      p.id === periodId && p.status !== PeriodStatus.LOCKED
        ? { ...p, status: PeriodStatus.OPEN, closedAt: undefined, closedBy: undefined }
        : p
    );
    return new FiscalYear(
      this.id,
      this.companyId,
      this.name,
      this.startDate,
      this.endDate,
      this.status,
      updated,
      this.closingVoucherId,
      this.createdAt,
      this.createdBy
    );
  }

  /**
   * Close the fiscal year (all periods should be closed already).
   */
  closeYear(closedBy: string, closingVoucherId: string): FiscalYear {
    return new FiscalYear(
      this.id,
      this.companyId,
      this.name,
      this.startDate,
      this.endDate,
      FiscalYearStatus.CLOSED,
      this.periods,
      closingVoucherId,
      this.createdAt,
      closedBy
    );
  }
}
