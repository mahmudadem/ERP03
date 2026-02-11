import { describe, it, expect } from '@jest/globals';
import { VoucherEntity } from '../../../../domain/accounting/entities/VoucherEntity';
import { VoucherLineEntity } from '../../../../domain/accounting/entities/VoucherLineEntity';
import { VoucherStatus, VoucherType } from '../../../../domain/accounting/types/VoucherTypes';

const buildLines = () => ([
  new VoucherLineEntity(1, 'cash', 'Debit', 100, 'USD', 100, 'USD', 1),
  new VoucherLineEntity(2, 'revenue', 'Credit', 100, 'USD', 100, 'USD', 1)
]);

const buildDraftVoucher = () =>
  new VoucherEntity(
    'v-1',
    'c-1',
    'PAY-2026-001',
    VoucherType.PAYMENT,
    '2026-02-11',
    'test',
    'USD',
    'USD',
    1,
    buildLines(),
    100,
    100,
    VoucherStatus.DRAFT,
    {},
    'user-1',
    new Date('2026-02-11')
  );

describe('VoucherEntity (v2)', () => {
  it('creates a balanced voucher', () => {
    const voucher = buildDraftVoucher();
    expect(voucher.isBalanced).toBe(true);
    expect(voucher.totalDebit).toBe(100);
    expect(voucher.totalCredit).toBe(100);
  });

  it('rejects unbalanced vouchers', () => {
    const lines = [
      new VoucherLineEntity(1, 'cash', 'Debit', 120, 'USD', 120, 'USD', 1),
      new VoucherLineEntity(2, 'revenue', 'Credit', 100, 'USD', 100, 'USD', 1)
    ];
    expect(() => new VoucherEntity(
      'v-2','c-1','PAY-002',VoucherType.PAYMENT,'2026-02-11','oops','USD','USD',1,
      lines,120,100,VoucherStatus.DRAFT,{},'u',new Date('2026-02-11')
    )).toThrow(/not balanced/i);
  });

  it('approves draft voucher', () => {
    const draft = buildDraftVoucher();
    const approved = draft.approve('approver', new Date('2026-02-12'));
    expect(approved.status).toBe(VoucherStatus.APPROVED);
    expect(approved.approvedBy).toBe('approver');
    expect(approved.approvedAt).toBeInstanceOf(Date);
    expect(draft.status).toBe(VoucherStatus.DRAFT); // immutability
  });

  it('posts approved voucher without changing status', () => {
    const approved = buildDraftVoucher().approve('approver', new Date('2026-02-12'));
    const posted = approved.post('poster', new Date('2026-02-13'));
    expect(posted.postedBy).toBe('poster');
    expect(posted.postedAt).toBeInstanceOf(Date);
    expect(posted.status).toBe(VoucherStatus.APPROVED);
  });

  it('serializes and deserializes', () => {
    const voucher = buildDraftVoucher();
    const restored = VoucherEntity.fromJSON(voucher.toJSON());
    expect(restored.voucherNo).toBe(voucher.voucherNo);
    expect(restored.lines.length).toBe(2);
    expect(restored.totalDebit).toBeCloseTo(voucher.totalDebit);
  });
});
