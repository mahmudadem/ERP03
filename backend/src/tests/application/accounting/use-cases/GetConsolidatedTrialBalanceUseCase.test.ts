import { GetConsolidatedTrialBalanceUseCase } from '../../../../application/accounting/use-cases/ConsolidationUseCases';

describe('GetConsolidatedTrialBalanceUseCase', () => {
  const groupRepo: any = {
    findById: jest.fn()
  };
  const companyRepo: any = {
    findById: jest.fn()
  };
  const ledgerRepo: any = {
    getTrialBalance: jest.fn()
  };
  const accountRepo: any = {};
  const rateRepo: any = {
    getMostRecentRateBeforeDate: jest.fn()
  };
  const permissionChecker: any = { assertOrThrow: jest.fn() };

  it('sums member trial balances with currency conversion', async () => {
    groupRepo.findById.mockResolvedValue({
      id: 'g1',
      name: 'Group',
      reportingCurrency: 'USD',
      members: [{ companyId: 'c1' }, { companyId: 'c2' }]
    });
    companyRepo.findById.mockImplementation((id: string) => Promise.resolve({ id, baseCurrency: id === 'c1' ? 'USD' : 'EUR' }));
    ledgerRepo.getTrialBalance.mockImplementation((id: string) =>
      Promise.resolve([
        { accountId: 'A', accountCode: 'A', accountName: 'Cash', debit: id === 'c1' ? 100 : 50, credit: 0, balance: 0 }
      ])
    );
    rateRepo.getMostRecentRateBeforeDate.mockResolvedValue({ rate: 2 }); // EUR->USD =2

    const uc = new GetConsolidatedTrialBalanceUseCase(groupRepo, companyRepo, ledgerRepo, accountRepo, rateRepo, permissionChecker);
    const res = await uc.execute('g1', 'c1', 'u1', '2026-01-31');
    const line = res.lines.find((l) => l.accountId === 'A')!;
    expect(line.debit).toBe(200); // 100 USD + 50 EUR *2
    expect(res.totals.debit).toBe(200);
  });
});
