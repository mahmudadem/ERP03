import { GetJournalUseCase } from '../../../../application/accounting/use-cases/LedgerUseCases';

describe('GetJournalUseCase', () => {
  const permissionChecker = { assertOrThrow: jest.fn().mockResolvedValue(undefined) } as any;

  it('groups vouchers with lines and totals', async () => {
    const voucherRepo = {
      findByDateRange: jest.fn().mockResolvedValue([
        {
          id: 'v1',
          voucherNo: 'JE-0001',
          date: '2026-01-05',
          type: 'JE',
          description: 'Rent',
          status: 'DRAFT',
          currency: 'USD',
          lines: [
            { accountId: 'a1', debitAmount: 2000, creditAmount: 0 },
            { accountId: 'a2', debitAmount: 0, creditAmount: 2000 }
          ]
        }
      ])
    };
    const accountRepo = {
      list: jest.fn().mockResolvedValue([
        { id: 'a1', userCode: '5010', name: 'Rent Exp' },
        { id: 'a2', userCode: '1101', name: 'Cash' }
      ])
    };

    const useCase = new GetJournalUseCase(voucherRepo as any, accountRepo as any, permissionChecker);
    const res = await useCase.execute('c1', 'u1', { fromDate: '2026-01-01', toDate: '2026-01-31' } as any);

    expect(permissionChecker.assertOrThrow).toHaveBeenCalled();
    expect(res[0].voucherNo).toBe('JE-0001');
    expect(res[0].totalDebit).toBe(2000);
    expect(res[0].lines[0].accountCode).toBe('5010');
  });
});
