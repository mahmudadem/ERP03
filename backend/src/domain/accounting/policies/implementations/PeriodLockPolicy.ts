import { IPostingPolicy } from '../IPostingPolicy';
import { PostingPolicyContext, PolicyResult } from '../PostingPolicyTypes';
import { normalizeAccountingDate } from '../../utils/DateNormalization';

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

  constructor(private readonly lockedThroughDate?: string) {}

  validate(ctx: PostingPolicyContext): PolicyResult {
    // If no locked date configured, policy passes
    if (!this.lockedThroughDate) {
      return { ok: true };
    }

    // Normalize both dates to YYYY-MM-DD for timezone-safe comparison
    try {
      const voucherDate = normalizeAccountingDate(ctx.voucherDate);
      const lockedDate = normalizeAccountingDate(this.lockedThroughDate);

      // Simple string comparison works for ISO dates (YYYY-MM-DD)
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
      // Date normalization failed - treat as validation error
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
