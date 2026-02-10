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
      { id: 'pre', date: '2025-12-15', side: 'Debit', amount: 200, baseAmount: 1000, voucherId: 'v0', exchangeRate: 5 },
      { id: 'e1', date: '2026-01-01', side: 'Debit', amount: 100, baseAmount: 500, voucherId: 'v1', voucherNo: 'V-001', exchangeRate: 5 },
      { id: 'e2', date: '2026-01-10', side: 'Credit', amount: 50, baseAmount: 250, voucherId: 'v2', voucherNo: 'V-002', exchangeRate: 5 },
    ];

    const ledgerRepo = baseMockRepo();
    ledgerRepo.getAccountStatement.mockImplementation(async (_companyId, accountId, fromDate, toDate) => {
      const start = new Date(fromDate);
      const end = new Date(toDate);
      const openingItems = rawEntries.filter(e => new Date(e.date) < start);
      const rangeItems = rawEntries.filter(e => new Date(e.date) >= start && new Date(e.date) <= end);

        const openingBalance = openingItems.reduce((sum, e) => {
          return sum + (e.side === 'Debit' ? e.amount : -e.amount);
        }, 0);
        const openingBase = openingItems.reduce((sum, e) => {
          const base = typeof e.baseAmount === 'number' ? e.baseAmount : (e.amount || 0) * (e.exchangeRate || 1);
          return sum + (e.side === 'Debit' ? base : -base);
        }, 0);
        let running = openingBalance;
        let runningBase = openingBase;
        let totalDebit = 0;
        let totalCredit = 0;
        let totalBaseDebit = 0;
      let totalBaseCredit = 0;

        const entries = rangeItems.map((e) => {
          const debit = e.side === 'Debit' ? e.amount : 0;
          const credit = e.side === 'Credit' ? e.amount : 0;
          running += e.side === 'Debit' ? debit : -credit;
          totalDebit += debit;
          totalCredit += credit;
          const baseValue = typeof e.baseAmount === 'number' ? e.baseAmount : (e.amount || 0) * (e.exchangeRate || 1);
          const baseDebit = e.side === 'Debit' ? baseValue : 0;
          const baseCredit = e.side === 'Credit' ? baseValue : 0;
          runningBase += e.side === 'Debit' ? baseDebit : -baseCredit;
          totalBaseDebit += baseDebit;
          totalBaseCredit += baseCredit;
          return {
            id: e.id,
            date: e.date,
            voucherId: e.voucherId,
            voucherNo: e.voucherNo || e.voucherId,
            description: '',
            debit,
            credit,
            balance: running,
            baseDebit,
            baseCredit,
            baseBalance: runningBase
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
        openingBalanceBase: openingBase,
        entries,
        closingBalance: running,
        closingBalanceBase: runningBase,
        totalDebit,
        totalCredit,
        totalBaseDebit,
        totalBaseCredit
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
    expect(result.totalBaseDebit).toBe(500);
    expect(result.totalBaseCredit).toBe(250);
    expect(result.closingBalance).toBe(250);
    expect(result.closingBalanceBase).toBe(1250);
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
