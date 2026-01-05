"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimpleVoucherNumberGenerator = void 0;
const VoucherTypes_1 = require("../../../domain/accounting/types/VoucherTypes");
/**
 * Simple Voucher Number Generator
 *
 * Generates sequential voucher numbers per company and type.
 *
 * Format: {PREFIX}-{YEAR}-{SEQ}
 * Examples:
 * - PAY-2025-001
 * - PAY-2025-002
 * - REC-2025-001
 *
 * This is a simple in-memory implementation.
 * Production version should store counters in database.
 */
class SimpleVoucherNumberGenerator {
    constructor() {
        // In-memory counter (for testing/demo)
        // Production: Store in database
        this.counters = new Map();
    }
    getPrefix(type) {
        const prefixes = {
            [VoucherTypes_1.VoucherType.PAYMENT]: 'PAY',
            [VoucherTypes_1.VoucherType.RECEIPT]: 'REC',
            [VoucherTypes_1.VoucherType.JOURNAL_ENTRY]: 'JV',
            [VoucherTypes_1.VoucherType.OPENING_BALANCE]: 'OB',
            [VoucherTypes_1.VoucherType.REVERSAL]: 'REV'
        };
        return prefixes[type];
    }
    async generate(companyId, type, date) {
        // Extract year from date (YYYY-MM-DD)
        const year = date.substring(0, 4);
        const prefix = this.getPrefix(type);
        // Counter key: {companyId}-{type}-{year}
        const counterKey = `${companyId}-${type}-${year}`;
        // Get next sequence number
        const currentCount = this.counters.get(counterKey) || 0;
        const nextCount = currentCount + 1;
        // Update counter
        this.counters.set(counterKey, nextCount);
        // Format: PAY-2025-001
        const sequenceStr = String(nextCount).padStart(3, '0');
        return `${prefix}-${year}-${sequenceStr}`;
    }
    /**
     * Reset counter (for testing)
     */
    resetCounters() {
        this.counters.clear();
    }
}
exports.SimpleVoucherNumberGenerator = SimpleVoucherNumberGenerator;
//# sourceMappingURL=SimpleVoucherNumberGenerator.js.map