import { GetProfitAndLossUseCase } from '../../../../application/reporting/use-cases/GetProfitAndLossUseCase';
import { IVoucherRepository } from '../../../../domain/accounting/repositories/IVoucherRepository';
import { IAccountRepository } from '../../../../repository/interfaces/accounting/IAccountRepository';

const createVoucherRepository = () =>
  ({
    findByDateRange: jest.fn(),
  } as unknown as jest.Mocked<IVoucherRepository>);

const createAccountRepository = () =>
  ({
    list: jest.fn(),
  } as unknown as jest.Mocked<IAccountRepository>);

describe('GetProfitAndLossUseCase', () => {
  const permissionChecker = { assertOrThrow: jest.fn().mockResolvedValue(undefined) } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates totals from account classifications (not account-id prefixes) and ignores unposted vouchers', async () => {
    const voucherRepository = createVoucherRepository();
    const accountRepository = createAccountRepository();

    accountRepository.list.mockResolvedValue(
      [
        { id: 'acc-rev-uuid', userCode: '4100', name: 'Sales Revenue', classification: 'REVENUE' },
        { id: 'acc-exp-uuid', userCode: '5100', name: 'Rent Expense', classification: 'EXPENSE' },
        { id: 'acc-cash', userCode: '1010', name: 'Cash', classification: 'ASSET' },
      ] as any
    );

    voucherRepository.findByDateRange.mockResolvedValue(
      [
        {
          isPosted: true,
          lines: [
            { accountId: 'acc-rev-uuid', creditAmount: 1000, debitAmount: 0 },
            { accountId: 'acc-exp-uuid', creditAmount: 0, debitAmount: 400 },
            { accountId: 'acc-cash', creditAmount: 0, debitAmount: 600 },
          ],
        },
        {
          isPosted: false,
          lines: [{ accountId: 'acc-rev-uuid', creditAmount: 999, debitAmount: 0 }],
        },
      ] as any
    );

    const useCase = new GetProfitAndLossUseCase(voucherRepository, accountRepository, permissionChecker);
    const result = await useCase.execute({
      companyId: 'c1',
      userId: 'u1',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
    });

    expect(permissionChecker.assertOrThrow).toHaveBeenCalledWith('u1', 'c1', 'accounting.reports.profitAndLoss.view');
    expect(voucherRepository.findByDateRange).toHaveBeenCalledWith('c1', '2026-01-01', '2026-01-31', 100000);
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
    const voucherRepository = createVoucherRepository();
    const accountRepository = createAccountRepository();

    accountRepository.list.mockResolvedValue(
      [
        { id: 'rev', userCode: '4001', name: 'Service Revenue', classification: 'REVENUE' },
        { id: 'exp', userCode: '5001', name: 'Utilities Expense', classification: 'EXPENSE' },
      ] as any
    );

    voucherRepository.findByDateRange.mockResolvedValue(
      [
        {
          isPosted: true,
          lines: [
            { accountId: 'rev', creditAmount: 500, debitAmount: 0 },
            { accountId: 'rev', creditAmount: 0, debitAmount: 200 },
            { accountId: 'exp', creditAmount: 0, debitAmount: 150 },
            { accountId: 'exp', creditAmount: 25, debitAmount: 0 },
          ],
        },
      ] as any
    );

    const useCase = new GetProfitAndLossUseCase(voucherRepository, accountRepository, permissionChecker);
    const result = await useCase.execute({
      companyId: 'c1',
      userId: 'u1',
      fromDate: '2026-01-01T00:00:00.000Z',
      toDate: '2026-01-31T23:59:59.999Z',
    });

    expect(voucherRepository.findByDateRange).toHaveBeenCalledWith('c1', '2026-01-01', '2026-01-31', 100000);
    expect(result.revenue).toBe(300);
    expect(result.expenses).toBe(125);
    expect(result.netProfit).toBe(175);
  });
});
