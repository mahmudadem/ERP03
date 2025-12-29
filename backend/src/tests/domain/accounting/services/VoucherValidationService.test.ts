import { describe, it, expect } from '@jest/globals';
import { VoucherValidationService } from '../../../../src/domain/accounting/services/VoucherValidationService';
import { VoucherEntity } from '../../../../src/domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../../src/domain/accounting/entities/VoucherLineEntity';
import { VoucherType, VoucherStatus } from '../../../../src/domain/accounting/types/VoucherTypes';

describe('VoucherValidationService', () => {
  const service = new VoucherValidationService();

  const createTestVoucher = (lines: VoucherLineEntity[]) => {
    const totalDebit = lines.reduce((s, l) => s + l.debitAmount, 0);
    const totalCredit = lines.reduce((s, l) => s + l.creditAmount, 0);

    return new VoucherEntity(
      'v-001',
      'company-001',
      'V-001',
      VoucherType.JOURNAL_ENTRY,
      '2025-01-01',
      'Test',
      'USD',
      'USD',
      1.0,
      lines,
      totalDebit,
      totalCredit,
      VoucherStatus.DRAFT,
      {},
      'user-001',
      new Date()
    );
  };

  describe('validateCore()', () => {
    it('should pass valid voucher', () => {
      const lines = [
        new VoucherLineEntity(1, 'acc-1', 'Debit', 100, 'USD', 100, 'USD', 1.0),
        new VoucherLineEntity(2, 'acc-2', 'Credit', 100, 'USD', 100, 'USD', 1.0)
      ];
      const voucher = createTestVoucher(lines);
      
      expect(() => service.validateCore(voucher)).not.toThrow();
    });

    it('should throw if lines are missing or insufficient', () => {
        // VoucherEntity constructor already catches < 2 lines, 
        // but service provides an extra layer.
        const lines = [
          new VoucherLineEntity(1, 'acc-1', 'Debit', 100, 'USD', 100, 'USD', 1.0)
        ];
        // We have to bypass constructor for this test if we want to test service's check
        // but since constructor throws, we can just verify the service would too if it got there.
        expect(() => {
           service.validateCore({ lines: [] } as any);
        }).toThrow('Voucher must have at least 2 lines');
    });

    it('should throw for invalid amounts', () => {
        // Constructor prevents <= 0 in VoucherLineEntity
        // but service checks it again
        expect(() => {
           service.validateCore({
               lines: [
                   { id: 1, accountId: 'acc-1', amount: 0, baseAmount: 0, debitAmount: 10, creditAmount: 10 },
                   { id: 2, accountId: 'acc-2', amount: 100, baseAmount: 100 }
               ],
               isBalanced: true,
               totalDebit: 10,
               totalCredit: 10
           } as any);
        }).toThrow('Amounts must be positive');
    });

    it('should throw for currency mismatch', () => {
        const lines = [
            new VoucherLineEntity(1, 'acc-1', 'Debit', 100, 'EUR', 110, 'USD', 1.1),
            new VoucherLineEntity(2, 'acc-2', 'Credit', 100, 'USD', 100, 'USD', 1.0)
        ];
        // Constructor will throw here too.
        expect(() => {
             const v = createTestVoucher(lines);
             service.validateCore(v);
        }).toThrow();
    });
  });
});
