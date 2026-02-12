"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeriodLockPolicy = void 0;
const DateNormalization_1 = require("../../utils/DateNormalization");
const FiscalYear_1 = require("../../entities/FiscalYear");
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
class PeriodLockPolicy {
    constructor(lockedThroughDate, resolveFiscalPeriodStatus) {
        this.lockedThroughDate = lockedThroughDate;
        this.resolveFiscalPeriodStatus = resolveFiscalPeriodStatus;
        this.id = 'period-lock';
        this.name = 'Period Lock';
    }
    async validate(ctx) {
        try {
            const voucherDate = (0, DateNormalization_1.normalizeAccountingDate)(ctx.voucherDate);
            // Fiscal period check (if resolver provided)
            if (this.resolveFiscalPeriodStatus) {
                const status = await this.resolveFiscalPeriodStatus(ctx.companyId, voucherDate);
                if (status === FiscalYear_1.PeriodStatus.LOCKED || status === FiscalYear_1.PeriodStatus.CLOSED) {
                    return {
                        ok: false,
                        error: {
                            code: 'PERIOD_CLOSED',
                            message: `Cannot post to ${status === null || status === void 0 ? void 0 : status.toLowerCase()} period for date ${voucherDate}`,
                            fieldHints: ['date']
                        }
                    };
                }
            }
            if (!this.lockedThroughDate) {
                return { ok: true };
            }
            const lockedDate = (0, DateNormalization_1.normalizeAccountingDate)(this.lockedThroughDate);
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
        }
        catch (error) {
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
exports.PeriodLockPolicy = PeriodLockPolicy;
//# sourceMappingURL=PeriodLockPolicy.js.map