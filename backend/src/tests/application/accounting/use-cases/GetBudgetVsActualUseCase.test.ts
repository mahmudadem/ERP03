import { GetBudgetVsActualUseCase } from '../../../../application/accounting/use-cases/BudgetUseCases';
import { IBudgetRepository } from '../../../../repository/interfaces/accounting/IBudgetRepository';
import { IFiscalYearRepository } from '../../../../repository/interfaces/accounting/IFiscalYearRepository';
import { ILedgerRepository } from '../../../../repository/interfaces/accounting/ILedgerRepository';
import { Budget } from '../../../../domain/accounting/entities/Budget';

const mkBudget = (): Budget =>
  new Budget(
    'b1',
    'c1',
    'fy1',
    'Test',
    1,
    'APPROVED',
    [
      { accountId: 'A1', monthlyAmounts: Array(12).fill(100), annualTotal: 1200 },
      { accountId: 'A2', monthlyAmounts: Array(12).fill(50), annualTotal: 600 }
    ],
    new Date(),
    'u1'
  );

describe('GetBudgetVsActualUseCase', () => {
  const budgetRepo: jest.Mocked<IBudgetRepository> = {
    create: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    list: jest.fn(),
    setStatus: jest.fn()
  };

  const fiscalRepo: jest.Mocked<IFiscalYearRepository> = {
    findByCompany: jest.fn(),
    findById: jest.fn(),
    findActiveForDate: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  };

  const ledgerRepo: jest.Mocked<ILedgerRepository> = {
    recordForVoucher: jest.fn(),
    deleteForVoucher: jest.fn(),
    getAccountLedger: jest.fn(),
    getTrialBalance: jest.fn(),
    getGeneralLedger: jest.fn(),
    getAccountStatement: jest.fn(),
    getUnreconciledEntries: jest.fn(),
    markReconciled: jest.fn(),
    getForeignBalances: jest.fn()
  };

  const permissionChecker: any = { assertOrThrow: jest.fn() };

  it('computes variance per account', async () => {
    budgetRepo.findById.mockResolvedValue(mkBudget());
    fiscalRepo.findById.mockResolvedValue({
      id: 'fy1',
      companyId: 'c1',
      name: 'FY',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      status: 'OPEN',
      periods: [],
      getPeriodForDate: () => null
    } as any);

    ledgerRepo.getGeneralLedger.mockResolvedValue([
      { accountId: 'A1', amount: 1300, side: 'Debit' },
      { accountId: 'A2', amount: 400, side: 'Debit' }
    ] as any);

    const uc = new GetBudgetVsActualUseCase(budgetRepo, fiscalRepo, ledgerRepo, permissionChecker);
    const rows = await uc.execute('c1', 'u1', 'b1');

    const a1 = rows.find((r) => r.accountId === 'A1')!;
    expect(a1.actual).toBe(1300);
    expect(a1.variance).toBe(100);
    const a2 = rows.find((r) => r.accountId === 'A2')!;
    expect(a2.variance).toBe(-200);
  });
});
