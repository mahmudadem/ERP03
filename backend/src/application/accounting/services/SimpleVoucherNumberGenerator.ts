import { IVoucherNumberGenerator } from '../use-cases/SavePaymentVoucherUseCase';
import { VoucherType } from '../../../domain/accounting/types/VoucherTypes';

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
export class SimpleVoucherNumberGenerator implements IVoucherNumberGenerator {
  // In-memory counter (for testing/demo)
  // Production: Store in database
  private counters: Map<string, number> = new Map();

  private getPrefix(type: VoucherType): string {
    const prefixes: Record<VoucherType, string> = {
      [VoucherType.PAYMENT]: 'PAY',
      [VoucherType.RECEIPT]: 'REC',
      [VoucherType.JOURNAL_ENTRY]: 'JV',
      [VoucherType.OPENING_BALANCE]: 'OB',
      [VoucherType.REVERSAL]: 'REV'
    };

    return prefixes[type];
  }

  async generate(companyId: string, type: VoucherType, date: string): Promise<string> {
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
  resetCounters(): void {
    this.counters.clear();
  }
}
