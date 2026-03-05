import { GetProfitAndLossUseCase } from '../../../../application/reporting/use-cases/GetProfitAndLossUseCase';
import { ILedgerRepository } from '../../../../repository/interfaces/accounting/ILedgerRepository';
import { IAccountRepository } from '../../../../repository/interfaces/accounting/IAccountRepository';

const createLedgerRepository = () =>
  ({
    getTrialBalance: jest.fn(),
  } as unknown as jest.Mocked<ILedgerRepository>);

const createAccountRepository = () =>
  ({
    list: jest.fn(),
  } as unknown as jest.Mocked<IAccountRepository>);

describe('GetProfitAndLossUseCase', () => {
  const permissionChecker = { assertOrThrow: jest.fn().mockResolvedValue(undefined) } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates period totals from trial-balance delta by account classification', async () => {
    const ledgerRepository = createLedgerRepository();
    const accountRepository = createAccountRepository();

    accountRepository.list.mockResolvedValue(
      [
        { id: 'acc-rev-uuid', userCode: '4100', name: 'Sales Revenue', classification: 'REVENUE' },
        { id: 'acc-exp-uuid', userCode: '5100', name: 'Rent Expense', classification: 'EXPENSE' },
        { id: 'acc-cash', userCode: '1010', name: 'Cash', classification: 'ASSET' },
      ] as any
    );

    ledgerRepository.getTrialBalance
      .mockResolvedValueOnce(
        [
          { accountId: 'acc-rev-uuid', debit: 0, credit: 100 },
          { accountId: 'acc-exp-uuid', debit: 50, credit: 0 },
          { accountId: 'acc-cash', debit: 50, credit: 0 },
        ] as any
      )
      .mockResolvedValueOnce(
      [
        { accountId: 'acc-rev-uuid', debit: 0, credit: 1100 },
        { accountId: 'acc-exp-uuid', debit: 450, credit: 0 },
        { accountId: 'acc-cash', debit: 650, credit: 0 },
      ] as any
      );

    const useCase = new GetProfitAndLossUseCase(ledgerRepository, accountRepository, permissionChecker);
    const result = await useCase.execute({
      companyId: 'c1',
      userId: 'u1',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(permissionChecker.assertOrThrow).toHaveBeenCalledWith('u1', 'c1', 'accounting.reports.profitAndLoss.view');
    expect(ledgerRepository.getTrialBalance).toHaveBeenNthCalledWith(1, 'c1', '2025-12-31');
    expect(ledgerRepository.getTrialBalance).toHaveBeenNthCalledWith(2, 'c1', '2026-01-31');
    expect(result.revenue).toBe(1000);
    expect(result.expenses).toBe(400);
    expect(result.netProfit).toBe(600);
    expect(result.revenueByAccount).toEqual([
      { accountId: 'acc-rev-uuid', accountName: '4100 - Sales Revenue', amount: 1000 },
    ]);
    expect(result.expensesByAccount).toEqual([
      { accountId: 'acc-exp-uuid', accountName: '5100 - Rent Expense', amount: 400 },
    ]);
    expect(result.period).toEqual({ from: '2026-01-01', to: '2026-01-31' });
  });

  it('uses net movement per line side and normalizes ISO datetime inputs to date-only', async () => {
    const ledgerRepository = createLedgerRepository();
    const accountRepository = createAccountRepository();

    accountRepository.list.mockResolvedValue(
      [
        { id: 'rev', userCode: '4001', name: 'Service Revenue', classification: 'REVENUE' },
        { id: 'exp', userCode: '5001', name: 'Utilities Expense', classification: 'EXPENSE' },
      ] as any
    );

    ledgerRepository.getTrialBalance
      .mockResolvedValueOnce(
        [
          { accountId: 'rev', debit: 20, credit: 100 },
          { accountId: 'exp', debit: 10, credit: 0 },
        ] as any
      )
      .mockResolvedValueOnce(
        [
          { accountId: 'rev', debit: 120, credit: 500 },
          { accountId: 'exp', debit: 160, credit: 25 },
        ] as any
      );

    const useCase = new GetProfitAndLossUseCase(ledgerRepository, accountRepository, permissionChecker);
    const result = await useCase.execute({
      companyId: 'c1',
      userId: 'u1',
      fromDate: '2026-01-01T00:00:00.000Z',
      toDate: '2026-01-31T23:59:59.999Z',
    });

    expect(ledgerRepository.getTrialBalance).toHaveBeenNthCalledWith(1, 'c1', '2025-12-31');
    expect(ledgerRepository.getTrialBalance).toHaveBeenNthCalledWith(2, 'c1', '2026-01-31');
    expect(result.revenue).toBe(300);
    expect(result.expenses).toBe(125);
    expect(result.netProfit).toBe(175);
  });
});
