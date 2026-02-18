"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FiscalPeriodGenerator = void 0;
const FiscalYear_1 = require("../entities/FiscalYear");
class FiscalPeriodGenerator {
    static generate(startDate, endDate, scheme, specialPeriodsCount = 0) {
        const periods = [];
        const dStart = new Date(startDate);
        const dEnd = new Date(endDate);
        const fyEndYear = dEnd.getFullYear();
        let currentDate = new Date(dStart);
        let periodNo = 1;
        // Safety break to prevent infinite loops in case of bad dates
        let iterations = 0;
        const MAX_ITERATIONS = 50;
        while (currentDate <= dEnd && iterations < MAX_ITERATIONS) {
            iterations++;
            const periodStart = new Date(currentDate);
            let periodEnd;
            if (scheme === FiscalYear_1.PeriodScheme.MONTHLY) {
                // Add 1 month, then subtract 1 day (e.g. Jan 1 -> Feb 1 -> Jan 31)
                periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);
            }
            else if (scheme === FiscalYear_1.PeriodScheme.QUARTERLY) {
                // Add 3 months, then subtract 1 day
                periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 3, 0);
            }
            else { // SEMI_ANNUAL
                // Add 6 months, then subtract 1 day
                periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 6, 0);
            }
            // Clamp to FY end date (though strictly generated periods should align)
            if (periodEnd > dEnd) {
                periodEnd = new Date(dEnd);
            }
            // ID Format: FY{EndYear}-P{NN}
            const pNum = String(periodNo).padStart(2, '0');
            const id = `FY${fyEndYear}-P${pNum}`;
            // Naming
            let name = '';
            const startStr = periodStart.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            const endStr = periodEnd.toLocaleString('en-US', { month: 'short', year: 'numeric' });
            if (scheme === FiscalYear_1.PeriodScheme.MONTHLY) {
                name = periodStart.toLocaleString('en-US', { month: 'long', year: 'numeric' });
            }
            else if (scheme === FiscalYear_1.PeriodScheme.QUARTERLY) {
                name = `Q${periodNo} FY${fyEndYear} (${startStr} - ${endStr})`;
            }
            else { // SEMI_ANNUAL
                name = `H${periodNo} FY${fyEndYear} (${startStr} - ${endStr})`;
            }
            periods.push({
                id,
                name,
                startDate: this.toIso(periodStart),
                endDate: this.toIso(periodEnd),
                status: FiscalYear_1.PeriodStatus.OPEN,
                periodNo: periodNo,
                isSpecial: false
            });
            // Advance: Next start is current end + 1 day
            currentDate = new Date(periodEnd);
            currentDate.setDate(currentDate.getDate() + 1);
            periodNo++;
        }
        // Special Periods (13..16)
        // We strictly use 13, 14, 15, 16 regardless of scheme (Monthly/Quarterly)
        for (let i = 0; i < specialPeriodsCount; i++) {
            const spNo = 13 + i;
            if (spNo > 16)
                break; // Hard limit at 16 (P13-P16)
            const spId = `FY${fyEndYear}-P${spNo}`;
            periods.push({
                id: spId,
                name: `Special Period P${spNo}`,
                startDate: this.toIso(dEnd),
                endDate: this.toIso(dEnd),
                status: FiscalYear_1.PeriodStatus.OPEN,
                periodNo: spNo,
                isSpecial: true,
                metadata: { isAdjustment: true } // Keep for backward compat
            });
        }
        return periods;
    }
    static toIso(d) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
}
exports.FiscalPeriodGenerator = FiscalPeriodGenerator;
//# sourceMappingURL=FiscalPeriodGenerator.js.map