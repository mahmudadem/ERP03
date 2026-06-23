import { ReceiptVoucherStrategy } from '../../../domain/accounting/strategies/implementations/ReceiptVoucherStrategy';
import { PaymentVoucherStrategy } from '../../../domain/accounting/strategies/implementations/PaymentVoucherStrategy';

/**
 * Guard for INFRA_999 "Receipt requires depositToAccountId" / "Payment requires
 * payFromAccountId" at POS posting.
 *
 * POS posts its settlement (RECEIPT) and refund (PAYMENT) legs through
 * recordFinancialEvent with pre-built canonical JV-style lines. The strategies
 * only treat lines as canonical when each carries `amount > 0`; otherwise they
 * fall back to the depositToAccountId/payFromAccountId builder and throw. POS
 * therefore must include `amount` (alongside baseAmount/docAmount) on those
 * lines. These tests run the REAL strategies (the POS unit tests mock the
 * accounting bridge, so they cannot catch this).
 */
describe('POS canonical voucher lines (INFRA_999 guard)', () => {
  it('ReceiptVoucherStrategy accepts POS settlement canonical lines (no depositToAccountId needed)', async () => {
    const strategy = new ReceiptVoucherStrategy();
    const header = {
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        { accountId: 'cash-acc', side: 'Debit', amount: 20, baseAmount: 20, docAmount: 20, notes: 'POS CASH receipt' },
        { accountId: 'ar-acc', side: 'Credit', amount: 20, baseAmount: 20, docAmount: 20, notes: 'POS settlement' },
      ],
    };

    const lines = await strategy.generateLines(header, 'cmp_test', 'USD');

    expect(lines).toHaveLength(2);
    const debit = lines.find((l) => l.debitAmount > 0)!;
    const credit = lines.find((l) => l.creditAmount > 0)!;
    expect(debit.accountId).toBe('cash-acc');
    expect(debit.debitAmount).toBe(20);
    expect(credit.accountId).toBe('ar-acc');
    expect(credit.creditAmount).toBe(20);
  });

  it('PaymentVoucherStrategy accepts POS refund canonical lines (no payFromAccountId needed)', async () => {
    const strategy = new PaymentVoucherStrategy();
    const header = {
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        { accountId: 'ar-acc', side: 'Debit', amount: 15, baseAmount: 15, docAmount: 15 },
        { accountId: 'cash-acc', side: 'Credit', amount: 15, baseAmount: 15, docAmount: 15 },
      ],
    };

    const lines = await strategy.generateLines(header, 'cmp_test', 'USD');

    expect(lines).toHaveLength(2);
    const debit = lines.find((l) => l.debitAmount > 0)!;
    const credit = lines.find((l) => l.creditAmount > 0)!;
    expect(debit.accountId).toBe('ar-acc');
    expect(debit.debitAmount).toBe(15);
    expect(credit.accountId).toBe('cash-acc');
    expect(credit.creditAmount).toBe(15);
  });

  it('regression: the OLD POS line shape (baseAmount/docAmount but no amount) still throws — proves amount is what fixed it', async () => {
    const strategy = new ReceiptVoucherStrategy();
    const header = {
      currency: 'USD',
      exchangeRate: 1,
      lines: [
        { accountId: 'cash-acc', side: 'Debit', baseAmount: 20, docAmount: 20 },
        { accountId: 'ar-acc', side: 'Credit', baseAmount: 20, docAmount: 20 },
      ],
    };

    await expect(strategy.generateLines(header, 'cmp_test', 'USD')).rejects.toThrow(/depositToAccountId/);
  });
});
