import { BusinessError } from '../../../errors/AppError';
import { ErrorCode } from '../../../errors/ErrorCodes';

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

export enum PeriodScheme {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
}

export interface FiscalPeriod {
  id: string; // e.g., "2026-01" or "FY2026-P01"
  name: string; // e.g., "January 2026"
  startDate: string; // "2026-01-01"
  endDate: string; // "2026-01-31"
  status: PeriodStatus;
  closedAt?: Date;
  closedBy?: string;
  lockedAt?: Date;
  lockedBy?: string;
  metadata?: Record<string, any>;
  periodNo: number; // 1..12 or 13..16
  isSpecial: boolean;
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
    public readonly createdBy?: string,
    public readonly periodScheme: PeriodScheme = PeriodScheme.MONTHLY,
    public readonly specialPeriodsCount: number = 0
  ) {}

  /**
   * Get period that contains the given ISO date or matches the specific postingPeriodNo.
   * 
   * @param dateIso The voucher date
   * @param postingPeriodNo Optional override for special periods (13..16)
   */
  getPeriodForDate(dateIso: string, postingPeriodNo?: number): FiscalPeriod | undefined {
    // 1. If postingPeriodNo is provided, prioritize it
    if (postingPeriodNo !== undefined && postingPeriodNo !== null) {
      // Find period by number
      const targetPeriod = this.periods.find(p => p.periodNo === postingPeriodNo);
      
      if (!targetPeriod) return undefined; // Period not found in this FY
      
      // Validation for Special Periods (13..16)
      if (targetPeriod.isSpecial) {
        // MUST fall on the last day of the fiscal year
        // MUST fall on the last day of the fiscal year
        if (dateIso !== this.endDate) {
           throw new BusinessError(
             ErrorCode.INVALID_SPECIAL_PERIOD_USAGE,
             'Special Period can only be used on the fiscal year end date.',
             {
               postingPeriodNo,
               dateIso,
               fyEndDate: this.endDate,
               specialPeriodsCount: this.specialPeriodsCount
             }
           );
        }
      }
      
      return targetPeriod;
    }

    // 2. Default Date-Based Resolution
    const ts = new Date(dateIso).getTime();
    if (Number.isNaN(ts)) return undefined;
    
    // Filter matching date ranges
    const matching = this.periods.filter((p) => {
      const start = new Date(p.startDate).getTime();
      const end = new Date(p.endDate).getTime();
      return ts >= start && ts <= end;
    });

    if (matching.length === 0) return undefined;
    
    // If overlaps exist (e.g. Regular P12 vs Special P13 on last day),
    // and NO override was provided, we MUST return the REGULAR period.
    // Special periods require explicit opt-in via postingPeriodNo.
    return matching.find(p => !p.isSpecial) || matching[0];
  }

  /**
   * Returns true if the date falls in an OPEN period.
   */
  isDatePostable(dateIso: string, postingPeriodNo?: number): boolean {
    const period = this.getPeriodForDate(dateIso, postingPeriodNo);
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
      this.createdBy,
      this.periodScheme,
      this.specialPeriodsCount
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
      this.createdBy,
      this.periodScheme,
      this.specialPeriodsCount
    );
  }

  /**
   * Close the fiscal year (all periods should be closed already).
   */
  /**
   * Close the fiscal year (all periods should be closed already).
   */
  closeYear(closedBy: string, closingVoucherId: string): FiscalYear {
    const now = new Date();
    const updatedPeriods = this.periods.map(p => ({
      ...p,
      status: p.status === PeriodStatus.OPEN ? PeriodStatus.CLOSED : p.status,
      closedBy: p.status === PeriodStatus.OPEN ? closedBy : p.closedBy,
      closedAt: p.status === PeriodStatus.OPEN ? now : p.closedAt
    }));

    return new FiscalYear(
      this.id,
      this.companyId,
      this.name,
      this.startDate,
      this.endDate,
      FiscalYearStatus.CLOSED,
      updatedPeriods,
      closingVoucherId,
      this.createdAt,
      closedBy,
      this.periodScheme,
      this.specialPeriodsCount
    );
  }

  /**
   * Reopen a closed fiscal year.
   */
  reopenYear(): FiscalYear {
    if (this.status === FiscalYearStatus.LOCKED) {
      throw new Error('Cannot reopen a LOCKED fiscal year.');
    }
    return new FiscalYear(
      this.id,
      this.companyId,
      this.name,
      this.startDate,
      this.endDate,
      FiscalYearStatus.OPEN,
      this.periods,
      undefined, // Clear closing voucher reference
      this.createdAt,
      this.createdBy,
      this.periodScheme,
      this.specialPeriodsCount
    );
  }
}
