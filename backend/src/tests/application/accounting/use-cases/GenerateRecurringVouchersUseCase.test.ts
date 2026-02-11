import { GenerateRecurringVouchersUseCase } from '../../../../application/accounting/use-cases/RecurringVoucherUseCases';
import { RecurringVoucherTemplate } from '../../../../domain/accounting/entities/RecurringVoucherTemplate';

describe('GenerateRecurringVouchersUseCase', () => {
  const templateRepo: any = {
    listDue: jest.fn(),
    update: jest.fn()
  };
  const voucherRepo: any = {
    findById: jest.fn(),
    save: jest.fn()
  };
  const permissionChecker: any = { assertOrThrow: jest.fn() };

  it('creates a new voucher and advances next date', async () => {
    const tmpl = new RecurringVoucherTemplate(
      't1',
      'c1',
      'Rent',
      'v-src',
      'MONTHLY',
      1,
      '2026-01-01',
      undefined,
      2,
      0,
      '2026-02-01',
      'ACTIVE',
      'u1',
      new Date('2026-01-01')
    );
    templateRepo.listDue.mockResolvedValue([tmpl]);
    voucherRepo.findById.mockResolvedValue({
      id: 'v-src',
      companyId: 'c1',
      type: 'payment',
      description: 'Rent Jan',
      currency: 'USD',
      baseCurrency: 'USD',
      exchangeRate: 1,
      lines: [
        { id: 1, accountId: 'A', side: 'Debit', debitAmount: 1000, creditAmount: 0, baseAmount: 1000, baseCurrency: 'USD', amount: 1000, currency: 'USD', exchangeRate: 1, notes: '' },
        { id: 2, accountId: 'B', side: 'Credit', debitAmount: 0, creditAmount: 1000, baseAmount: 1000, baseCurrency: 'USD', amount: 1000, currency: 'USD', exchangeRate: 1, notes: '' }
      ],
      totalDebit: 1000,
      totalCredit: 1000,
      status: 'draft',
      metadata: {}
    });
    voucherRepo.save.mockImplementation((v: any) => v);

    const uc = new GenerateRecurringVouchersUseCase(templateRepo, voucherRepo, permissionChecker);
    const result = await uc.execute('c1', 'u1', '2026-02-02');

    expect(result.length).toBe(1);
    expect(templateRepo.update).toHaveBeenCalled();
  });
});
