import { IPostingPolicy } from '../IPostingPolicy';
import { PostingPolicyContext, PolicyResult } from '../PostingPolicyTypes';
import { normalizeAccountingDate } from '../../utils/DateNormalization';
import { PeriodStatus } from '../../entities/FiscalYear';

/**
 * PeriodLockPolicy
 * 
 * Prevents posting to locked accounting periods.
 * 
 * When enabled:
 * - Checks if voucher date falls on or before the locked through date
 * - If locked, posting is denied
 * - Protects closed periods from modifications
 * 
 * Config format:
 * - lockedThroughDate: "YYYY-MM-DD" (all dates <= this are locked)
 * 
 * NOTE: Uses date normalization to ensure timezone-safe comparison.
 * Voucher dates with time components are normalized to YYYY-MM-DD.
 */
export class PeriodLockPolicy implements IPostingPolicy {
  readonly id = 'period-lock';
  readonly name = 'Period Lock';

  constructor(
    private readonly lockedThroughDate?: string,
    private readonly resolveFiscalPeriodStatus?: (companyId: string, date: string) => Promise<PeriodStatus | null> | undefined
  ) {}

  async validate(ctx: PostingPolicyContext): Promise<PolicyResult> {
    try {
      const voucherDate = normalizeAccountingDate(ctx.voucherDate);

      // Fiscal period check (if resolver provided)
      if (this.resolveFiscalPeriodStatus) {
        const status = await this.resolveFiscalPeriodStatus(ctx.companyId, voucherDate);
        if (status === PeriodStatus.LOCKED || status === PeriodStatus.CLOSED) {
          return {
            ok: false,
            error: {
              code: 'PERIOD_CLOSED',
              message: `Cannot post to ${status?.toLowerCase()} period for date ${voucherDate}`,
              fieldHints: ['date']
            }
          };
        }
      }

      if (!this.lockedThroughDate) {
        return { ok: true };
      }

      const lockedDate = normalizeAccountingDate(this.lockedThroughDate);

      if (voucherDate <= lockedDate) {
        return {
          ok: false,
          error: {
            code: 'PERIOD_LOCKED',
            message: `Cannot post to locked period. Voucher date ${voucherDate} is on or before locked through date ${lockedDate}`,
            fieldHints: ['date']
          }
        };
      }

      return { ok: true };
    } catch (error: any) {
      return {
        ok: false,
        error: {
          code: 'INVALID_DATE',
          message: `Invalid voucher date: ${error.message}`,
          fieldHints: ['date']
        }
      };
    }
  }
}
