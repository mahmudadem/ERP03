import { GetAccountStatementUseCase } from '../../../../application/accounting/use-cases/LedgerUseCases';
import { ILedgerRepository, AccountStatementData } from '../../../../repository/interfaces/accounting/ILedgerRepository';

const baseMockRepo = (): jest.Mocked<ILedgerRepository> => ({
  recordForVoucher: jest.fn(),
  deleteForVoucher: jest.fn(),
  getAccountLedger: jest.fn(),
  getTrialBalance: jest.fn(),
  getGeneralLedger: jest.fn(),
  getAccountStatement: jest.fn()
});

describe('GetAccountStatementUseCase', () => {
  const permissionChecker = { assertOrThrow: jest.fn().mockResolvedValue(undefined) } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('computes opening balance and running balance across entries', async () => {
    const rawEntries = [
      { id: 'pre', date: '2025-12-15', debit: 200, credit: 0, voucherId: 'v0' },
      { id: 'e1', date: '2026-01-01', debit: 100, credit: 0, voucherId: 'v1', voucherNo: 'V-001' },
      { id: 'e2', date: '2026-01-10', debit: 0, credit: 50, voucherId: 'v2', voucherNo: 'V-002' },
    ];

    const ledgerRepo = baseMockRepo();
    ledgerRepo.getAccountStatement.mockImplementation(async (_companyId, accountId, fromDate, toDate) => {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const openingItems = rawEntries.filter(e => new Date(e.date) < start);
      const rangeItems = rawEntries.filter(e => new Date(e.date) >= start && new Date(e.date) <= end);

      const openingBalance = openingItems.reduce((sum, e) => sum + (e.debit || 0) - (e.credit || 0), 0);
      let running = openingBalance;
      let totalDebit = 0;
      let totalCredit = 0;

      const entries = rangeItems.map((e) => {
        const debit = e.debit || 0;
        const credit = e.credit || 0;
        running += debit - credit;
        totalDebit += debit;
        totalCredit += credit;
        return {
          id: e.id,
          date: e.date,
          voucherId: e.voucherId,
          voucherNo: e.voucherNo || e.voucherId,
          description: '',
          debit,
          credit,
          balance: running
        };
      });

      const result: AccountStatementData = {
        accountId,
        accountCode: '1000',
        accountName: 'Cash',
        accountCurrency: 'USD',
        baseCurrency: 'USD',
        fromDate,
        toDate,
        openingBalance,
        entries,
        closingBalance: running,
        totalDebit,
        totalCredit
      };
      return result;
    });

    const useCase = new GetAccountStatementUseCase(ledgerRepo, permissionChecker);
    const result = await useCase.execute('c1', 'u1', 'acc-1', '2026-01-01', '2026-01-31');

    expect(permissionChecker.assertOrThrow).toHaveBeenCalledWith('u1', 'c1', 'accounting.reports.generalLedger.view');
    expect(result.openingBalance).toBe(200);
    expect(result.entries.map(e => e.balance)).toEqual([300, 250]);
    expect(result.totalDebit).toBe(100);
    expect(result.totalCredit).toBe(50);
    expect(result.closingBalance).toBe(250);
  });

  it('returns zeros for empty accounts', async () => {
    const ledgerRepo = baseMockRepo();
    ledgerRepo.getAccountStatement.mockResolvedValue({
      accountId: 'acc-2',
      accountCode: '2000',
      accountName: 'Empty',
      accountCurrency: 'USD',
      baseCurrency: 'USD',
      fromDate: '2026-01-01',
      toDate: '2026-01-31',
      openingBalance: 0,
      entries: [],
      closingBalance: 0,
      totalDebit: 0,
      totalCredit: 0
    });

    const useCase = new GetAccountStatementUseCase(ledgerRepo, permissionChecker);
    const result = await useCase.execute('c1', 'u1', 'acc-2', '2026-01-01', '2026-01-31');

    expect(result.entries.length).toBe(0);
    expect(result.closingBalance).toBe(0);
    expect(permissionChecker.assertOrThrow).toHaveBeenCalled();
  });
});
