/**
 * Voucher Entity Tests
 * 
 * Tests for the VoucherEntity aggregate root.
 * Verifies immutability, validation, and state transitions.
 */

import { describe, it, expect } from '@jest/globals';
import { VoucherEntity } from '../../../../src/domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../../src/domain/accounting/entities/VoucherLineEntity';
import { VoucherType, VoucherStatus } from '../../../../src/domain/accounting/types/VoucherTypes';

describe('VoucherEntity', () => {
  const createTestLines = (): VoucherLineEntity[] => {
    return [
      new VoucherLineEntity(
        1,
        'expense-001',
        'Debit',
        100,
        'USD',
        100,
        'USD',
        1.0,
        'Test debit'
      ),
      new VoucherLineEntity(
        2,
        'cash-001',
        'Credit',
        100,
        'USD',
        100,
        'USD',
        1.0,
        'Test credit'
      )
    ];
  };

  describe('constructor validation', () => {
    it('should create voucher with valid data', () => {
      const lines = createTestLines();

      const voucher = new VoucherEntity(
        'v-001',
        'company-001',
        'PAY-2025-001',
        VoucherType.PAYMENT,
        '2025-01-15',
        'Test payment',
        'USD',
        'USD',
        1.0,
        lines,
        100,  // totalDebit
        100,  // totalCredit
        VoucherStatus.DRAFT,
        'user-001',
        new Date()
      );

      expect(voucher.id).toBe('v-001');
      expect(voucher.isBalanced).toBe(true);
    });

    it('should reject if less than 2 lines', () => {
      const singleLine = [createTestLines()[0]];

      expect(() => {
        new VoucherEntity(
          'v-001',
          'company-001',
          'PAY-2025-001',
          VoucherType.PAYMENT,
          '2025-01-15',
          'Test',
          'USD',
          'USD',
          1.0,
          singleLine,
          100,
          0,
          VoucherStatus.DRAFT,
          'user-001',
          new Date()
        );
      }).toThrow('Voucher must have at least 2 lines');
    });

    it('should reject if debits do not equal credits', () => {
      const unbalancedLines = [
        new VoucherLineEntity(1, 'expense-001', 'Debit', 100, 'USD', 100, 'USD', 1.0),
        new VoucherLineEntity(2, 'cash-001', 'Credit', 80, 'USD', 80, 'USD', 1.0)
      ];

      expect(() => {
        new VoucherEntity(
          'v-001',
          'company-001',
          'PAY-2025-001',
          VoucherType.PAYMENT,
          '2025-01-15',
          'Test',
          'USD',
          'USD',
          1.0,
          unbalancedLines,
          100,
          80,
          VoucherStatus.DRAFT,
          'user-001',
          new Date()
        );
      }).toThrow('Voucher not balanced');
    });

    it('should reject if totals do not match line sums', () => {
      const lines = createTestLines();

      expect(() => {
        new VoucherEntity(
          'v-001',
          'company-001',
          'PAY-2025-001',
          VoucherType.PAYMENT,
          '2025-01-15',
          'Test',
          'USD',
          'USD',
          1.0,
          lines,
          100,
          90,  // Wrong total!
          VoucherStatus.DRAFT,
          'user-001',
          new Date()
        );
      }).toThrow('Total credit does not match sum of credit lines');
    });

    it('should reject if line currencies do not match voucher currency', () => {
      const mixedCurrencyLines = [
        new VoucherLineEntity(1, 'expense-001', 'Debit', 100, 'EUR', 110, 'USD', 1.1),
        new VoucherLineEntity(2, 'cash-001', 'Credit', 100, 'USD', 100, 'USD', 1.0)
      ];

      expect(() => {
        new VoucherEntity(
          'v-001',
          'company-001',
          'PAY-2025-001',
          VoucherType.PAYMENT,
          '2025-01-15',
          'Test',
          'USD',
          'USD',
          1.0,
          mixedCurrencyLines,
          110,
          100,
          VoucherStatus.DRAFT,
          'user-001',
          new Date()
        );
      }).toThrow('All lines must use the same transaction and base currency');
    });
  });

  describe('status checks', () => {
    it('should correctly identify draft voucher', () => {
      const voucher = new VoucherEntity(
        'v-001',
        'company-001',
        'PAY-2025-001',
        VoucherType.PAYMENT,
        '2025-01-15',
        'Test',
        'USD',
        'USD',
        1.0,
        createTestLines(),
        100,
        100,
        VoucherStatus.DRAFT,
        'user-001',
        new Date()
      );

      expect(voucher.isDraft).toBe(true);
      expect(voucher.isApproved).toBe(false);
      expect(voucher.isLocked).toBe(false);
      expect(voucher.isRejected).toBe(false);
    });

    it('should correctly identify approved voucher', () => {
      const voucher = new VoucherEntity(
        'v-001',
        'company-001',
        'PAY-2025-001',
        VoucherType.PAYMENT,
        '2025-01-15',
        'Test',
        'USD',
        'USD',
        1.0,
        createTestLines(),
        100,
        100,
        VoucherStatus.APPROVED,
        'user-001',
        new Date(),
        'approver-001',
        new Date()
      );

      expect(voucher.isDraft).toBe(false);
      expect(voucher.isApproved).toBe(true);
      expect(voucher.isLocked).toBe(false);
    });
  });

  describe('approve()', () => {
    it('should create approved version from draft', () => {
      const draft = new VoucherEntity(
        'v-001',
        'company-001',
        'PAY-2025-001',
        VoucherType.PAYMENT,
        '2025-01-15',
        'Test',
        'USD',
        'USD',
        1.0,
        createTestLines(),
        100,
        100,
        VoucherStatus.DRAFT,
        'user-001',
        new Date()
      );

      const approved = draft.approve('approver-001', new Date());

      expect(approved.status).toBe(VoucherStatus.APPROVED);
      expect(approved.approvedBy).toBe('approver-001');
      expect(approved.approvedAt).toBeDefined();
      
      // Original unchanged (immutability)
      expect(draft.status).toBe(VoucherStatus.DRAFT);
      expect(draft.approvedBy).toBeUndefined();
    });

    it('should reject approving non-draft voucher', () => {
      const approved = new VoucherEntity(
        'v-001',
        'company-001',
        'PAY-2025-001',
        VoucherType.PAYMENT,
        '2025-01-15',
        'Test',
        'USD',
        'USD',
        1.0,
        createTestLines(),
        100,
        100,
        VoucherStatus.APPROVED,
        'user-001',
        new Date(),
        'approver-001',
        new Date()
      );

      expect(() => {
        approved.approve('another-user', new Date());
      }).toThrow('Cannot approve voucher in status: approved');
    });
  });

  describe('reject()', () => {
    it('should create rejected version from draft', () => {
      const draft = new VoucherEntity(
        'v-001',
        'company-001',
        'PAY-2025-001',
        VoucherType.PAYMENT,
        '2025-01-15',
        'Test',
        'USD',
        'USD',
        1.0,
        createTestLines(),
        100,
        100,
        VoucherStatus.DRAFT,
        'user-001',
        new Date()
      );

      const rejected = draft.reject('rejecter-001', new Date(), 'Incorrect amount');

      expect(rejected.status).toBe(VoucherStatus.REJECTED);
      expect(rejected.rejectedBy).toBe('rejecter-001');
      expect(rejected.rejectionReason).toBe('Incorrect amount');
      
      // Original unchanged
      expect(draft.status).toBe(VoucherStatus.DRAFT);
    });
  });

  describe('lock()', () => {
    it('should create locked version from approved', () => {
      const approved = new VoucherEntity(
        'v-001',
        'company-001',
        'PAY-2025-001',
        VoucherType.PAYMENT,
        '2025-01-15',
        'Test',
        'USD',
        'USD',
        1.0,
        createTestLines(),
        100,
        100,
        VoucherStatus.APPROVED,
        'user-001',
        new Date(),
        'approver-001',
        new Date()
      );

      const locked = approved.lock('locker-001', new Date());

      expect(locked.status).toBe(VoucherStatus.LOCKED);
      expect(locked.lockedBy).toBe('locker-001');
      expect(locked.lockedAt).toBeDefined();
    });

    it('should reject locking draft voucher', () => {
      const draft = new VoucherEntity(
        'v-001',
        'company-001',
        'PAY-2025-001',
        VoucherType.PAYMENT,
        '2025-01-15',
        'Test',
        'USD',
        'USD',
        1.0,
        createTestLines(),
        100,
        100,
        VoucherStatus.DRAFT,
        'user-001',
        new Date()
      );

      expect(() => {
        draft.lock('locker-001', new Date());
      }).toThrow('Cannot lock voucher in status: draft');
    });
  });

  describe('serialization', () => {
    it('should serialize and deserialize correctly', () => {
      const original = new VoucherEntity(
        'v-001',
        'company-001',
        'PAY-2025-001',
        VoucherType.PAYMENT,
        '2025-01-15',
        'Test payment',
        'USD',
        'USD',
        1.0,
        createTestLines(),
        100,
        100,
        VoucherStatus.DRAFT,
        'user-001',
        new Date('2025-01-15T10:00:00Z')
      );

      const json = original.toJSON();
      const restored = VoucherEntity.fromJSON(json);

      expect(restored.id).toBe(original.id);
      expect(restored.voucherNo).toBe(original.voucherNo);
      expect(restored.type).toBe(original.type);
      expect(restored.status).toBe(original.status);
      expect(restored.totalDebit).toBe(original.totalDebit);
      expect(restored.totalCredit).toBe(original.totalCredit);
      expect(restored.lines.length).toBe(original.lines.length);
    });
  });
});
