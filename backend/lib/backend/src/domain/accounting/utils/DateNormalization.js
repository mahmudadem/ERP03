"use strict";
/**
 * Date normalization utility for accounting
 *
 * Ensures consistent date-only comparison across timezones
 * for period locking and accounting operations.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareAccountingDates = exports.normalizeAccountingDate = void 0;
/**
 * Normalize any date input to YYYY-MM-DD format (accounting date)
 *
 * Handles:
 * - ISO strings with time (2025-01-15T23:30:00Z)
 * - Date objects
 * - Already normalized strings (2025-01-15)
 *
 * @param input - Date string, Date object, or YYYY-MM-DD string
 * @returns Normalized date string in YYYY-MM-DD format
 */
function normalizeAccountingDate(input) {
    if (!input) {
        throw new Error('Date input is required for normalization');
    }
    let dateObj;
    if (typeof input === 'string') {
        // Handle YYYY-MM-DD format (already normalized)
        if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
            return input;
        }
        // Parse ISO or other date string
        dateObj = new Date(input);
    }
    else {
        dateObj = input;
    }
    // Validate date
    if (isNaN(dateObj.getTime())) {
        throw new Error(`Invalid date: ${input}`);
    }
    // Extract year, month, day in UTC to avoid timezone issues
    const year = dateObj.getUTCFullYear();
    const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
exports.normalizeAccountingDate = normalizeAccountingDate;
/**
 * Compare two accounting dates (YYYY-MM-DD format)
 *
 * @param date1 - First date (YYYY-MM-DD or parseable)
 * @param date2 - Second date (YYYY-MM-DD or parseable)
 * @returns -1 if date1 < date2, 0 if equal, 1 if date1 > date2
 */
function compareAccountingDates(date1, date2) {
    const normalized1 = normalizeAccountingDate(date1);
    const normalized2 = normalizeAccountingDate(date2);
    if (normalized1 < normalized2)
        return -1;
    if (normalized1 > normalized2)
        return 1;
    return 0;
}
exports.compareAccountingDates = compareAccountingDates;
//# sourceMappingURL=DateNormalization.js.map